/**
 * Pôsteres vetoriais fictícios do modo de demonstração. Ficam aqui, e não em Poster.tsx:
 * aquele é um componente de navegador ("use client"), e dados exportados de lá chegam
 * vazios às páginas do servidor (como a inicial).
 */
export const demoPosters = {
  silencio: { src: "/demo/silencio.svg", title: "Silêncio" },
  horizonte: { src: "/demo/horizonte.svg", title: "Horizonte" },
  ultimaSessao: { src: "/demo/ultima-sessao.svg", title: "A última sessão" },
} as const;

/** Filmes fictícios do modo de demonstração (M1). Substituídos por dados do TMDB no M4. */
export const demoMovies = [
  {
    id: "ultima-sessao",
    title: "A última sessão",
    meta: "Drama · 1h 48min · 2025",
    synopsis: "Na última noite de um cinema de bairro, três desconhecidos descobrem que algumas histórias merecem uma segunda sessão.",
    poster: demoPosters.ultimaSessao,
    halo: "red",
  },
  {
    id: "horizonte",
    title: "Horizonte",
    meta: "Aventura · 1h 52min · 2025",
    synopsis: "Uma viagem inesperada pelo deserto aproxima duas pessoas que procuravam caminhos completamente diferentes.",
    poster: demoPosters.horizonte,
    halo: "amber",
  },
  {
    id: "silencio",
    title: "Silêncio",
    meta: "Suspense · 1h 42min · 2025",
    synopsis: "Em uma cidade que nunca para, uma mensagem esquecida muda a rotina de uma restauradora de filmes.",
    poster: demoPosters.silencio,
    halo: "gray",
  },
] as const;

export const demoAvailability = { provider: "Prime Video", note: "Incluído na assinatura" } as const;
