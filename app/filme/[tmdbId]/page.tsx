"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { WhereToWatch } from "@/components/WhereToWatch";
import { ptBR as t } from "@/messages/pt-BR";
import { getMovieDetails, type MovieDetails } from "./data";
import styles from "./filme.module.css";

const d = t.movieDetails;

function formatRuntime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

export default function MovieDetailsPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const router = useRouter();
  // undefined = ainda carregando, null = não encontrado (mesmo valor que a função já usa
  // pra dizer isso), objeto = carregado — sem precisar de um estado de erro à parte.
  const [movie, setMovie] = useState<MovieDetails | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getMovieDetails(tmdbId)
      .then((result) => !cancelled && setMovie(result))
      .catch(() => !cancelled && setMovie(null));
    return () => {
      cancelled = true;
    };
  }, [tmdbId]);

  useEffect(() => {
    if (movie) document.title = `${movie.title} — Matchflix`;
  }, [movie]);

  const back = (
    <Button variant="secondary" onClick={() => router.back()}>
      {d.back}
    </Button>
  );

  // Estados de carregamento e "não encontrado" seguem o mesmo texto simples sem design
  // próprio usado em app/sala/[code]/page.tsx (M1) — esta tela também é um rascunho.
  if (movie === undefined) return <main className={styles.main}>{d.loading}</main>;
  if (movie === null)
    return (
      <main className={styles.main}>
        <p>{d.notFound}</p>
        <div className={styles.actions}>{back}</div>
      </main>
    );

  return (
    <main className={styles.main}>
      <div className={styles.back}>{back}</div>

      <figure className={styles.visual}>
        {movie.posterUrl ? (
          <Image src={movie.posterUrl} alt={`Pôster de ${movie.title}`} width={300} height={450} className={styles.poster} priority />
        ) : (
          <p className={styles.posterFallback}>{d.noPoster}</p>
        )}
      </figure>

      <div className={styles.head}>
        <p className="eyebrow">{d.eyebrow}</p>
        <h1>{movie.title}</h1>
        <p className={styles.meta}>
          {movie.genres.join(", ")} · {formatRuntime(movie.runtimeMinutes)} · {movie.year}
        </p>
        <p className={styles.synopsis}>{movie.synopsis}</p>

        <WhereToWatch providers={movie.providers} label={d.where} className={styles.where} />

        {/* Link obrigatório pelos termos do TMDB — sempre presente, com ou sem streaming. */}
        <div className={styles.actions}>
          <Button icon="link" variant="secondary" href={movie.tmdbUrl}>
            {d.tmdbLink}
          </Button>
        </div>
      </div>
    </main>
  );
}
