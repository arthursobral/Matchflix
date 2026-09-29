-- M3: início de rodada controlado pelo servidor. Só o anfitrião pode iniciar; o cliente
-- nunca decide isso sozinho (mesmo princípio de create_room/join_room, ver docs/m0).

create or replace function start_round(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room rooms%rowtype;
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

  update rooms set status = 'voting', last_activity_at = now() where id = p_room_id;
end;
$$;

grant execute on function start_round(uuid) to anon, authenticated;
