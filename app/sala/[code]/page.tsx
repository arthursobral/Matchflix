"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { CopyInviteButton } from "@/components/CopyInviteButton";
import {
  getRoomByCode,
  formatRoomCode,
  initialsOf,
  startRound,
  subscribeToParticipants,
  subscribeToRoom,
  type Participant,
  type Room,
} from "@/lib/rooms";
import { ensureAnonymousSession } from "@/lib/supabase/session";
import { demoMovies } from "@/lib/demo-movies";
import { ptBR as t } from "@/messages/pt-BR";
import styles from "./sala.module.css";

const r = t.room;

function countryLabel(value: string) {
  return t.create.country.options.find((o) => o.value === value)?.label ?? value;
}

function genresLabel(genres: string[]) {
  if (genres.length === 0) return r.allGenres;
  return genres.map((g) => t.create.genres.options.find((o) => o.value === g)?.label ?? g).join(", ");
}

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([ensureAnonymousSession(), getRoomByCode(code)])
      .then(([uid, result]) => {
        if (cancelled) return;
        if (!result) {
          setError(r.notFound);
          return;
        }
        setUserId(uid);
        setRoom(result.room);
        setParticipants(result.participants);
        document.title = `${result.room.name} — Matchflix`;
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!room) return;
    return subscribeToParticipants(room.id, () => {
      getRoomByCode(code).then((result) => result && setParticipants(result.participants));
    });
  }, [room, code]);

  useEffect(() => {
    if (!room) return;
    return subscribeToRoom(room.id, () => {
      getRoomByCode(code).then((result) => {
        if (result?.room.status === "voting") router.push(`/escolher/${code}`);
      });
    });
  }, [room, code, router]);

  async function handleStart() {
    if (!room || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      await startRound(
        room.id,
        demoMovies.map((m) => m.id),
      );
    } catch (e) {
      setStartError(e instanceof Error && e.message.includes("só o anfitrião") ? r.startDenied : r.startFailed);
    } finally {
      setStarting(false);
    }
  }

  // Estados de carregamento e erro ainda não têm design aprovado (M1); texto simples por ora.
  if (error) return <main className={styles.main}>{error}</main>;
  if (!room) return <main className={styles.main}>{r.loading}</main>;

  const total = participants.length;

  return (
    <main className={styles.main}>
      <section className={styles.intro}>
        <p className="eyebrow">{r.eyebrow}</p>
        <h1>{room.name}</h1>
        <p className={`${styles.lead} desktop-only`}>{r.lead}</p>
        <p className={`${styles.lead} mobile-only`}>{r.leadMobile}</p>

        <div className={styles.invite}>
          <p className="eyebrow desktop-only">{r.invite.eyebrow}</p>
          <p className="eyebrow mobile-only">{r.invite.eyebrowMobile}</p>
          <p className={styles.code}>{formatRoomCode(room.code)}</p>
          <p className={`${styles.private} desktop-only`}>{r.invite.private}</p>
          <div className={styles.copy}>
            <CopyInviteButton label={r.invite.copy} copiedLabel={r.invite.copied} code={room.code} />
          </div>
          <p className={`${styles.meta} desktop-only`}>
            {countryLabel(room.country)} · {genresLabel(room.genres)}
          </p>
        </div>
      </section>

      <section className={styles.roster}>
        <div className={styles.rosterHead}>
          <h2 className="desktop-only">{r.who}</h2>
          <h2 className="mobile-only">{r.whoMobile}</h2>
          <p className="desktop-only">{r.countInRoom(total)}</p>
          <p className="mobile-only">{r.count(total)}</p>
        </div>

        <ul className={styles.list}>
          {participants.map((p) => (
            <li key={p.id}>
              <Avatar initials={initialsOf(p.nickname)} host={p.isHost} size="lg" />
              <span className={styles.who}>
                <strong>{p.userId === userId ? `${p.nickname} · ${r.you}` : p.nickname}</strong>
                <small>{p.isHost ? r.host : r.ready}</small>
              </span>
              <svg className={styles.check} viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 12 4 4L19 6" />
              </svg>
            </li>
          ))}
        </ul>

        <p className={`${styles.meta} ${styles.metaMobile} mobile-only`}>
          {countryLabel(room.country)} · {genresLabel(room.genres)}
        </p>

        <div className={styles.start}>
          <Button icon="arrow" onClick={handleStart}>
            {r.start}
          </Button>
          {startError ? (
            <p role="alert">{startError}</p>
          ) : (
            <>
              <p className="desktop-only">{r.startNote}</p>
              <p className="mobile-only">{r.startNoteMobile}</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
