"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";
import { countryLabel, genresLabel } from "@/lib/labels";
import { resolveMovie } from "@/lib/movies";
import {
  castVote,
  DeckExhaustedError,
  getCurrentRound,
  getMyVotedMovieIds,
  getRoomByCode,
  getRoundMatches,
  getRoundSummary,
  getSeenMatches,
  initialsOf,
  startNextRound,
  subscribeToParticipants,
  subscribeToRoundEvents,
  type Participant,
  type Room,
  type Round,
} from "@/lib/rooms";
import { ensureAnonymousSession } from "@/lib/supabase/session";
import { ptBR as t } from "@/messages/pt-BR";
import { PickMovie, type PickableMovie } from "../PickMovie";
import { RoundStatus, type EndRow } from "./RoundStatus";
import styles from "../escolher.module.css";

type View =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "picking"; remaining: PickableMovie[]; votedBefore: number }
  | { kind: "waiting" }
  | { kind: "ended"; matched: EndRow[]; top: EndRow[] };

type Snapshot =
  | { kind: "go"; to: string; replace?: boolean }
  | { kind: "error"; message: string }
  | { kind: "ready"; uid: string; room: Room; participants: Participant[]; round: Round; deckSize: number; view: View };

async function firstUnseenMatch(roundId: string): Promise<string | undefined> {
  const seen = getSeenMatches(roundId);
  return (await getRoundMatches(roundId)).find((id) => !seen.includes(id));
}

/** Tudo que a tela precisa saber da rodada atual, buscado de uma vez (sem tocar em estado do React). */
async function fetchSnapshot(code: string): Promise<Snapshot> {
  const [uid, result] = await Promise.all([ensureAnonymousSession(), getRoomByCode(code)]);
  if (!result) return { kind: "error", message: t.room.notFound };
  const round = await getCurrentRound(result.room.id);
  if (!round) return { kind: "go", to: `/sala/${code}`, replace: true };

  // Um match que este aparelho ainda não mostrou vem antes de tudo: a tela de match aparece
  // para todos (M0), inclusive para quem estava recarregando a página quando aconteceu.
  const unseen = await firstUnseenMatch(round.id);
  if (unseen) return { kind: "go", to: `/match/${code}/${unseen}` };

  const [voted, resolved] = await Promise.all([
    getMyVotedMovieIds(round.id),
    Promise.all(round.movieIds.map((id) => resolveMovie(id, result.room.country))),
  ]);
  // Pular um filme que não carregou deixaria a pessoa sem votar nele — e a rodada nunca fecharia.
  if (resolved.some((m) => m === null)) return { kind: "error", message: t.round.loadFailed };
  const movies = resolved as PickableMovie[];
  const base = { kind: "ready" as const, uid, room: result.room, participants: result.participants, round, deckSize: movies.length };

  if (round.status === "finished") {
    const byId = new Map(movies.map((m) => [m.id, m]));
    const rows = (await getRoundSummary(round.id)).map((s) => ({
      id: s.movieId,
      title: byId.get(s.movieId)?.title ?? s.movieId,
      href: byId.get(s.movieId)?.detailsHref ?? null,
      approvals: s.approvals,
      voters: s.voters,
      matched: s.matched,
    }));
    return { ...base, view: { kind: "ended", matched: rows.filter((r) => r.matched), top: rows.slice(0, 3) } };
  }

  const votedIds = new Set(voted);
  const remaining = movies.filter((m) => !votedIds.has(m.id));
  return {
    ...base,
    view: remaining.length > 0 ? { kind: "picking", remaining, votedBefore: movies.length - remaining.length } : { kind: "waiting" },
  };
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function PickPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [deckSize, setDeckSize] = useState(0);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  function apply(s: Snapshot) {
    if (s.kind === "go") return s.replace ? router.replace(s.to) : router.push(s.to);
    if (s.kind === "error") return setView({ kind: "error", message: s.message });
    document.title = `${s.room.name} — Matchflix`;
    setUserId(s.uid);
    setRoom(s.room);
    setParticipants(s.participants);
    setRound(s.round);
    setDeckSize(s.deckSize);
    setView(s.view);
  }

  const onLoaded = useEffectEvent((s: Snapshot) => apply(s));
  const onFailed = useEffectEvent((e: unknown) => setView({ kind: "error", message: errorMessage(e) }));
  useEffect(() => {
    fetchSnapshot(code).then(
      (s) => onLoaded(s),
      (e) => onFailed(e),
    );
  }, [code]);

  // Tempo real: rodada nova, rodada encerrada ou match declarado — para todo mundo na sala.
  const onRoundEvent = useEffectEvent(async () => {
    if (!room || !round) return;
    const current = await getCurrentRound(room.id);
    if (!current) return;
    if (current.id !== round.id || current.status !== round.status) return apply(await fetchSnapshot(code));
    const unseen = await firstUnseenMatch(current.id);
    if (unseen) router.push(`/match/${code}/${unseen}`);
  });
  const onCrewChange = useEffectEvent(async () => {
    const result = await getRoomByCode(code);
    if (result) setParticipants(result.participants);
  });
  const roomId = room?.id;
  useEffect(() => {
    if (!roomId) return;
    // Falha de rede passageira num evento: o próximo evento (ou recarregar) reconcilia.
    const offRound = subscribeToRoundEvents(roomId, () => void onRoundEvent().catch(() => {}));
    const offCrew = subscribeToParticipants(roomId, () => void onCrewChange().catch(() => {}));
    return () => {
      offRound();
      offCrew();
    };
  }, [roomId]);

  function onVote(movieId: string, approve: boolean) {
    if (!round) return;
    castVote(round.id, movieId, approve)
      .then((matched) => matched && router.push(`/match/${code}/${movieId}`))
      .catch(() => setView({ kind: "error", message: t.round.voteFailed }));
  }

  async function nextRound(genres: string[]) {
    if (!room) return;
    setStarting(true);
    setStartError(null);
    try {
      await startNextRound(room, genres);
      apply(await fetchSnapshot(code));
    } catch (e) {
      setStartError(e instanceof DeckExhaustedError ? t.round.deckExhausted : t.room.startFailed);
    } finally {
      setStarting(false);
    }
  }

  if (view.kind === "error") return <main className={styles.main}>{view.message}</main>;
  if (view.kind === "loading" || !room || !round) return <main className={styles.main}>{t.room.loading}</main>;
  if (view.kind === "waiting") return <RoundStatus key="waiting" kind="waiting" roundNumber={round.number} />;
  if (view.kind === "ended")
    // key="ended": garante uma montagem nova ao sair de "waiting" (mesmo componente,
    // kind diferente) — sem isso, o estado do seletor de gênero nasceria vazio em vez de
    // partir dos gêneros atuais da sala.
    return (
      <RoundStatus
        key="ended"
        kind="ended"
        roundNumber={round.number}
        matched={view.matched}
        top={view.top}
        isHost={room.hostUserId === userId}
        starting={starting}
        error={startError}
        genres={room.genres}
        onNextRound={nextRound}
      />
    );

  return (
    <PickMovie
      key={round.id}
      movies={view.remaining}
      round={{
        roomName: room.name,
        roundNumber: round.number,
        country: countryLabel(room.country),
        genres: genresLabel(room.genres),
        participants: participants.map((p) => ({
          name: p.nickname,
          initials: initialsOf(p.nickname),
          host: p.isHost,
          you: p.userId === userId,
        })),
        total: deckSize,
        votedBefore: view.votedBefore,
        onVote,
        onDone: () => setView((v) => (v.kind === "picking" ? { kind: "waiting" } : v)),
      }}
    />
  );
}
