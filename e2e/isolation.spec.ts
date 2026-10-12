import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasSupabase } from "../playwright.config";
import { createTestRoom, joinTestRoom } from "./helpers";

// M8: isolamento entre salas e votos concorrentes. A maior parte fala direto com as
// funções do banco (sem navegador), porque só assim os votos chegam de fato ao mesmo tempo.

async function anonClient(): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInAnonymously();
  if (error) {
    const hint = /captcha/i.test(error.message) ? " (projeto com CAPTCHA ligado: rode contra o Supabase local)" : "";
    throw new Error(`login anônimo falhou: ${error.message}${hint}`);
  }
  return client;
}

async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/** Sala com `size` participantes (o primeiro é o anfitrião) e uma rodada aberta com `movies`. */
async function roomWithRound(size: number, movies: string[]) {
  const people = await Promise.all(Array.from({ length: size }, anonClient));
  const [host, ...guests] = people;
  const [room] = await rpc<{ out_room_id: string; out_code: string }[]>(host, "create_room", {
    p_name: "Isolamento",
    p_country: "BR",
    p_mode: "remote",
    p_genres: [],
    p_nickname: "Anfitrião",
  });
  for (const [i, guest] of guests.entries()) {
    await rpc(guest, "join_room", { p_code: room.out_code, p_nickname: `Convidado ${i + 1}` });
  }
  const roundId = await rpc<string>(host, "start_round", { p_room_id: room.out_room_id, p_movie_ids: movies });
  return { people, host, guests, roomId: room.out_room_id, code: room.out_code, roundId };
}

const vote = (client: SupabaseClient, roundId: string, movieId: string, approve: boolean) =>
  rpc<{ out_matched: boolean }[]>(client, "cast_vote", { p_round_id: roundId, p_movie_id: movieId, p_approve: approve }).then(
    (rows) => rows[0].out_matched,
  );

test.describe("Votos concorrentes (M8)", () => {
  test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");

  test("todos aprovam ao mesmo tempo: cada filme dá exatamente um match", async () => {
    const movies = Array.from({ length: 10 }, (_, i) => `concorrente-${i}`);
    const { people, host, roomId, roundId } = await roomWithRound(3, movies);

    // Os 30 votos saem juntos: é a corrida em que os dois últimos "sim" de um filme se
    // veriam como n-1 e ninguém declararia o match (ver a trava em cast_vote).
    const results = await Promise.all(movies.flatMap((m) => people.map(async (p) => ({ m, matched: await vote(p, roundId, m, true) }))));

    for (const m of movies) {
      expect(results.filter((r) => r.m === m && r.matched), `filme ${m}`).toHaveLength(1);
    }
    const { data: matches } = await host.from("matches").select("movie_id").eq("room_id", roomId);
    expect(matches).toHaveLength(movies.length);
    const { data: round } = await host.from("rounds").select("status").eq("id", roundId).single();
    expect(round?.status).toBe("finished");
  });

  test("o mesmo voto repetido em paralelo vale uma vez só", async () => {
    const { host, guests, roundId } = await roomWithRound(2, ["repetido"]);
    const [guest] = guests;

    // Aprovar e passar ao mesmo tempo (clique duplo, aba duplicada): fica um voto só.
    await Promise.all([true, false, true, false, true].map((approve) => vote(guest, roundId, "repetido", approve)));
    const { data: mine } = await guest.from("votes").select("movie_id, approve").eq("round_id", roundId);
    expect(mine).toHaveLength(1);

    // E um voto só não vira unanimidade: com o anfitrião aprovando, só há match se o voto
    // que ficou do convidado for "sim".
    const matched = await vote(host, roundId, "repetido", true);
    expect(matched).toBe(mine![0].approve);
  });

  test("votos são privados mesmo dentro da sala", async () => {
    const { host, guests, roundId } = await roomWithRound(2, ["privado"]);
    await vote(host, roundId, "privado", false);
    await vote(guests[0], roundId, "privado", true);

    const { data: seenByGuest } = await guests[0].from("votes").select("approve").eq("round_id", roundId);
    expect(seenByGuest).toEqual([{ approve: true }]);
  });
});

