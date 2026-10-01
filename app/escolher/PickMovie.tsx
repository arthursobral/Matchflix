"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Poster, type PosterImage } from "@/components/Poster";
import { demoAvailability, demoMovies } from "@/lib/demo-movies";
import { demoRoom } from "@/lib/demo-room";
import { haloGradient, posterColor, type Rgb } from "@/lib/poster-color";
import { ptBR as t } from "@/messages/pt-BR";
import styles from "./escolher.module.css";

const p = t.pick;
const TOTAL = 20;
const FIRST = 4;
const SWIPE_DISTANCE = 90;

export type MovieProvider = { name: string; logoUrl: string };

export type PickableMovie = {
  id: string;
  title: string;
  meta: string;
  synopsis: string;
  poster: PosterImage;
  halo: "red" | "amber" | "gray";
  providers: { flatrate: MovieProvider[]; rent: MovieProvider[]; buy: MovieProvider[] } | null;
  /** Link para /filme/[tmdbId]; `null` para os filmes fictícios de demonstração. */
  detailsHref: string | null;
};

export type CrewMember = { name: string; initials: string; host: boolean; you: boolean };

/** Rodada de verdade (M5). Sem isso, a tela roda a demonstração fixa do M1. */
export type RoundInfo = {
  roomName: string;
  roundNumber: number;
  country: string;
  genres: string;
  participants: CrewMember[];
  /** Tamanho do baralho da rodada. */
  total: number;
  /** Quantos filmes a pessoa já tinha votado ao abrir a tela (retomada). */
  votedBefore: number;
  onVote: (movieId: string, approve: boolean) => void;
  /** Votou no último filme que faltava. */
  onDone: () => void;
};

type Props = {
  /** Filmes da rodada que a pessoa ainda não votou, na ordem sorteada pelo servidor. */
  movies?: PickableMovie[];
  round?: RoundInfo;
};

function demoAsPickable(m: (typeof demoMovies)[number]): PickableMovie {
  return { id: m.id, title: m.title, meta: m.meta, synopsis: m.synopsis, poster: m.poster, halo: m.halo, providers: null, detailsHref: null };
}

const isTmdbPoster = (src: string) => src.startsWith("https://image.tmdb.org/");

