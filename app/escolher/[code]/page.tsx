"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getActiveRound, getRoomByCode } from "@/lib/rooms";
import { ensureAnonymousSession } from "@/lib/supabase/session";
import { ptBR as t } from "@/messages/pt-BR";
import { PickMovie } from "../PickMovie";
import styles from "../escolher.module.css";

export default function PickPage() {
  const { code } = useParams<{ code: string }>();
  const [movieIds, setMovieIds] = useState<string[] | null>(null);
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
        setMovieIds(round.movieIds);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) return <main className={styles.main}>{error}</main>;
  if (!movieIds) return <main className={styles.main}>{t.room.loading}</main>;

  return <PickMovie movieIds={movieIds} />;
}
