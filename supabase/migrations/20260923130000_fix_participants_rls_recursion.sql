-- Corrige "infinite recursion detected in policy for relation participants".
--
-- A política de leitura de `participants` fazia uma subconsulta na própria tabela para
-- checar se quem pergunta já é participante da sala. Como a RLS reaplica a política a
-- cada consulta contra a tabela — inclusive às que acontecem dentro da própria política —
-- essa subconsulta reentra em si mesma indefinidamente. A política de `rooms` tinha o
-- mesmo problema de um jeito indireto, porque também consultava `participants` direto.
--
-- Correção padrão do Postgres/Supabase: mover a checagem para uma função
-- `security definer`, que roda como dona das tabelas e por isso não é afetada pela RLS
-- por dentro — quebrando o ciclo.

create or replace function is_room_participant(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from participants
    where room_id = p_room_id
      and user_id = auth.uid()
      and removed_at is null
  );
$$;

drop policy if exists "participantes leem a própria sala" on rooms;
create policy "participantes leem a própria sala"
  on rooms for select
  using (is_room_participant(id));

drop policy if exists "participantes leem a lista da própria sala" on participants;
create policy "participantes leem a lista da própria sala"
  on participants for select
  using (is_room_participant(room_id));
