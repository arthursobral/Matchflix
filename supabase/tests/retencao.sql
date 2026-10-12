-- Roteiro de verificação de supabase/migrations/20261012120000_room_retention.sql.
-- Roda numa transação e desfaz tudo no fim (não deixa nada no banco). Contra o Supabase local:
--   cat supabase/tests/retencao.sql | docker exec -i supabase_db_sblocal psql -U postgres -v ON_ERROR_STOP=1
-- Qualquer `assert` que falhar interrompe com a mensagem do cenário.

begin;
delete from rooms; -- começa do zero (desfeito no rollback)

-- create_room como um usuário anônimo qualquer, do jeito que o app chama.
create function pg_temp.create_room_as_user() returns text language plpgsql as $$
declare v_code text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  select out_code into v_code from create_room('Teste', 'BR', 'remote', '{}', 'Teste');
  return v_code;
end $$;

-- Ocupa todos os 900 códigos com salas que venceram há `p_age` (negativo = ainda ativas).
create function pg_temp.fill_codes(p_age interval, p_except text default null) returns void language sql as $$
  insert into rooms (code, name, mode, host_user_id, expires_at)
  select 'MFX' || n, 'cheia', 'remote', gen_random_uuid(), now() - p_age
  from generate_series(100, 999) n
  where 'MFX' || n is distinct from p_except;
$$;

-- 1. Só some a sala vencida há mais de 24h, e com ela tudo que é dela.
do $$
declare v_old uuid; v_round uuid; v_part uuid;
begin
  insert into rooms (code, name, mode, host_user_id, expires_at)
  values ('MFX100', 'velha', 'remote', gen_random_uuid(), now() - interval '25 hours') returning id into v_old;
  insert into participants (room_id, user_id, nickname) values (v_old, gen_random_uuid(), 'A') returning id into v_part;
  insert into rounds (room_id) values (v_old) returning id into v_round;
  insert into round_movies (round_id, room_id, position, movie_id) values (v_round, v_old, 1, 'f1');
  insert into votes (round_id, room_id, participant_id, movie_id, approve) values (v_round, v_old, v_part, 'f1', true);
  insert into matches (round_id, room_id, movie_id) values (v_round, v_old, 'f1');
  insert into rooms (code, name, mode, host_user_id, expires_at) values ('MFX101', 'recente', 'remote', gen_random_uuid(), now() - interval '23 hours');
  insert into rooms (code, name, mode, host_user_id) values ('MFX102', 'ativa', 'remote', gen_random_uuid());

  assert delete_expired_rooms() = 1, '1: devia apagar só a sala vencida há mais de 24h';
  assert not exists (select 1 from rooms where id = v_old), '1: a sala velha continua lá';
  assert not exists (select 1 from participants where room_id = v_old), '1: participantes ficaram';
  assert not exists (select 1 from rounds where room_id = v_old), '1: rodadas ficaram';
  assert not exists (select 1 from round_movies where room_id = v_old), '1: baralho ficou';
  assert not exists (select 1 from votes where room_id = v_old), '1: votos ficaram';
  assert not exists (select 1 from matches where room_id = v_old), '1: matches ficaram';
  assert (select count(*) from rooms where code in ('MFX101', 'MFX102')) = 2, '1: apagou sala que ainda não devia';
  delete from rooms;
end $$;

-- 2. Todos os 900 códigos presos em salas velhas: criar sala ainda funciona (a limpeza roda antes do sorteio).
do $$
begin
  perform pg_temp.fill_codes(interval '25 hours');
  assert pg_temp.create_room_as_user() like 'MFX___', '2: não criou a sala';
  delete from rooms;
end $$;

-- 3. Só um código livre: o sorteio acha ele (antes eram 20 tentativas às cegas).
do $$
begin
  perform pg_temp.fill_codes(interval '-1 hour', 'MFX555');
  assert pg_temp.create_room_as_user() = 'MFX555', '3: não achou o único código livre';
  delete from rooms;
end $$;

-- 4. Nenhum código livre (900 salas ativas): erro claro, não um código repetido.
do $$
begin
  perform pg_temp.fill_codes(interval '-1 hour');
  begin
    perform pg_temp.create_room_as_user();
    assert false, '4: criou sala sem código livre';
  exception when others then
    assert sqlerrm = 'não há código de sala livre', '4: erro inesperado: ' || sqlerrm;
  end;
  delete from rooms;
end $$;

-- 5. As funções internas não ficam expostas pela API.
do $$
begin
  assert not has_function_privilege('anon', 'delete_expired_rooms()', 'execute'), '5: anon executa delete_expired_rooms';
  assert not has_function_privilege('authenticated', 'generate_room_code()', 'execute'), '5: authenticated executa generate_room_code';
end $$;

-- 6. O agendamento de hora em hora existe.
do $$
begin
  assert (select count(*) from cron.job where jobname = 'apagar-salas-expiradas' and schedule = '17 * * * *') = 1, '6: sem agendamento';
end $$;

rollback;
\echo 'retencao.sql: todos os cenários passaram'
