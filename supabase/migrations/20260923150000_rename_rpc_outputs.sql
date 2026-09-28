-- Corrige de vez a classe de bug "column reference is ambiguous": as duas funções
-- devolviam colunas chamadas `room_id` e `code`, mesmo nome de colunas reais das
-- tabelas. O PL/pgSQL cria essas saídas como variáveis dentro da função, e qualquer
-- referência não qualificada a esses nomes (inclusive dentro de `on conflict (...)`)
-- fica ambígua. Renomeando as saídas para nomes que não existem em nenhuma tabela,
-- a ambiguidade deixa de ser possível — mais robusto do que qualificar cada uso.

drop function if exists create_room(text, text, text, text[], text);
drop function if exists join_room(text, text);

create or replace function create_room(
  p_name text,
  p_country text,
  p_mode text,
  p_genres text[],
  p_nickname text
)
returns table (out_room_id uuid, out_code text, out_participant_id uuid)
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
