import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import { getMovieDetails, discoverMovieIds } from "../lib/catalog";
import { hasSupabase, hasTmdb } from "../playwright.config";
import { createTestRoom, joinTestRoom } from "./helpers";

// M8: falhas de rede. O que a pessoa vê quando o Supabase ou o TMDB caem (ou travam)
// no meio do caminho — sempre uma mensagem que ela entenda, nunca o erro técnico cru
// nem uma mensagem que diga outra coisa ("filme não encontrado" quando o TMDB caiu).

const OFFLINE = "Sem conexão com o servidor. Confira sua internet e tente de novo.";
const CATALOG = "O catálogo de filmes não respondeu. Tente de novo em instantes.";
const TECHNICAL = /Failed to fetch|fetch failed|TypeError|NetworkError/;

test.describe("TMDB fora do ar, no servidor (M8)", () => {
  const realFetch = globalThis.fetch;
  const prevKey = process.env.TMDB_API_KEY;
  test.beforeEach(() => {
    process.env.TMDB_API_KEY = "chave-falsa";
  });
  test.afterEach(() => {
    globalThis.fetch = realFetch;
    process.env.TMDB_API_KEY = prevKey;
  });

  test("filme que não existe é 'não encontrado'", async () => {
    globalThis.fetch = async () => new Response("{}", { status: 404 });
    expect(await getMovieDetails("1", { lang: "pt-BR", country: "BR" })).toBeNull();
  });

  test("TMDB fora do ar é erro, não 'filme não encontrado'", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(getMovieDetails("1", { lang: "pt-BR", country: "BR" })).rejects.toThrow();
    globalThis.fetch = async () => new Response("{}", { status: 503 });
    await expect(getMovieDetails("1", { lang: "pt-BR", country: "BR" })).rejects.toThrow();
  });

  test("TMDB travado desiste em vez de esperar para sempre", async () => {
    // Só responde se for abortado: sem limite de tempo do nosso lado, isso nunca termina.
    globalThis.fetch = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
    await expect(getMovieDetails("1", { lang: "pt-BR", country: "BR" })).rejects.toThrow();
    await expect(discoverMovieIds({ genres: [], exclude: [] })).rejects.toThrow();
  });
});

// --- Pela interface ---

async function startSoloRound(page: Page) {
  const code = await createTestRoom(page);
  await page.getByRole("button", { name: "Todos aqui? Começar" }).click();
  await expect(page).toHaveURL(new RegExp(`/escolher/${code}$`), { timeout: 25_000 });
  await expect(page.getByText(/^\d+ \/ \d+ filmes$/)).toBeVisible({ timeout: 25_000 });
  return code;
}

const supabaseDown = (page: Page) => page.route("**/rest/v1/**", (route) => route.abort("internetdisconnected"));
const catalogDown = (page: Page, method = "GET") =>
  page.route("**/api/movies**", (route) =>
    route.request().method() === method ? route.fulfill({ status: 502, json: { error: "TMDB fora do ar" } }) : route.fallback(),
  );

test.describe("Falhas de rede pela interface (M8)", () => {
  test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("Supabase fora do ar ao criar a sala: mensagem clara", async ({ page }) => {
    await page.goto("/criar");
    await page.getByRole("button", { name: "Criar sala e convidar" }).click();
    await page.getByLabel("Seu apelido", { exact: true }).fill("Teste");
    await supabaseDown(page);
    await page.getByRole("button", { name: "Criar sala", exact: true }).click();
    await expect(page.getByText(OFFLINE)).toBeVisible();
    await expect(page.getByText(TECHNICAL)).toHaveCount(0);
  });

  test("Supabase fora do ar ao abrir a sala: mensagem clara", async ({ page }) => {
    await createTestRoom(page);
    await supabaseDown(page);
    await page.reload();
    await expect(page.getByText(OFFLINE)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(TECHNICAL)).toHaveCount(0);
  });

  test("catálogo fora do ar ao começar a rodada: avisa e deixa tentar de novo", async ({ page }) => {
    const code = await createTestRoom(page);
    await catalogDown(page, "POST");
    await page.getByRole("button", { name: "Todos aqui? Começar" }).click();
    await expect(page.getByText("Não foi possível iniciar a rodada. Tente de novo.")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(new RegExp(`/sala/${code}$`));

    await page.unroute("**/api/movies**");
    await page.getByRole("button", { name: "Todos aqui? Começar" }).click();
    await expect(page).toHaveURL(new RegExp(`/escolher/${code}$`), { timeout: 25_000 });
  });

  test("voto que não chega ao servidor: avisa, e o filme volta depois de recarregar", async ({ page }) => {
    await startSoloRound(page);
    const title = await page.getByRole("heading", { level: 1 }).textContent();
    await page.route("**/rpc/cast_vote", (route) => route.abort("internetdisconnected"));
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("Não deu para registrar seu voto.", { exact: false })).toBeVisible();

    // O voto não foi salvo: ao voltar, o mesmo filme aparece de novo (nada se perde em silêncio).
    await page.unroute("**/rpc/cast_vote");
    await page.reload();
    await expect(page.getByText(/^01 \/ \d+ filmes$/)).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title!);
  });

  test("catálogo fora do ar ao carregar a rodada: mensagem de catálogo", async ({ page }) => {
    await startSoloRound(page);
    await catalogDown(page);
    await page.reload();
    await expect(page.getByText(CATALOG)).toBeVisible({ timeout: 15_000 });
  });

  test("catálogo fora do ar na tela de match: não diz que o filme não deu match", async ({ page }) => {
    const code = await startSoloRound(page);
    const saved = page.waitForResponse((r) => r.url().includes("/rpc/cast_vote") && r.ok());
    await page.keyboard.press("ArrowRight");
    await saved;
    await expect(page).toHaveURL(new RegExp(`/match/${code}/`), { timeout: 25_000 });

    await catalogDown(page);
    await page.reload();
    await expect(page.getByText(CATALOG)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Esse filme não deu match nesta rodada.")).toHaveCount(0);
  });
});

