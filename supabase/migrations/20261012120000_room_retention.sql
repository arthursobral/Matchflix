-- M8: retenção de dados e códigos de sala.
-- Sala expirada é apagada 24h depois de expirar, com participantes, rodadas, baralho,
-- votos e matches (tudo `on delete cascade`). As 24h dão margem para quem abrir um link
-- antigo ainda ver "sala expirada" em vez de "sala não encontrada".
--
-- Também é o que mantém a criação de sala funcionando: o código é "MFX" + 3 dígitos (só
-- 900 possíveis) e `rooms.code` é unique para sempre. Sem apagar salas antigas, depois de
-- ~900 salas na história do app ninguém mais cria sala.

create or replace function delete_expired_rooms()
returns int
language sql
security definer
set search_path = public
as $$
  with gone as (delete from rooms where expires_at < now() - interval '24 hours' returning 1)
  select count(*)::int from gone;
$$;

-- Sorteia entre os códigos livres (antes: 20 tentativas às cegas, que falhavam com o
-- espaço quase cheio, e ignoravam salas encerradas — que ainda ocupam o código).
-- Apaga as salas vencidas antes, para liberar códigos mesmo que o agendamento abaixo
-- não esteja rodando.
create or replace function generate_room_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  perform delete_expired_rooms();
  select c into v_code
  from (select 'MFX' || n as c from generate_series(100, 999) as n) codes
  where not exists (select 1 from rooms r where r.code = codes.c)
  order by random()
  limit 1;
  if v_code is null then
    raise exception 'não há código de sala livre';
  end if;
  return v_code;
end;
$$;

-- Só para uso interno (create_room e o agendamento), não pela API.
revoke execute on function delete_expired_rooms() from public, anon, authenticated;
revoke execute on function generate_room_code() from public, anon, authenticated;

-- De hora em hora, para cumprir as 24h mesmo quando ninguém está criando sala.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('apagar-salas-expiradas', '17 * * * *', 'select public.delete_expired_rooms()');
