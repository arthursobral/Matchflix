import { getSupabase } from "./supabase/client";
import { ensureAnonymousSession } from "./supabase/session";

export type RoomMode = "same_home" | "remote";

export type CreateRoomInput = {
  name: string;
  country: string;
  mode: RoomMode;
  genres: string[];
  nickname: string;
};

export type RoomRef = { roomId: string; code: string; participantId: string };

export class RoomNotFoundError extends Error {}
export class RoomExpiredError extends Error {}
/** A sala já deu match: não entra mais ninguém novo (M0, seção 4). */
export class RoomLockedError extends Error {}
/** Não sobrou filme inédito nesses gêneros para uma nova rodada. */
export class DeckExhaustedError extends Error {}

/**
 * Formato de retorno de create_room/join_room, até termos tipos gerados do schema.
 * Nomes prefixados (out_*) de propósito, para nunca colidir com uma coluna de
 * verdade dentro da função em SQL (ver migração 20260923150000).
 */
type RoomRefRow = { out_room_id: string; out_code: string; out_participant_id: string };

/** Duas iniciais para o avatar a partir do apelido ("Arthur Sobral" → "AS", "Lucas" → "LU"). */
export function initialsOf(nickname: string): string {
  const parts = nickname.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// TODO(M2+): gerar tipos com `supabase gen types typescript` assim que o projeto
// existir, e trocar esses `any` de RPC por tipos reais do schema.

export async function createRoom(input: CreateRoomInput): Promise<RoomRef> {
  await ensureAnonymousSession();
  const { data, error } = await getSupabase()
    .rpc("create_room", {
      p_name: input.name,
      p_country: input.country,
      p_mode: input.mode,
      p_genres: input.genres,
      p_nickname: input.nickname,
    })
    .single();
  if (error) throw new Error(error.message);
  const row = data as RoomRefRow;
  return { roomId: row.out_room_id, code: row.out_code, participantId: row.out_participant_id };
}

export async function joinRoom(code: string, nickname: string): Promise<RoomRef> {
  await ensureAnonymousSession();
  const { data, error } = await getSupabase().rpc("join_room", { p_code: code, p_nickname: nickname }).single();
  if (error) {
    if (error.message.includes("sala não encontrada")) throw new RoomNotFoundError(error.message);
    if (error.message.includes("sala expirada")) throw new RoomExpiredError(error.message);
    if (error.message.includes("sala com match")) throw new RoomLockedError(error.message);
    throw new Error(error.message);
  }
  const row = data as RoomRefRow;
  return { roomId: row.out_room_id, code: row.out_code, participantId: row.out_participant_id };
}

export type Room = {
  id: string;
  code: string;
  name: string;
  country: string;
  mode: RoomMode;
  genres: string[];
  hostUserId: string;
  status: "lobby" | "voting" | "ended";
  expiresAt: string;
};

export type Participant = {
  id: string;
  userId: string;
  nickname: string;
  isHost: boolean;
};

/** Busca a sala e a lista de participantes pelo código. */
export async function getRoomByCode(code: string): Promise<{ room: Room; participants: Participant[] } | null> {
  const supabase = getSupabase();
  const { data: room, error } = await supabase.from("rooms").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (error) throw new Error(error.message);
  // Sala encerrada ou expirada: tratada como inexistente (mesma mensagem já usada para
  // código inválido — quem já estava dentro é avisado assim que a tela buscar de novo).
  if (!room || room.status === "ended" || new Date(room.expires_at) < new Date()) return null;

  const { data: participants, error: pError } = await supabase
    .from("participants")
    .select("*")
    .eq("room_id", room.id)
    .is("removed_at", null)
    .order("joined_at", { ascending: true });
  if (pError) throw new Error(pError.message);

  return {
    room: {
      id: room.id,
      code: room.code,
      name: room.name,
      country: room.country,
      mode: room.mode,
      genres: room.genres,
      hostUserId: room.host_user_id,
      status: room.status,
      expiresAt: room.expires_at,
    },
    participants: (participants ?? []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      nickname: p.nickname,
      isHost: p.is_host,
    })),
  };
}

