import type { PickableMovie } from "@/app/escolher/PickMovie";
import { demoMovies } from "./demo-movies";

type MovieDetailsResponse = {
  id: string;
  title: string;
  synopsis: string;
  genres: string[];
  runtimeMinutes: number;
  year: number;
  posterUrl: string | null;
  tmdbUrl: string;
  providers: PickableMovie["providers"];
};

function formatMeta(m: MovieDetailsResponse): string {
  const duration = m.runtimeMinutes > 0 ? `${Math.floor(m.runtimeMinutes / 60)}h ${m.runtimeMinutes % 60}min` : null;
  return [m.genres[0], duration, m.year || null].filter(Boolean).join(" · ");
}

/**
 * Um id pode ser de um filme real do TMDB ou, se `TMDB_API_KEY` não estiver configurada
 * (ver `app/api/movies/route.ts`), de um dos filmes fictícios do M1 — resolvido primeiro,
 * sem ir à rede.
 */
export async function resolveMovie(id: string, country: string): Promise<PickableMovie | null> {
  const demo = demoMovies.find((m) => m.id === id);
  if (demo)
    return {
      id: demo.id,
      title: demo.title,
      meta: demo.meta,
      synopsis: demo.synopsis,
      poster: demo.poster,
      halo: demo.halo,
      providers: null,
      detailsHref: null,
    };

  const res = await fetch(`/api/movies/${id}?country=${country}`);
  if (!res.ok) return null;
  const details = (await res.json()) as MovieDetailsResponse;
  return {
    id: details.id,
    title: details.title,
    meta: formatMeta(details),
    synopsis: details.synopsis,
    // O baralho já descarta filmes sem pôster (lib/catalog.ts); isso só cobre o TMDB mudar depois.
    poster: details.posterUrl ? { src: details.posterUrl, title: details.title } : { src: "/demo/horizonte.svg", title: details.title },
    halo: "gray",
    providers: details.providers,
    detailsHref: `/filme/${details.id}`,
  };
}
