-- Corrige "column reference "code" is ambiguous" em join_room.
--
-- A função devolve uma coluna chamada `code` (returns table (room_id uuid, code text, ...)),
-- e o PL/pgSQL cria essa saída como uma variável de mesmo nome dentro da função. A cláusula
-- `where code = ...` ficava ambígua entre essa variável e a coluna `rooms.code`. Basta
-- qualificar com o nome da tabela.

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

grant execute on function join_room(text, text) to anon, authenticated;
