-- M5: votos, match por unanimidade e fim de rodada (docs/m0-arquitetura.md, seções 4 e 5).
-- Toda escrita continua passando por função `security definer`; o cliente só lê.

-- M0: o mesmo filme nunca entra duas vezes na mesma sala, nem em rodadas diferentes.
alter table round_movies add constraint round_movies_room_movie_key unique (room_id, movie_id);

create table if not exists votes (
  round_id uuid not null references rounds(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  movie_id text not null,
  approve boolean not null,
  created_at timestamptz not null default now(),
  primary key (round_id, participant_id, movie_id)
);

create table if not exists matches (
  round_id uuid not null references rounds(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  movie_id text not null,
  created_at timestamptz not null default now(),
  primary key (round_id, movie_id)
);

alter table votes enable row level security;
alter table matches enable row level security;

-- Votos são privados (M0): cada um lê só os próprios — o suficiente para retomar o
-- baralho de onde parou depois de recarregar a página.
create policy "cada um lê os próprios votos"
  on votes for select
  using (exists (
    select 1 from participants p
    where p.id = votes.participant_id and p.user_id = auth.uid()
  ));

create policy "participantes leem os matches da própria sala"
  on matches for select
  using (is_room_participant(room_id));

alter publication supabase_realtime add table matches;

-- Voto de um participante num filme da rodada. Idempotente (votar de novo no mesmo filme
-- não muda nada). Declara o match quando todos os participantes ativos aprovaram o filme,
-- e fecha a rodada quando todos votaram em todo o baralho. Devolve se ESTE voto criou um match.
create or replace function cast_vote(p_round_id uuid, p_movie_id text, p_approve boolean)
returns table (out_matched boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_round rounds%rowtype;
  v_participant_id uuid;
  v_active int;
  v_approvals int;
  v_matched boolean := false;
begin
  if v_user_id is null then
    raise exception 'sessão anônima ausente';
  end if;

  -- ponytail: trava a rodada inteira a cada voto (serializa os votos da sala). Sem isso, os
  -- dois últimos "sim" de um filme chegando juntos se veriam como n-1 e ninguém declararia
  -- o match. Grupos são pequenos; trocar por trava por filme se um dia virar gargalo.
  select * into v_round from rounds where id = p_round_id for update;
  if not found then
    raise exception 'rodada não encontrada';
  end if;
  if v_round.status <> 'open' then
    raise exception 'rodada encerrada';
  end if;

  select id into v_participant_id
  from participants
  where room_id = v_round.room_id and user_id = v_user_id and removed_at is null;
  if v_participant_id is null then
    raise exception 'você não está nesta sala';
  end if;

  if not exists (select 1 from round_movies where round_id = p_round_id and movie_id = p_movie_id) then
    raise exception 'filme fora da rodada';
  end if;

  insert into votes (round_id, room_id, participant_id, movie_id, approve)
  values (p_round_id, v_round.room_id, v_participant_id, p_movie_id, p_approve)
  on conflict (round_id, participant_id, movie_id) do nothing;

  select count(*) into v_active
  from participants
  where room_id = v_round.room_id and removed_at is null;

  if p_approve then
    select count(*) into v_approvals
    from votes v
    join participants p on p.id = v.participant_id
    where v.round_id = p_round_id and v.movie_id = p_movie_id and v.approve and p.removed_at is null;

    if v_approvals = v_active then
      insert into matches (round_id, room_id, movie_id)
      values (p_round_id, v_round.room_id, p_movie_id)
      on conflict (round_id, movie_id) do nothing;
      v_matched := found;
    end if;
  end if;

  if (select count(*) from votes v
      join participants p on p.id = v.participant_id
      where v.round_id = p_round_id and p.removed_at is null)
     = v_active * (select count(*) from round_movies where round_id = p_round_id) then
    update rounds set status = 'finished' where id = p_round_id;
  end if;

  -- M0: a sala expira depois de 1 hora SEM atividade, não 1 hora depois de criada.
  update rooms set last_activity_at = now(), expires_at = now() + interval '1 hour' where id = v_round.room_id;

  return query select v_matched;
end;
$$;

-- Resumo da rodada para a tela de fim: aprovações por filme (sem dizer quem votou o quê),
-- quantos participantes ativos existem e quais filmes deram match.
create or replace function round_summary(p_round_id uuid)
returns table (out_movie_id text, out_approvals int, out_voters int, out_matched boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_voters int;
begin
  select room_id into v_room_id from rounds where id = p_round_id;
  if v_room_id is null or not is_room_participant(v_room_id) then
    raise exception 'rodada não encontrada';
  end if;

  select count(*)::int into v_voters from participants where room_id = v_room_id and removed_at is null;

  return query
    select rm.movie_id,
           (count(v.participant_id) filter (where v.approve and p.removed_at is null))::int,
           v_voters,
           exists (select 1 from matches m where m.round_id = p_round_id and m.movie_id = rm.movie_id)
    from round_movies rm
    left join votes v on v.round_id = rm.round_id and v.movie_id = rm.movie_id
    left join participants p on p.id = v.participant_id
    where rm.round_id = p_round_id
    group by rm.movie_id
    order by 2 desc, min(rm.position);
end;
$$;

-- start_round passa a aceitar uma nova rodada depois que a anterior terminou (antes só
-- saía do lobby). Numera as rodadas e renova a expiração da sala.
create or replace function start_round(p_room_id uuid, p_movie_ids text[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room rooms%rowtype;
  v_round_id uuid;
begin
  if v_user_id is null then
    raise exception 'sessão anônima ausente';
  end if;

  select * into v_room from rooms where id = p_room_id;
  if not found then
    raise exception 'sala não encontrada';
  end if;
  if v_room.host_user_id <> v_user_id then
    raise exception 'só o anfitrião pode iniciar a rodada';
  end if;
  if v_room.status = 'ended' or v_room.expires_at < now() then
    raise exception 'sala expirada';
  end if;
  if exists (select 1 from rounds where room_id = p_room_id and status = 'open') then
    raise exception 'rodada já iniciada';
  end if;
  if p_movie_ids is null or array_length(p_movie_ids, 1) is null then
    raise exception 'baralho vazio';
  end if;

  insert into rounds (room_id, number)
  values (p_room_id, coalesce((select max(number) from rounds where room_id = p_room_id), 0) + 1)
  returning id into v_round_id;

  insert into round_movies (round_id, room_id, position, movie_id)
  select v_round_id, p_room_id, s.pos, s.movie_id
  from (
    select movie_id, row_number() over (order by random()) as pos
    from unnest(p_movie_ids) as movie_id
  ) s;

  update rooms
  set status = 'voting', last_activity_at = now(), expires_at = now() + interval '1 hour'
  where id = p_room_id;

  return v_round_id;
end;
$$;

-- join_room: depois do primeiro match, não entra mais ninguém NOVO (M0, seção 4) — quem
-- já está na sala continua podendo voltar (reconexão com a mesma sessão).
create or replace function join_room(
  p_code text,
  p_nickname text
)
returns table (out_room_id uuid, out_code text, out_participant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room rooms%rowtype;
  v_participant_id uuid;
begin
  if v_user_id is null then
    raise exception 'sessão anônima ausente';
  end if;
  if p_nickname is null or length(trim(p_nickname)) = 0 then
    raise exception 'apelido é obrigatório';
  end if;

  select * into v_room from rooms where rooms.code = upper(trim(p_code));
  if not found then
    raise exception 'sala não encontrada';
  end if;
  if v_room.status = 'ended' or v_room.expires_at < now() then
    raise exception 'sala expirada';
  end if;
  if exists (select 1 from matches m where m.room_id = v_room.id)
     and not exists (select 1 from participants p where p.room_id = v_room.id and p.user_id = v_user_id) then
    raise exception 'sala com match';
  end if;

  insert into participants (room_id, user_id, nickname)
  values (v_room.id, v_user_id, trim(p_nickname))
  on conflict (room_id, user_id) do update set nickname = excluded.nickname, removed_at = null
  returning id into v_participant_id;

  update rooms set last_activity_at = now(), expires_at = now() + interval '1 hour' where id = v_room.id;

  return query select v_room.id, v_room.code, v_participant_id;
end;
$$;

grant execute on function cast_vote(uuid, text, boolean) to anon, authenticated;
grant execute on function round_summary(uuid) to anon, authenticated;
grant execute on function start_round(uuid, text[]) to anon, authenticated;
grant execute on function join_room(text, text) to anon, authenticated;
