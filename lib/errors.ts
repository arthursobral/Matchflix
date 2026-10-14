import type { Messages } from "@/messages";

/** O TMDB (por trás de /api/movies) não respondeu — diferente de o filme não existir. */
export class CatalogUnavailableError extends Error {}

/** O login anônimo do Supabase falhou (o motivo técnico fica na mensagem, para o console). */
export class SessionError extends Error {}

/** A verificação do Cloudflare Turnstile não deu certo. */
export class CaptchaError extends Error {
  constructor(
    readonly kind: "slow" | "load" | "failed",
    readonly code = "",
  ) {
    super(`captcha ${kind} ${code}`.trim());
  }
}

// Como cada navegador descreve "a requisição nem chegou ao servidor" (Chrome, Firefox,
// Safari, Node). O Supabase repassa esse texto cru, ex.: "TypeError: Failed to fetch".
const NETWORK_FAILURE = /Failed to fetch|NetworkError|Load failed|fetch failed|Network request failed/i;

/**
 * Mensagem de um erro para mostrar na tela, no idioma escolhido. Falha de rede e os erros
 * conhecidos viram um aviso que a pessoa entende; o resto vira o "algo deu errado" genérico
 * (o detalhe técnico, quase sempre em português e vindo do banco, vai só para o console).
 */
export function userMessage(e: unknown, t: Messages): string {
  const message = e instanceof Error ? e.message : String(e);
  if (NETWORK_FAILURE.test(message)) return t.network.offline;
  if (e instanceof CatalogUnavailableError) return t.network.catalog;
  if (e instanceof CaptchaError) {
    if (e.kind === "slow") return t.errors.captchaSlow;
    if (e.kind === "load") return t.errors.captchaLoad;
    return t.errors.captchaFailed(e.code);
  }
  if (e instanceof SessionError) return t.errors.session;
  console.error(e);
  return t.status.error.lead;
}
