"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PickableMovie } from "@/app/escolher/PickMovie";
import { useMessages } from "@/components/LocaleProvider";
import { userMessage } from "@/lib/errors";
import { countryLabel } from "@/lib/labels";
import { resolveMovie } from "@/lib/movies";
import { haloGradient, posterColor } from "@/lib/poster-color";
import { getCurrentRound, getRoomByCode, getRoundMatches, initialsOf, markMatchSeen } from "@/lib/rooms";
import { ensureAnonymousSession } from "@/lib/supabase/session";
import type { Messages } from "@/messages";
import { MatchView } from "../../MatchView";
import styles from "../../match.module.css";

type Loaded = {
  movie: PickableMovie;
  participants: { name: string; initials: string; host: boolean }[];
  countryCode: string;
  halo: string;
};

// Erros guardados como chave (ou o próprio erro) e traduzidos só na hora de mostrar.
const NOT_FOUND = "notFound";
const NOT_MATCH = "notMatch";

function providerLine(providers: PickableMovie["providers"], t: Messages) {
  for (const kind of ["flatrate", "rent", "buy"] as const) {
    const first = providers?.[kind][0];
    if (first) return { name: first.name, note: t.match.providerNote[kind] };
  }
  return null;
}

export default function RoomMatchPage() {
  const { code, movieId } = useParams<{ code: string; movieId: string }>();
  const t = useMessages();
  const lang = t.tmdbLanguage;
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [, result] = await Promise.all([ensureAnonymousSession(), getRoomByCode(code)]);
      if (!result) return setError(NOT_FOUND);
      const round = await getCurrentRound(result.room.id);
      if (!round) return setError(NOT_MATCH);
      const [matches, movie] = await Promise.all([getRoundMatches(round.id), resolveMovie(movieId, result.room.country, lang)]);
      if (!matches.includes(movieId) || !movie) return setError(NOT_MATCH);
      markMatchSeen(round.id, movieId);
      if (cancelled) return;
      setData({
        movie,
        participants: result.participants.map((p) => ({ name: p.nickname, initials: initialsOf(p.nickname), host: p.isHost })),
        countryCode: result.room.country,
        halo: `var(--halo-${movie.halo})`,
      });

      // A cor do halo entra quando o pôster chegar: a tela não espera por ela (um CDN de
      // imagens lento ou travado não pode deixar o match preso em "Carregando…").
      if (!movie.poster.src.startsWith("https://image.tmdb.org/")) return;
      const color = await posterColor(movie.poster.src);
      if (color && !cancelled) setData((d) => d && { ...d, halo: haloGradient(color) });
    })().catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
    // `lang`: ao trocar de idioma, título e sinopse vêm de novo do TMDB no idioma escolhido.
  }, [code, movieId, lang]);

  const title = t.match.title;
  useEffect(() => {
    if (data) document.title = `${title} — Matchflix`;
  }, [data, title]);

  // Carregando/erro: mesmo texto simples das outras telas de sala (sem design próprio ainda).
  if (error !== null)
    return (
      <main className={styles.main}>
        <p role="alert">{error === NOT_FOUND ? t.room.notFound : error === NOT_MATCH ? t.round.notMatch : userMessage(error, t)}</p>
      </main>
    );
  if (!data) return <main className={styles.main}>{t.room.loading}</main>;

  return (
    <MatchView
      movie={data.movie}
      participants={data.participants}
      country={countryLabel(data.countryCode, t)}
      provider={providerLine(data.movie.providers, t)}
      keepGoingHref={`/escolher/${code}`}
      haloBackground={data.halo}
      watchHref={data.movie.tmdbUrl}
    />
  );
}
