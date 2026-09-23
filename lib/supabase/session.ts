import { getSupabase } from "./client";

/**
 * Garante uma sessão anônima e devolve o user_id, que identifica o participante
 * entre recarregamentos da página (ver docs/m0-arquitetura.md, seção 3).
 * Exige o login anônimo habilitado no projeto Supabase (Authentication → Providers).
 */
export async function ensureAnonymousSession(): Promise<string> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error("Não foi possível iniciar a sessão. Verifique se o login anônimo está habilitado no projeto Supabase.");
  }
  return data.user.id;
}