/**
 * Assina mudanças na lista de participantes de uma sala (entrada, saída, apelido).
 * Chama `onChange` a cada evento; quem chama decide o que refazer (aqui, buscar a
 * sala de novo — a lista é pequena, não vale a pena remontar o estado a partir do payload).
 * Também chama `onChange` assim que a conexão é confirmada (`SUBSCRIBED`), para pegar
 * qualquer mudança que tenha acontecido nesse meio-tempo entre a busca inicial e a
 * inscrição ficar de fato ativa — sem isso, uma mudança nessa janela nunca chega.
 */
export function subscribeToParticipants(roomId: string, onChange: () => void): () => void {
  const channel = getSupabase()
    .channel(`room:${roomId}:participants`)
    .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` }, onChange)
    .subscribe((status) => status === "SUBSCRIBED" && onChange());
  return () => {
    getSupabase().removeChannel(channel);
  };
}

/** Assina mudanças na própria sala (hoje, só o início de rodada muda `status`); mesma reconciliação ao conectar (ver `subscribeToParticipants`). */
export function subscribeToRoom(roomId: string, onChange: () => void): () => void {
  const channel = getSupabase()
    .channel(`room:${roomId}:status`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, onChange)
    .subscribe((status) => status === "SUBSCRIBED" && onChange());
  return () => {
    getSupabase().removeChannel(channel);
  };
}

/**
 * Só o anfitrião consegue iniciar a rodada — verificado no servidor (função `security
 * definer`). `movieIds` é o baralho candidato (hoje, os filmes fictícios do M1); o
 * servidor embaralha e grava a ordem, a mesma para todos os participantes.
 */
export async function startRound(roomId: string, movieIds: string[]): Promise<void> {
  const { error } = await getSupabase().rpc("start_round", { p_room_id: roomId, p_movie_ids: movieIds });
  if (error) {
    if (error.message.includes("baralho vazio")) throw new DeckExhaustedError(error.message);
    throw new Error(error.message);
  }
}

/** Ids de filmes já usados em qualquer rodada da sala (não repetir no próximo baralho). */
export async function getUsedMovieIds(roomId: string): Promise<string[]> {
  const { data, error } = await getSupabase().from("round_movies").select("movie_id").eq("room_id", roomId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.movie_id as string);
}

/** Monta um baralho inédito para a sala (TMDB, no servidor) e abre a próxima rodada. Só o anfitrião. */
/**
 * `genres`, quando passado, troca o gênero da sala antes de montar o baralho (pedido na
 * tela de fim de rodada — perceber que um gênero não está agradando e trocar para o
 * próximo). Sem isso, usa o gênero já salvo na sala (início normal da primeira rodada).
 */
export async function startNextRound(room: Pick<Room, "id" | "genres">, genres?: string[]): Promise<void> {
  const useGenres = genres ?? room.genres;
  if (genres) await updateRoomGenres(room.id, genres);
  const exclude = await getUsedMovieIds(room.id);
  const res = await fetch("/api/movies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ genres: useGenres, exclude }),
  });
  if (!res.ok) throw new Error("catálogo indisponível");
  const { movieIds } = (await res.json()) as { movieIds: string[] };
  await startRound(room.id, movieIds);
}

/** Só o anfitrião troca os gêneros da sala — verificado no servidor. */
export async function updateRoomGenres(roomId: string, genres: string[]): Promise<void> {
  const { error } = await getSupabase().rpc("update_room_genres", { p_room_id: roomId, p_genres: genres });
  if (error) throw new Error(error.message);
}

export type Round = {
  id: string;
  number: number;
  status: "open" | "finished";
  /** Baralho na ordem sorteada pelo servidor, a mesma para todos. */
  movieIds: string[];
};

/** Rodada mais recente da sala (aberta ou já encerrada). `null` se nenhuma começou. */
export async function getCurrentRound(roomId: string): Promise<Round | null> {
  const supabase = getSupabase();
  const { data: round, error } = await supabase
    .from("rounds")
    .select("id, number, status")
    .eq("room_id", roomId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!round) return null;

  const { data: movies, error: mError } = await supabase
    .from("round_movies")
    .select("movie_id")
    .eq("round_id", round.id)
    .order("position", { ascending: true });
  if (mError) throw new Error(mError.message);

  return { id: round.id, number: round.number, status: round.status, movieIds: (movies ?? []).map((m) => m.movie_id as string) };
}

/** Grava o voto no servidor. Devolve `true` se ESTE voto fechou a unanimidade (virou match). */
export async function castVote(roundId: string, movieId: string, approve: boolean): Promise<boolean> {
  const { data, error } = await getSupabase()
    .rpc("cast_vote", { p_round_id: roundId, p_movie_id: movieId, p_approve: approve })
    .single();
  if (error) throw new Error(error.message);
  return (data as { out_matched: boolean }).out_matched;
}

/** Filmes em que o próprio participante já votou (a RLS só deixa ler os próprios votos). */
export async function getMyVotedMovieIds(roundId: string): Promise<string[]> {
  const { data, error } = await getSupabase().from("votes").select("movie_id").eq("round_id", roundId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((v) => v.movie_id as string);
}

/** Filmes que deram match na rodada, na ordem em que aconteceram. */
export async function getRoundMatches(roundId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("matches")
    .select("movie_id")
    .eq("round_id", roundId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => m.movie_id as string);
}

export type RoundSummaryRow = { movieId: string; approvals: number; voters: number; matched: boolean };

/** Aprovações por filme, mais aprovados primeiro — sem revelar quem votou o quê. */
export async function getRoundSummary(roundId: string): Promise<RoundSummaryRow[]> {
  const { data, error } = await getSupabase().rpc("round_summary", { p_round_id: roundId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { out_movie_id: string; out_approvals: number; out_voters: number; out_matched: boolean }[]).map((r) => ({
    movieId: r.out_movie_id,
    approvals: r.out_approvals,
    voters: r.out_voters,
    matched: r.out_matched,
  }));
}

/**
 * Assina tudo que muda o estado da rodada para todo mundo: nova rodada, rodada encerrada e
 * match declarado. Mesma reconciliação ao conectar de `subscribeToParticipants`.
 */
export function subscribeToRoundEvents(roomId: string, onChange: () => void): () => void {
  const filter = `room_id=eq.${roomId}`;
  const channel = getSupabase()
    .channel(`room:${roomId}:round`)
    .on("postgres_changes", { event: "*", schema: "public", table: "rounds", filter }, onChange)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches", filter }, onChange)
    .subscribe((status) => status === "SUBSCRIBED" && onChange());
  return () => {
    getSupabase().removeChannel(channel);
  };
}

/**
 * Matches que este aparelho já mostrou (por rodada). A tela de match aparece para todos
 * assim que acontece; quem já viu e escolheu "Continuar escolhendo" não deve ser mandado
 * de volta para ela a cada evento. Só conveniência local: se o armazenamento falhar, o pior
 * caso é ver a tela de match de novo.
 */
const seenKey = (roundId: string) => `matchflix:seen-matches:${roundId}`;

export function getSeenMatches(roundId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(seenKey(roundId)) ?? "[]");
  } catch {
    return [];
  }
}

export function markMatchSeen(roundId: string, movieId: string) {
  try {
    const seen = new Set(getSeenMatches(roundId)).add(movieId);
    localStorage.setItem(seenKey(roundId), JSON.stringify([...seen]));
  } catch {
    // Sem armazenamento local (aba privada etc.): só significa rever a tela de match.
  }
}
