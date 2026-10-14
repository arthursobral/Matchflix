import { CatalogUnavailableError } from "@/lib/errors";

export type Provider = { name: string; logoUrl: string };

export type MovieDetails = {
  id: string;
  title: string;
  synopsis: string;
  genres: string[];
  runtimeMinutes: number;
  year: number;
  posterUrl: string | null;
  tmdbUrl: string;
  providers: { flatrate: Provider[]; rent: Provider[]; buy: Provider[] } | null;
} | null;

/** Único país hoje suportado pelo app (ver messages/pt-BR.ts `create.country.options`). `null` = não existe; catálogo fora do ar rejeita. */
export async function getMovieDetails(tmdbId: string, lang: string, country = "BR"): Promise<MovieDetails> {
  const res = await fetch(`/api/movies/${tmdbId}?country=${country}&lang=${lang}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new CatalogUnavailableError(`/api/movies/${tmdbId} respondeu ${res.status}`);
  return res.json();
}
