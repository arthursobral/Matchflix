"use client";

// Só aparece se o próprio layout raiz quebrar: substitui o documento inteiro, sem o CSS
// global — por isso as cores do tema vão direto aqui.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: "100vh", background: "#161618", color: "#eeecea", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center" }}>
        <title>Algo deu errado — Matchflix</title>
        <main style={{ padding: 24, maxWidth: 420 }}>
          <h1 style={{ font: "400 33px/40px Georgia, serif", margin: 0 }}>Algo deu errado.</h1>
          <p role="alert" style={{ color: "#aaa5a1" }}>
            Recarregue a página. Se continuar acontecendo, tente de novo em alguns minutos.
          </p>
          <button
            type="button"
            onClick={retry}
            style={{ padding: "14px 22px", border: 0, borderRadius: 10, background: "#a52a3a", color: "#eeecea", font: "inherit", cursor: "pointer" }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
