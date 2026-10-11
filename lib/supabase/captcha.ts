const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

interface TurnstileOptions {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  callback: (token: string) => void;
  "error-callback"?: () => void;
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
      script.onerror = () => reject(new Error("Não foi possível carregar a verificação de segurança."));
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
export async function getCaptchaToken(): Promise<string | undefined> {
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!sitekey) return undefined;

  await loadTurnstileScript();

  return new Promise((resolve, reject) => {
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      display: "none",
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
    document.body.appendChild(overlay);

    const cleanup = (widgetId: string) => {
      window.turnstile?.remove(widgetId);
      overlay.remove();
    };

    const widgetId = window.turnstile!.render(box, {
      sitekey,
      theme: "dark",
      "before-interactive-callback": () => {
        overlay.style.display = "flex";
      },
      callback: (token) => {
        cleanup(widgetId);
        resolve(token);
      },
      "error-callback": () => {
        cleanup(widgetId);
        reject(new Error("Verificação de segurança falhou. Tente de novo."));
      },
    });
  });
}
