"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PickableMovie } from "@/app/escolher/PickMovie";
import { userMessage } from "@/lib/errors";
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
      const [, result] = await Promise.all([ensureAnonymousSession(), getRoomByCode(code)]);
      if (!result) return setError(t.room.notFound);
      const round = await getCurrentRound(result.room.id);
      if (!round) return setError(t.round.notMatch);
      const [matches, movie] = await Promise.all([getRoundMatches(round.id), resolveMovie(movieId, result.room.country)]);
      if (!matches.includes(movieId) || !movie) return setError(t.round.notMatch);
      markMatchSeen(round.id, movieId);
      if (cancelled) return;
      document.title = `${t.match.title} — Matchflix`;
      setData({
        movie,
        participants: result.participants.map((p) => ({ name: p.nickname, initials: initialsOf(p.nickname), host: p.isHost })),
        country: countryLabel(result.room.country),
        halo: `var(--halo-${movie.halo})`,
      });

      // A cor do halo entra quando o pôster chegar: a tela não espera por ela (um CDN de
      // imagens lento ou travado não pode deixar o match preso em "Carregando…").
      if (!movie.poster.src.startsWith("https://image.tmdb.org/")) return;
      const color = await posterColor(movie.poster.src);
      if (color && !cancelled) setData((d) => d && { ...d, halo: haloGradient(color) });
    })().catch((e) => !cancelled && setError(userMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [code, movieId]);

  // Carregando/erro: mesmo texto simples das outras telas de sala (sem design próprio ainda).
  if (error)
    return (
      <main className={styles.main}>
        <p role="alert">{error}</p>
      </main>
    );
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