export function PickMovie({ movies: realMovies, round }: Props) {
  const router = useRouter();
  const isReal = !!round && !!realMovies;
  const movies = isReal ? realMovies! : demoMovies.map(demoAsPickable);
  const room = round
    ? { name: round.roomName, participants: round.participants, country: round.country, genres: round.genres }
    : demoRoom;
  const [step, setStep] = useState(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  // dx/dragging em estado só animam o arraste; a lógica usa refs, sempre síncronas
  // (o estado do React é de prioridade baixa para eventos de ponteiro e pode não ter
  // atualizado ainda quando o próximo evento dispara, sob uma máquina ocupada — o
  // pointermove seguinte leria "dragging" desatualizado, ou o pointerup leria "dx" velho).
  const dxRef = useRef(0);
  const isDraggingRef = useRef(false);
  // Mesmo motivo para o passo atual: dois votos rápidos (duas setas, clique duplo) antes de
  // o React re-renderizar leriam o mesmo passo — o segundo votaria de novo no mesmo filme e
  // o seguinte ficaria para trás sem voto, e a rodada nunca fecharia.
  const stepRef = useRef(0);
  const [exit, setExit] = useState<{ key: number; poster: PosterImage; fromDx: number; dir: 1 | -1 } | null>(null);

  const movie = movies[isReal ? Math.min(step, movies.length - 1) : step % movies.length];

  // Halo com a cor do pôster (M5). Os pôsteres de demonstração mantêm as cores do design.
  const [colors, setColors] = useState<Record<string, Rgb | null>>({});
  useEffect(() => {
    if (!realMovies) return;
    let cancelled = false;
    for (const m of realMovies) {
      if (!isTmdbPoster(m.poster.src)) continue;
      posterColor(m.poster.src).then((c) => !cancelled && setColors((prev) => ({ ...prev, [m.id]: c })));
    }
    return () => {
      cancelled = true;
    };
  }, [realMovies]);

  // fromDx: de onde o pôster deve continuar voando. Vem do arraste (dxRef.current, já
  // além do limiar) ou é 0 quando o voto veio do botão ou do teclado.
  function advance(approve: boolean, fromDx = 0) {
    const i = stepRef.current;
    if (round && i >= movies.length) return;
    const current = movies[round ? i : i % movies.length];
    if (!round && approve) {
      // Demonstração (M1): "Quero assistir" leva direto à tela de match fictícia.
      router.push("/match");
      return;
    }
    round?.onVote(current.id, approve);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) setExit({ key: Date.now(), poster: current.poster, fromDx, dir: approve ? 1 : -1 });
    stepRef.current = i + 1;
    setStep(i + 1);
    if (round && i + 1 >= movies.length) round.onDone();
  }
  const pass = (fromDx = 0) => advance(false, fromDx);
  const like = (fromDx = 0) => advance(true, fromDx);

  // O listener é registrado uma vez; o Effect Event sempre enxerga o render mais recente.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") pass();
    if (e.key === "ArrowRight") like();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  function endSwipe() {
    if (dxRef.current > SWIPE_DISTANCE) like(dxRef.current);
    else if (dxRef.current < -SWIPE_DISTANCE) pass(dxRef.current);
    dxRef.current = 0;
    isDraggingRef.current = false;
    setDx(0);
    setDragging(false);
  }

  const progress = round
    ? p.progress(Math.min(round.votedBefore + step + 1, round.total), round.total)
    : p.progress(Math.min(FIRST + step, TOTAL), TOTAL);

  return (
    <main className={styles.main}>
      <div className={styles.bar}>
        <p className={styles.room}>{room.name}</p>
        <p className={`${styles.round} `}>{p.round(round?.roundNumber ?? 1)}</p>
        <p className={`${styles.inRoom} mobile-only`}>{p.inRoom(room.participants.length)}</p>
        <p className={styles.progress}>{progress}</p>
      </div>

      <div className={styles.layout}>
        <aside className={`${styles.panel} desktop-only`} aria-label={p.crew}>
          <p className="eyebrow">{p.crew}</p>
          <ul>
            {room.participants.map((m, i) => (
              <li key={`${m.name}-${i}`}>
                <Avatar initials={m.initials} host={m.host} />
                <span>
                  <strong>{m.you ? p.you : m.name}</strong>
                  <small>{m.host ? t.room.host : t.room.ready}</small>
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.motto}>
            <p>{p.panelTitle[0]}</p>
            <p>{p.panelTitle[1]}</p>
            <small>{p.panelNote}</small>
          </div>
          <p className={`eyebrow ${styles.filters}`}>
            {room.country} · {room.genres}
          </p>
        </aside>

        <div className={styles.stage}>
          {movies.map((m) => {
            const color = colors[m.id];
            return (
              <div
                key={m.id}
                className={`${styles.halo} ${color ? "" : styles[m.halo]} ${m.id === movie.id ? styles.on : ""}`}
                style={color ? { background: haloGradient(color) } : undefined}
                data-halo={color ? color.join(" ") : m.halo}
                aria-hidden="true"
              />
            );
          })}
          {exit && <ExitingCard key={exit.key} poster={exit.poster} fromDx={exit.fromDx} dir={exit.dir} onDone={() => setExit(null)} />}
          <div
            key={step}
            className={`${styles.card} ${dragging ? styles.dragging : ""}`}
            style={{ transform: `translateX(${dx}px) rotate(${dx / 25}deg)` }}
            onPointerDown={(e) => {
              startX.current = e.clientX;
              isDraggingRef.current = true;
              setDragging(true);
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!isDraggingRef.current) return;
              dxRef.current = e.clientX - startX.current;
              setDx(dxRef.current);
            }}
            onPointerUp={endSwipe}
            onPointerCancel={endSwipe}
          >
            <Poster poster={movie.poster} className={styles.poster} priority />
          </div>
        </div>

        <section className={styles.detail} aria-live="polite">
          <p className={`eyebrow ${styles.suggest} desktop-only`}>{p.eyebrow}</p>
          <h1>{movie.title}</h1>
          <p className={styles.meta}>{movie.meta}</p>
          <p className={styles.synopsis}>{movie.synopsis}</p>
          <div className={styles.where}>
            <p className="eyebrow">
              {p.where} · {room.country}
            </p>
            <div className={styles.provider}>
              {isReal ? (
                movie.providers ? (
                  // O mesmo provedor costuma aparecer em mais de uma categoria (ex.: "Amazon
                  // Video" em aluguel e compra) — sem isso, a chave duplicada quebra o React.
                  [...new Map([...movie.providers.flatrate, ...movie.providers.rent, ...movie.providers.buy].map((prov) => [prov.name, prov])).values()]
                    .slice(0, 3)
                    .map((prov) => (
                      <span key={prov.name} className={styles.chip}>
                        {prov.name}
                      </span>
                    ))
                ) : (
                  <span>{p.noAvailability}</span>
                )
              ) : (
                <>
                  <span className={styles.chip}>{demoAvailability.provider}</span>
                  <span>{demoAvailability.note}</span>
                </>
              )}
            </div>
          </div>
          {movie.detailsHref ? (
            <Link href={movie.detailsHref} className={`${styles.more} desktop-only`}>
              {p.more} ↗
            </Link>
          ) : (
            <button type="button" className={`${styles.more} ${styles.moreDisabled} desktop-only`} aria-disabled="true" title={t.nav.soon}>
              {p.more} ↗
            </button>
          )}
        </section>

        <div className={styles.actions}>
          <div className={styles.buttons}>
            <Button icon="close" variant="secondary" onClick={() => pass()}>
              {p.pass}
            </Button>
            <Button icon="heart" onClick={() => like()}>
              {p.like}
            </Button>
          </div>
          <p className="desktop-only">
            <span>{p.hintDesktop[0]}</span>
            <span>{p.hintDesktop[1]}</span>
          </p>
          <p className="mobile-only">{p.hintMobile}</p>
        </div>
      </div>
    </main>
  );
}

const FLY_DISTANCE = 500;
const FLY_ROTATION = 18;

/**
 * O pôster que o voto tira de cena: para a esquerda ao passar, para a direita ao aprovar.
 * Continua a partir de onde o arraste soltou (`fromDx`, 0 quando veio de botão/teclado) em
 * vez de reiniciar do centro — a posição inicial é aplicada sem transição, e só no quadro
 * seguinte ligamos a transição até o destino final, técnica clássica para animar CSS a
 * partir de um valor dinâmico.
 */
function ExitingCard({
  poster,
  fromDx,
  dir,
  onDone,
}: {
  poster: PosterImage;
  fromDx: number;
  dir: 1 | -1;
  onDone: () => void;
}) {
  const [flown, setFlown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setFlown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const dx = flown ? fromDx + dir * FLY_DISTANCE : fromDx;
  const rotate = flown ? dir * FLY_ROTATION : fromDx / 25;

  return (
    <div
      className={`${styles.card} ${styles.exitCard}`}
      aria-hidden="true"
      onTransitionEnd={onDone}
      style={{
        transform: `translateX(${dx}px) rotate(${rotate}deg)`,
        opacity: flown ? 0 : 1,
        transition: flown ? "transform 280ms ease, opacity 280ms ease" : "none",
      }}
    >
      <Poster poster={poster} className={styles.poster} />
    </div>
  );
}
