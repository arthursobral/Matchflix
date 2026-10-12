const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const TOO_SLOW = "A verificação de segurança demorou demais. Confira sua conexão e tente de novo.";

interface TurnstileOptions {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  retry?: "auto" | "never";
  callback: (token: string) => void;
  "error-callback"?: (code: string) => void;
  "timeout-callback"?: () => void;
  "before-interactive-callback"?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: TurnstileOptions): string;
      remove(widgetId: string): void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      if (window.turnstile) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = TURNSTILE_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null; // senão o erro fica memorizado e o "tente de novo" nunca funciona
        reject(new Error("Não foi possível carregar a verificação de segurança. Confira sua conexão e tente de novo."));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * Token do Cloudflare Turnstile, exigido pelo Supabase antes do login anônimo (M8,
 * proteção contra abuso). A verificação normalmente resolve sozinha, sem interação;
 * só aparece um quadro visível se o Turnstile considerar a sessão suspeita.
 * Sem NEXT_PUBLIC_TURNSTILE_SITE_KEY configurada, resolve undefined (ex.: dev local
 * com o captcha desligado no painel do Supabase).
 */
export function getCaptchaToken(timeoutMs = 15_000): Promise<string | undefined> {
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!sitekey) return Promise.resolve(undefined);

  return new Promise((resolve, reject) => {
    // Escondido por opacidade, não display:none (o widget do Turnstile pode falhar assim).
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      display: "flex",
      opacity: "0",
      pointerEvents: "none",
      alignItems: "center",
      justifyContent: "center",
      background: "rgb(22 22 24 / 0.85)",
      zIndex: "9999",
    });
    const box = document.createElement("div");
    Object.assign(box.style, {
      padding: "20px",
      borderRadius: "8px",
      background: "var(--surface, #222225)",
      border: "1px solid var(--border, #3b3839)",
    });
    overlay.appendChild(box);
    // Dentro do <dialog> aberto, se houver (ex.: modal do apelido): o dialog fica numa camada
    // acima de tudo e deixa o resto da página inerte — fora dele, o desafio ficaria escondido
    // atrás do modal e sem poder ser clicado.
    (document.querySelector("dialog[open]") ?? document.body).appendChild(overlay);

    let widgetId: string | undefined;
    let done = false;
    const finish = (settle: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (widgetId) window.turnstile?.remove(widgetId);
      overlay.remove();
      settle();
    };
    const fail = (message: string) => finish(() => reject(new Error(message)));

    // Se o Cloudflare não responder (rede instável, bloqueador), ninguém chama de volta:
    // sem esse limite a pessoa ficaria presa em "Entrando…" para sempre.
    const timer = setTimeout(() => fail(TOO_SLOW), timeoutMs);

    loadTurnstileScript().then(
      () => {
        if (done) return;
        widgetId = window.turnstile!.render(box, {
          sitekey,
          theme: "dark",
          // Quem tenta de novo é o app (botão), não o Turnstile: sozinho, ele tentava
          // reiniciar um widget que já tinha sido removido e soltava um erro no console.
          retry: "never",
          "before-interactive-callback": () => {
            // Agora depende da pessoa resolver o desafio; o próprio Turnstile avisa se expirar.
            clearTimeout(timer);
            overlay.style.opacity = "1";
            overlay.style.pointerEvents = "auto";
          },
          callback: (token) => finish(() => resolve(token)),
          "error-callback": (code) => {
            console.error("Turnstile error", code);
            fail(`Verificação de segurança falhou (erro ${code}). Tente de novo.`);
          },
          "timeout-callback": () => fail(TOO_SLOW),
        });
      },
      (e: Error) => fail(e.message),
    );
  });
}
