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

/** Único país hoje suportado pelo app (ver messages/pt-BR.ts `create.country.options`). */
export async function getMovieDetails(tmdbId: string, country = "BR"): Promise<MovieDetails> {
  const res = await fetch(`/api/movies/${tmdbId}?country=${country}`);
  if (!res.ok) return null;
  return res.json();
}
