-- Troca de gênero da sala (pedido do usuário após o M6): na tela de fim de rodada, o
-- anfitrião pode mudar os gêneros antes de começar a próxima — por exemplo, perceber que
-- "ação" não está agradando a turma depois de 20 filmes e trocar para "romance". Mesmo
-- princípio das outras funções: o cliente pede, o servidor decide (só o anfitrião muda).

create or replace function update_room_genres(p_room_id uuid, p_genres text[])
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
    raise exception 'só o anfitrião pode trocar os gêneros';
  end if;

  update rooms
  set genres = coalesce(p_genres, '{}'), last_activity_at = now(), expires_at = now() + interval '1 hour'
  where id = p_room_id;
end;
$$;

grant execute on function update_room_genres(uuid, text[]) to anon, authenticated;
