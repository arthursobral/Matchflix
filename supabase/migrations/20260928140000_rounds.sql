-- M3: baralho da rodada compartilhado entre todos os participantes. Schema conforme
-- planejado no M0 (docs/m0-arquitetura.md, seção 5) — `movie_id` guarda o id do filme
-- fictício do modo de demonstração por ora; troca para `tmdb_id` de verdade no M4.

create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  number int not null default 1,
  status text not null default 'open' check (status in ('open', 'finished')),
  started_at timestamptz not null default now()
);

create table if not exists round_movies (
  round_id uuid not null references rounds(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  position int not null,
  movie_id text not null,
  primary key (round_id, position)
);

alter table rounds enable row level security;
alter table round_movies enable row level security;

-- Mesma função já usada pela RLS de participants (M2), sem recriar a checagem.
create policy "participantes leem rounds da própria sala"
  on rounds for select
  using (is_room_participant(room_id));

create policy "participantes leem o baralho da própria sala"
  on round_movies for select
  using (is_room_participant(room_id));

alter publication supabase_realtime add table rounds;
alter publication supabase_realtime add table round_movies;

-- start_round agora também monta o baralho: recebe os ids candidatos (hoje, os filmes
-- fictícios do M1), embaralha no servidor e grava a ordem — a mesma para todos os
-- participantes, que só leem `round_movies` depois. Continua exigindo o anfitrião.
drop function if exists start_round(uuid);

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
  if v_room.status <> 'lobby' then
    raise exception 'rodada já iniciada';
  end if;
  if p_movie_ids is null or array_length(p_movie_ids, 1) is null then
    raise exception 'baralho vazio';
  end if;

  insert into rounds (room_id) values (p_room_id) returning id into v_round_id;

  insert into round_movies (round_id, room_id, position, movie_id)
  select v_round_id, p_room_id, s.pos, s.movie_id
  from (
    select movie_id, row_number() over (order by random()) as pos
    from unnest(p_movie_ids) as movie_id
  ) s;

  update rooms set status = 'voting', last_activity_at = now() where id = p_room_id;

  return v_round_id;
end;
$$;

grant execute on function start_round(uuid, text[]) to anon, authenticated;
