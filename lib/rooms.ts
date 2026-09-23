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

/** Formato de retorno de create_room/join_room, até termos tipos gerados do schema. */
type RoomRefRow = { room_id: string; code: string; participant_id: string };

/** "MFX824" → "MFX 824", como no design. */
export function formatRoomCode(code: string) {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
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
  return { roomId: row.room_id, code: row.code, participantId: row.participant_id };
}

export async function joinRoom(code: string, nickname: string): Promise<RoomRef> {
  await ensureAnonymousSession();
  const { data, error } = await getSupabase().rpc("join_room", { p_code: code, p_nickname: nickname }).single();
  if (error) {
    if (error.message.includes("sala não encontrada")) throw new RoomNotFoundError(error.message);
    if (error.message.includes("sala expirada")) throw new RoomExpiredError(error.message);
    throw new Error(error.message);
  }
  const row = data as RoomRefRow;
  return { roomId: row.room_id, code: row.code, participantId: row.participant_id };
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
};

export type Participant = {
  id: string;
  userId: string;
  nickname: string;
  isHost: boolean;
};

/** Busca a sala pelo código. A lista de participantes ainda não é ao vivo — isso é do M3. */
export async function getRoomByCode(code: string): Promise<{ room: Room; participants: Participant[] } | null> {
  const supabase = getSupabase();
  const { data: room, error } = await supabase.from("rooms").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (error) throw new Error(error.message);
  if (!room) return null;

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
    },
    participants: (participants ?? []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      nickname: p.nickname,
      isHost: p.is_host,
    })),
  };
}
