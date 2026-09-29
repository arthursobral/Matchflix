export type Provider = { name: string; logoUrl: string };

type Movie = {
  id: string;
  title: string;
  synopsis: string;
  genres: string[];
  runtimeMinutes: number;
  year: number;
  posterUrl: string | null;
  providers: {
    flatrate: Provider[];
    rent: Provider[];
    buy: Provider[];
    tmdbUrl: string;
  } | null;
};

export type MovieDetails = Movie | null;

// MOCK TEMPORÁRIO (rascunho da tela, ver AGENTS.md/instruções da tarefa): dados fixos só
// para construir e testar essa página de forma independente. Quando `GET /api/movies/[tmdbId]`
// existir (em construção em paralelo, no branch principal), troca-se o corpo desta função por
// um `fetch` para lá — a assinatura e o formato de retorno (MovieDetails) já seguem o contrato
// combinado, então o resto da página não deve precisar mudar.
const demoDetails: Record<string, Movie> = {
  "101": {
    id: "101",
    title: "Depois da Meia-Noite",
    synopsis:
      "Um segurança noturno descobre que o prédio onde trabalha guarda um segredo que atravessa décadas. Enquanto tenta avisar os moradores, precisa decidir em quem confiar antes do amanhecer.",
    genres: ["Suspense", "Drama"],
    runtimeMinutes: 118,
    year: 2024,
    posterUrl: "https://image.tmdb.org/t/p/w500/depois-da-meia-noite.jpg",
    providers: {
      flatrate: [
        { name: "Netflix", logoUrl: "https://image.tmdb.org/t/p/w92/netflix.png" },
        { name: "Prime Video", logoUrl: "https://image.tmdb.org/t/p/w92/prime-video.png" },
      ],
      rent: [{ name: "Google Play Filmes", logoUrl: "https://image.tmdb.org/t/p/w92/google-play.png" }],
      buy: [{ name: "Apple TV", logoUrl: "https://image.tmdb.org/t/p/w92/apple-tv.png" }],
      tmdbUrl: "https://www.themoviedb.org/movie/101",
    },
  },
  "202": {
    id: "202",
    title: "Maré Alta",
    synopsis:
      "Duas irmãs que não se falam há anos são forçadas a dividir a casa de praia da família por um verão inteiro, enquanto decidem o que fazer com o que restou dela.",
    genres: ["Drama", "Romance"],
    runtimeMinutes: 104,
    year: 2023,
    posterUrl: "https://image.tmdb.org/t/p/w500/mare-alta.jpg",
    providers: null,
  },
  "303": {
    id: "303",
    title: "Sala 4",
    synopsis:
      "No último cinema de rua da cidade, um projecionista relutante treina a substituta que vai fechar as portas depois dele — e descobre que ainda tem uma última sessão para mostrar.",
    genres: ["Drama", "Comédia"],
    runtimeMinutes: 96,
    year: 2025,
    posterUrl: null,
    providers: {
      flatrate: [],
      rent: [{ name: "Google Play Filmes", logoUrl: "https://image.tmdb.org/t/p/w92/google-play.png" }],
      buy: [{ name: "Apple TV", logoUrl: "https://image.tmdb.org/t/p/w92/apple-tv.png" }],
      tmdbUrl: "https://www.themoviedb.org/movie/303",
    },
  },
};

export async function getMovieDetails(tmdbId: string): Promise<MovieDetails> {
  return demoDetails[tmdbId] ?? null;
}
