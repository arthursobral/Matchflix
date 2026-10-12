import { ptBR as t } from "@/messages/pt-BR";

// Como cada navegador descreve "a requisição nem chegou ao servidor" (Chrome, Firefox,
// Safari, Node). O Supabase repassa esse texto cru, ex.: "TypeError: Failed to fetch".
const NETWORK_FAILURE = /Failed to fetch|NetworkError|Load failed|fetch failed|Network request failed/i;

/** Mensagem de um erro para mostrar na tela: falha de rede vira um aviso que a pessoa entende. */
export function userMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  return NETWORK_FAILURE.test(message) ? t.network.offline : message;
}