test.describe("Isolamento entre salas (M8)", () => {
  test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");

  test("quem está em outra sala não lê nem mexe na sala dos outros", async () => {
    const a = await roomWithRound(2, ["a-1", "a-2"]);
    await vote(a.host, a.roundId, "a-1", true);
    await vote(a.guests[0], a.roundId, "a-1", true);
    const b = await roomWithRound(1, ["b-1"]);
    const outsider = b.host;

    // Sanidade: o próprio anfitrião de A enxerga tudo (senão as listas vazias abaixo não provariam nada).
    for (const [table, column] of [["rooms", "id"], ["participants", "room_id"], ["rounds", "room_id"], ["round_movies", "room_id"], ["matches", "room_id"]] as const) {
      const { data: own } = await a.host.from(table).select("*").eq(column, a.roomId);
      expect(own?.length, `anfitrião lê ${table}`).toBeGreaterThan(0);
      const { data: foreign } = await outsider.from(table).select("*").eq(column, a.roomId);
      expect(foreign, `estranho lê ${table}`).toEqual([]);
    }
    const { data: foreignVotes } = await outsider.from("votes").select("*").eq("room_id", a.roomId);
    expect(foreignVotes).toEqual([]);

    await expect(vote(outsider, a.roundId, "a-2", true)).rejects.toThrow("você não está nesta sala");
    await expect(rpc(outsider, "round_summary", { p_round_id: a.roundId })).rejects.toThrow("rodada não encontrada");
    await expect(rpc(outsider, "update_room_genres", { p_room_id: a.roomId, p_genres: ["terror"] })).rejects.toThrow("só o anfitrião");
    await expect(rpc(outsider, "start_round", { p_room_id: a.roomId, p_movie_ids: ["x"] })).rejects.toThrow("só o anfitrião");

    // Votar com a rodada de A não conta na sala B, nem o contrário: o filme de B não existe em A.
    await expect(vote(a.host, a.roundId, "b-1", true)).rejects.toThrow("filme fora da rodada");
    await expect(vote(a.host, b.roundId, "b-1", true)).rejects.toThrow("você não está nesta sala");
  });
});

// --- Pela interface: duas salas abertas ao mesmo tempo ---

const counter = (page: Page) => page.getByText(/^\d+ \/ \d+ filmes$/);

async function uiVote(page: Page) {
  const saved = page.waitForResponse((r) => r.url().includes("/rpc/cast_vote") && r.ok());
  await page.keyboard.press("ArrowRight");
  await saved;
}

async function openRoomWithGuest(page: Page, browser: Browser, name: string) {
  const code = await createTestRoom(page, name);
  const guest = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await joinTestRoom(guest, code, "Convidado");
  await page.getByRole("button", { name: "Todos aqui? Começar" }).click();
  for (const p of [page, guest]) {
    await expect(p).toHaveURL(new RegExp(`/escolher/${code}$`), { timeout: 25_000 });
    await expect(counter(p)).toHaveText(/^01 \//, { timeout: 25_000 });
  }
  return { code, pages: [page, guest] };
}

test.describe("Duas salas ao mesmo tempo (M8)", () => {
  test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("o match de uma sala não chega na outra", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const hostB = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
    const a = await openRoomWithGuest(page, browser, "Sala A");
    const b = await openRoomWithGuest(hostB, browser, "Sala B");

    for (const p of a.pages) await uiVote(p);
    for (const p of a.pages) {
      await expect(p).toHaveURL(new RegExp(`/match/${a.code}/`), { timeout: 25_000 });
    }

    // A sala B não recebe nada da A: segue no primeiro filme, cada uma com seus 2 participantes.
    await b.pages[0].waitForTimeout(1500);
    for (const p of b.pages) {
      await expect(p).toHaveURL(new RegExp(`/escolher/${b.code}$`));
      await expect(counter(p)).toHaveText(/^01 \//);
      await expect(p.getByRole("complementary", { name: "Sua turma" }).getByRole("listitem")).toHaveCount(2);
    }

    // E o match da B fica na B, sem mexer em quem está vendo o match da A.
    for (const p of b.pages) await uiVote(p);
    for (const p of b.pages) {
      await expect(p).toHaveURL(new RegExp(`/match/${b.code}/`), { timeout: 25_000 });
    }
    for (const p of a.pages) await expect(p).toHaveURL(new RegExp(`/match/${a.code}/`));
  });
});
