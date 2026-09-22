"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Poster } from "@/components/Poster";
import { demoAvailability, demoMovies } from "@/lib/demo-movies";
import { demoRoom as room } from "@/lib/demo-room";
import { ptBR as t } from "@/messages/pt-BR";
import styles from "./escolher.module.css";

const p = t.pick;
const TOTAL = 20;
const FIRST = 4;
const SWIPE_DISTANCE = 90;

export function PickMovie() {
  const router = useRouter();
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

  const movie = demoMovies[step % demoMovies.length];
  const pass = useCallback(() => setStep((s) => s + 1), []);
  // M1: "Quero assistir" leva direto à tela de match de demonstração; o voto real é do M5.
  const like = useCallback(() => router.push("/match"), [router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") pass();
      if (e.key === "ArrowRight") like();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pass, like]);

  function endSwipe() {
    if (dxRef.current > SWIPE_DISTANCE) like();
    else if (dxRef.current < -SWIPE_DISTANCE) pass();
    dxRef.current = 0;
    isDraggingRef.current = false;
    setDx(0);
    setDragging(false);
  }

  return (
    <main className={styles.main}>
      <div className={styles.bar}>
        <p className={styles.room}>{room.name}</p>
        <p className={`${styles.round} `}>{p.round(1)}</p>
        <p className={`${styles.inRoom} mobile-only`}>{p.inRoom(room.participants.length)}</p>
        <p className={styles.progress}>{p.progress(Math.min(FIRST + step, TOTAL), TOTAL)}</p>
      </div>

      <div className={styles.layout}>
        <aside className={`${styles.panel} desktop-only`} aria-label={p.crew}>
          <p className="eyebrow">{p.crew}</p>
          <ul>
            {room.participants.map((m) => (
              <li key={m.name}>
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
          {demoMovies.map((m) => (
            <div key={m.id} className={`${styles.halo} ${styles[m.halo]} ${m.id === movie.id ? styles.on : ""}`} aria-hidden="true" />
          ))}
          <div
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
              <span className={styles.chip}>{demoAvailability.provider}</span>
              <span>{demoAvailability.note}</span>
            </div>
          </div>
          <button type="button" className={`${styles.more} desktop-only`} aria-disabled="true" title={t.nav.soon}>
            {p.more} ↗
          </button>
        </section>

        <div className={styles.actions}>
          <div className={styles.buttons}>
            <Button icon="close" variant="secondary" onClick={pass}>
              {p.pass}
            </Button>
            <Button icon="heart" onClick={like}>
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
