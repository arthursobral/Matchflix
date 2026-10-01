"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PickableMovie } from "@/app/escolher/PickMovie";
import { countryLabel } from "@/lib/labels";
import { resolveMovie } from "@/lib/movies";
import { haloGradient, posterColor } from "@/lib/poster-color";
import { getCurrentRound, getRoomByCode, getRoundMatches, initialsOf, markMatchSeen } from "@/lib/rooms";
import { ensureAnonymousSession } from "@/lib/supabase/session";
import { ptBR as t } from "@/messages/pt-BR";
import { MatchView } from "../../MatchView";
import styles from "../../match.module.css";

type Loaded = {
  movie: PickableMovie;
  participants: { name: string; initials: string; host: boolean }[];
  country: string;
  halo: string;
};

function providerLine(providers: PickableMovie["providers"]) {
  const notes = t.match.providerNote;
  for (const kind of ["flatrate", "rent", "buy"] as const) {
    const first = providers?.[kind][0];
    if (first) return { name: first.name, note: notes[kind] };
  }
  return null;
}

export default function RoomMatchPage() {
  const { code, movieId } = useParams<{ code: string; movieId: string }>();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureAnonymousSession();
      const result = await getRoomByCode(code);
      if (!result) return setError(t.room.notFound);
      const round = await getCurrentRound(result.room.id);
      if (!round || !(await getRoundMatches(round.id)).includes(movieId)) return setError(t.round.notMatch);
      const movie = await resolveMovie(movieId, result.room.country);
      if (!movie) return setError(t.round.notMatch);
      markMatchSeen(round.id, movieId);

      const color = movie.poster.src.startsWith("https://image.tmdb.org/") ? await posterColor(movie.poster.src) : null;
      if (cancelled) return;
      document.title = `${t.match.title} — Matchflix`;
      setData({
        movie,
        participants: result.participants.map((p) => ({ name: p.nickname, initials: initialsOf(p.nickname), host: p.isHost })),
        country: countryLabel(result.room.country),
        halo: color ? haloGradient(color) : `var(--halo-${movie.halo})`,
      });
    })().catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [code, movieId]);

  // Carregando/erro: mesmo texto simples das outras telas de sala (sem design próprio ainda).
  if (error) return <main className={styles.main}>{error}</main>;
  if (!data) return <main className={styles.main}>{t.room.loading}</main>;

  return (
    <MatchView
      movie={data.movie}
      participants={data.participants}
      country={data.country}
      provider={providerLine(data.movie.providers)}
      keepGoingHref={`/escolher/${code}`}
      haloBackground={data.halo}
      watchHref={data.movie.tmdbUrl}
    />
  );
}
