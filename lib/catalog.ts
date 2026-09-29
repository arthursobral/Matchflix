/**
 * Único módulo que fala com o TMDB (docs/m0-arquitetura.md, seção 6). Só é importado por
 * rotas Next.js (`app/api/movies/**`), nunca por código de cliente — a chave nunca deve
 * ir para o bundle do navegador.
 */

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

/** Gêneros do app (ver messages/pt-BR.ts `create.genres.options`) → id do gênero no TMDB. */
const GENRE_IDS: Record<string, number> = {
  acao: 28,
  aventura: 12,
  comedia: 35,
  drama: 18,
  romance: 10749,
  suspense: 53,
  terror: 27,
  "ficcao-cientifica": 878,
  animacao: 16,
  documentario: 99,
  fantasia: 14,
};

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY não configurada");
  return key;
}

async function tmdbFetch(path: string, params: Record<string, string>) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Cache de 1h: bem abaixo do limite de retenção de 6 meses do TMDB, e evita bater na
  // API a cada requisição para os filmes mais populares (os mesmos circulam bastante).
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB ${path} respondeu ${res.status}`);
  return res.json();
}

/**
 * Ids de filmes candidatos para o baralho da rodada: populares, com pôster, nos gêneros
 * pedidos (vazio = todos), excluindo quem já apareceu nessa sala (docs/m0, seção 6).
 */
export async function discoverMovieIds(opts: { genres: string[]; exclude: string[]; count?: number }): Promise<string[]> {
  const count = opts.count ?? 20;
  const genreIds = opts.genres.map((g) => GENRE_IDS[g]).filter((id): id is number => id !== undefined);
  const excluded = new Set(opts.exclude);
  const seen = new Set<string>();
  const found: string[] = [];

  for (let page = 1; page <= 10 && found.length < count; page++) {
    const data = await tmdbFetch("/discover/movie", {
      language: "pt-BR",
      sort_by: "popularity.desc",
      include_adult: "false",
      "vote_count.gte": "200",
      page: String(page),
      ...(genreIds.length > 0 ? { with_genres: genreIds.join(",") } : {}),
    });
    const results = (data.results ?? []) as { id: number; poster_path: string | null }[];
    for (const m of results) {
      const id = String(m.id);
      if (!m.poster_path || excluded.has(id) || seen.has(id)) continue;
      seen.add(id);
      found.push(id);
      if (found.length >= count) break;
    }
    if (page >= (data.total_pages ?? 0)) break;
  }
  return found;
}

export type MovieProvider = { name: string; logoUrl: string };

export type MovieDetails = {
  id: string;
  title: string;
  synopsis: string;
  genres: string[];
  runtimeMinutes: number;
  year: number;
  posterUrl: string | null;
  // Link para a página do filme no TMDB — obrigatório pelos termos de uso independente de
  // haver disponibilidade de streaming ou não, por isso fica fora de `providers`.
  tmdbUrl: string;
  providers: { flatrate: MovieProvider[]; rent: MovieProvider[]; buy: MovieProvider[] } | null;
};

/** Detalhes completos de um filme e onde assistir no país pedido; `null` se não existir. */
export async function getMovieDetails(tmdbId: string, opts: { lang: string; country: string }): Promise<MovieDetails | null> {
  let movie: {
    id: number;
    title: string;
    overview: string;
    genres?: { name: string }[];
    runtime?: number;
    release_date?: string;
    poster_path: string | null;
  };
  try {
    movie = await tmdbFetch(`/movie/${tmdbId}`, { language: opts.lang });
  } catch {
    return null;
  }

  type RawProviderList = { provider_name: string; logo_path: string }[];
  type CountryProviders = { flatrate?: RawProviderList; rent?: RawProviderList; buy?: RawProviderList };

  let providers: MovieDetails["providers"] = null;
  try {
    const wp = await tmdbFetch(`/movie/${tmdbId}/watch/providers`, {});
    const forCountry = wp.results?.[opts.country] as CountryProviders | undefined;
    if (forCountry) {
      const mapProviders = (list?: RawProviderList): MovieProvider[] =>
        (list ?? []).map((p) => ({ name: p.provider_name, logoUrl: `${IMAGE_BASE}/w92${p.logo_path}` }));
      const flatrate = mapProviders(forCountry.flatrate);
      const rent = mapProviders(forCountry.rent);
      const buy = mapProviders(forCountry.buy);
      if (flatrate.length || rent.length || buy.length) providers = { flatrate, rent, buy };
    }
  } catch {
    // Sem disponibilidade não é um erro fatal para a tela — só fica sem providers.
  }

  return {
    id: String(movie.id),
    title: movie.title,
    synopsis: movie.overview,
    genres: (movie.genres ?? []).map((g) => g.name),
    runtimeMinutes: movie.runtime ?? 0,
    year: movie.release_date ? new Date(movie.release_date).getFullYear() : 0,
    posterUrl: movie.poster_path ? `${IMAGE_BASE}/w500${movie.poster_path}` : null,
    tmdbUrl: `https://www.themoviedb.org/movie/${movie.id}`,
    providers,
  };
}
