"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { demoMovies } from "@/lib/demo-movies";
import { getActiveRound, getRoomByCode } from "@/lib/rooms";
import { ensureAnonymousSession } from "@/lib/supabase/session";
import { ptBR as t } from "@/messages/pt-BR";
import { PickMovie, type PickableMovie } from "../PickMovie";
import styles from "../escolher.module.css";

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
  const hours = Math.floor(m.runtimeMinutes / 60);
  const minutes = m.runtimeMinutes % 60;
  const duration = m.runtimeMinutes > 0 ? `${hours}h ${minutes}min` : null;
  return [m.genres[0], duration, m.year || null].filter(Boolean).join(" · ");
}

/**
 * Um id pode ser de um filme real do TMDB ou, se `TMDB_API_KEY` não estiver configurada
 * (ver `app/api/movies/route.ts`), de um dos filmes fictícios do M1 — resolvido primeiro,
 * sem round-trip nenhum.
 */
async function resolveMovie(id: string, country: string): Promise<PickableMovie | null> {
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
    // Extração de cor do pôster é do M5; por ora todo filme real usa o mesmo halo neutro.
    poster: details.posterUrl ? { src: details.posterUrl, title: details.title } : { src: "/demo/horizonte.svg", title: details.title },
    halo: "gray",
    providers: details.providers,
    detailsHref: `/filme/${details.id}`,
  };
}

export default function PickPage() {
  const { code } = useParams<{ code: string }>();
  const [movies, setMovies] = useState<PickableMovie[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([ensureAnonymousSession(), getRoomByCode(code)])
      .then(async ([, result]) => {
        if (cancelled) return;
        if (!result) {
          setError(t.room.notFound);
          return;
        }
        const round = await getActiveRound(result.room.id);
        if (cancelled) return;
        if (!round) {
          setError(t.room.notFound);
          return;
        }
        const resolved = await Promise.all(round.movieIds.map((id) => resolveMovie(id, result.room.country)));
        if (cancelled) return;
        setMovies(resolved.filter((m): m is PickableMovie => m !== null));
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) return <main className={styles.main}>{error}</main>;
  if (!movies) return <main className={styles.main}>{t.room.loading}</main>;

  return <PickMovie movies={movies} />;
}
