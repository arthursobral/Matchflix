"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { WhereToWatch } from "@/components/WhereToWatch";
import { userMessage } from "@/lib/errors";
import { useMessages } from "@/components/LocaleProvider";
import { getMovieDetails, type MovieDetails } from "./data";
import styles from "./filme.module.css";

function formatRuntime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

export default function MovieDetailsPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const router = useRouter();
  const t = useMessages();
  const d = t.movieDetails;
  const lang = t.tmdbLanguage;
  // undefined = ainda carregando, null = não encontrado, objeto = carregado. Falha de rede
  // ou do catálogo é outra coisa (`error`): o filme pode existir.
  const [movie, setMovie] = useState<MovieDetails | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    getMovieDetails(tmdbId, lang)
      .then((result) => !cancelled && setMovie(result))
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
    // `lang`: ao trocar de idioma, os detalhes vêm de novo do TMDB no idioma escolhido.
  }, [tmdbId, lang]);

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
  if (movie === undefined && error === null) return <main className={styles.main}>{d.loading}</main>;
  if (!movie)
    return (
      <main className={styles.main}>
        <p role="alert">{error !== null ? userMessage(error, t) : d.notFound}</p>
        <div className={styles.actions}>{back}</div>
      </main>
    );

  return (
    <main className={styles.main}>
      <div className={styles.back}>{back}</div>

      <figure className={styles.visual}>
        {movie.posterUrl ? (
          // unoptimized: o TMDB já entrega o tamanho certo; passar pelo otimizador do Next deixava
          // o pôster mais lento (LCP 2,3s → 1,8s em 4G lento, medido) e gasta cota de imagem da Vercel.
          <Image
            src={movie.posterUrl}
            alt={t.posterAlt(movie.title)}
            width={300}
            height={450}
            className={styles.poster}
            priority
            unoptimized
          />
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
