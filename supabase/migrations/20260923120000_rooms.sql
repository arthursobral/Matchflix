-- M2: salas e participantes. Rodadas, votos e matches entram nas migrações do M3/M5
-- (ver docs/m0-arquitetura.md, seção 5, para o modelo completo planejado).

create extension if not exists pgcrypto; -- gen_random_uuid()

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  country text not null default 'BR',
  mode text not null check (mode in ('same_home', 'remote')),
  genres text[] not null default '{}',
  host_user_id uuid not null,
  status text not null default 'lobby' check (status in ('lobby', 'voting', 'ended')),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  created_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null,
  nickname text not null,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (room_id, user_id)
);

alter table rooms enable row level security;
alter table participants enable row level security;

-- Só participantes ativos da própria sala podem ler a sala e a lista de participantes.
-- Não há política de insert/update/delete: toda escrita passa pelas funções abaixo,
-- que rodam como o dono das tabelas (security definer) e por isso ignoram a RLS,
-- exatamente como o cliente nunca decidindo o resultado sozinho (ver docs/m0).
create policy "participantes leem a própria sala"
  on rooms for select
  using (exists (
    select 1 from participants
    where participants.room_id = rooms.id
      and participants.user_id = auth.uid()
      and participants.removed_at is null
  ));

create policy "participantes leem a lista da própria sala"
  on participants for select
  using (exists (
    select 1 from participants p2
    where p2.room_id = participants.room_id
      and p2.user_id = auth.uid()
      and p2.removed_at is null
  ));

-- Código curto tipo "MFX824" (sem espaço; a interface formata na exibição).
-- Tenta algumas vezes até achar um código sem sala ativa igual.
create or replace function generate_room_code()
returns text
language plpgsql
as $$
declare
  candidate text;
  tries int := 0;
begin
  loop
    candidate := 'MFX' || lpad(floor(random() * 900 + 100)::text, 3, '0');
    exit when not exists (select 1 from rooms where code = candidate and status <> 'ended');
    tries := tries + 1;
    if tries > 20 then
      raise exception 'não foi possível gerar um código de sala livre';
    end if;
  end loop;
  return candidate;
end;
$$;

create or replace function create_room(
  p_name text,
  p_country text,
  p_mode text,
  p_genres text[],
  p_nickname text
)
returns table (room_id uuid, code text, participant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_code text;
  v_participant_id uuid;
begin
  if v_user_id is null then
    raise exception 'sessão anônima ausente';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'nome da sala é obrigatório';
  end if;
  if p_nickname is null or length(trim(p_nickname)) = 0 then
    raise exception 'apelido é obrigatório';
  end if;

  v_code := generate_room_code();

  insert into rooms (code, name, country, mode, genres, host_user_id)
  values (v_code, trim(p_name), coalesce(p_country, 'BR'), p_mode, coalesce(p_genres, '{}'), v_user_id)
  returning id into v_room_id;

  insert into participants (room_id, user_id, nickname, is_host)
  values (v_room_id, v_user_id, trim(p_nickname), true)
  returning id into v_participant_id;

  return query select v_room_id, v_code, v_participant_id;
end;
$$;

create or replace function join_room(
  p_code text,
  p_nickname text
)
returns table (room_id uuid, code text, participant_id uuid)
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

  select * into v_room from rooms where code = upper(trim(p_code));
  if not found then
    raise exception 'sala não encontrada';
  end if;
  if v_room.status = 'ended' or v_room.expires_at < now() then
    raise exception 'sala expirada';
  end if;

  insert into participants (room_id, user_id, nickname)
  values (v_room.id, v_user_id, trim(p_nickname))
  on conflict (room_id, user_id) do update set nickname = excluded.nickname, removed_at = null
  returning id into v_participant_id;

  update rooms set last_activity_at = now() where id = v_room.id;

  return query select v_room.id, v_room.code, v_participant_id;
end;
$$;

grant execute on function create_room(text, text, text, text[], text) to anon, authenticated;
grant execute on function join_room(text, text) to anon, authenticated;

-- Realtime da sala e da lista de participantes (rodadas/votos entram no M3/M5).
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table participants;