test.describe("Tempo real cai e volta (M8)", () => {
  test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");
  test.use({ viewport: { width: 1440, height: 1000 } });

  const counter = (p: Page) => p.getByText(/^\d+ \/ \d+ filmes$/);
  async function vote(p: Page) {
    const saved = p.waitForResponse((r) => r.url().includes("/rpc/cast_vote") && r.ok());
    await p.keyboard.press("ArrowLeft");
    await saved;
  }

  test("quem estava esperando vê o fim da rodada quando a conexão volta, sem recarregar", async ({ page, browser }) => {
    test.setTimeout(120_000);
    // Celular que dorme, troca de Wi-Fi: o canal de tempo real cai e os avisos desse
    // intervalo não são reenviados. Enquanto "fora do ar", toda reconexão é recusada.
    let realtimeDown = false;
    const sockets: WebSocketRoute[] = [];
    await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
      if (realtimeDown) return ws.close({ code: 4000, reason: "rede caiu" });
      ws.connectToServer();
      sockets.push(ws);
    });

    const code = await createTestRoom(page);
    const guest = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
    await joinTestRoom(guest, code, "Convidado");
    await page.getByRole("button", { name: "Todos aqui? Começar" }).click();
    for (const p of [page, guest]) await expect(counter(p)).toHaveText(/^01 \//, { timeout: 25_000 });
    const total = Number((await counter(page).textContent())!.match(/\/ (\d+)/)![1]);

    for (let i = 0; i < total; i++) await vote(page);
    await expect(page.getByRole("heading", { name: "Você votou em todos." })).toBeVisible();

    realtimeDown = true;
    for (const ws of sockets.splice(0)) await ws.close({ code: 4000, reason: "rede caiu" });

    for (let i = 0; i < total; i++) await vote(guest);
    await expect(guest.getByRole("heading", { name: "Fim da rodada." })).toBeVisible({ timeout: 25_000 });
    // Sanidade: sem a conexão, o anfitrião de fato não ficou sabendo (senão o teste não provaria nada).
    await page.waitForTimeout(2000);
    await expect(page.getByRole("heading", { name: "Você votou em todos." })).toBeVisible();

    realtimeDown = false;
    await expect(page.getByRole("heading", { name: "Fim da rodada." })).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("Tela de detalhes com o catálogo fora do ar (M8)", () => {
  test("TMDB fora do ar não vira 'filme não encontrado'", async ({ page }) => {
    test.skip(!hasTmdb, "precisa de TMDB_API_KEY configurada (.env.local)");
    await catalogDown(page);
    await page.goto("/filme/550");
    await expect(page.getByText(CATALOG)).toBeVisible();
    await expect(page.getByText("Filme não encontrado.")).toHaveCount(0);
  });

  test("filme que não existe continua 'não encontrado'", async ({ page }) => {
    test.skip(!hasTmdb, "precisa de TMDB_API_KEY configurada (.env.local)");
    await page.goto("/filme/999999999");
    await expect(page.getByText("Filme não encontrado.")).toBeVisible({ timeout: 15_000 });
  });
});
