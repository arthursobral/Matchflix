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
    const reason = error?.message ?? "resposta sem usuário";
    throw new Error(`Não foi possível iniciar a sessão (${reason}). Verifique a URL/chave do Supabase e se o login anônimo está habilitado.`);
  }
  return data.user.id;
}
