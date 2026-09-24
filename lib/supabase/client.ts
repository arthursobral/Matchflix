import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Cliente do Supabase, criado só na primeira vez que alguém precisa dele — não no
 * carregamento do módulo. Assim a página renderiza normalmente mesmo sem as variáveis
 * de ambiente configuradas (ex.: no build do CI), e o erro só aparece quando uma ação
 * real (criar ou entrar numa sala) tenta falar com o backend.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (veja .env.example).",
    );
  }
  client = createClient(url, key);
  return client;
}
