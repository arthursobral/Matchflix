import { expect, test, type Browser, type Page } from "@playwright/test";
import { hasSupabase, hasTmdb } from "../playwright.config";
import { createTestRoom, joinTestRoom } from "./helpers";

test.use({ viewport: { width: 1440, height: 1000 } });

const counter = (page: Page) => page.getByText(/^\d+ \/ \d+ filmes$/);
const title = (page: Page) => page.getByRole("heading", { level: 1 });

/** Vota pelo teclado e espera o servidor confirmar (senão recarregar poderia perder o voto em trânsito). */
async function vote(page: Page, approve: boolean) {
  const saved = page.waitForResponse((r) => r.url().includes("/rpc/cast_vote") && r.ok());
  await page.keyboard.press(approve ? "ArrowRight" : "ArrowLeft");
  await saved;
}

/** Anfitrião + convidado (sessões separadas, como dois aparelhos), já na primeira rodada. */
async function startWithGuest(page: Page, browser: Browser) {
  const code = await createTestRoom(page);
  const guest = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await joinTestRoom(guest, code, "Convidado");
  await page.getByRole("button", { name: "Todos aqui? Começar" }).click();
  for (const p of [page, guest]) {
    await expect(p).toHaveURL(new RegExp(`/escolher/${code}$`), { timeout: 25_000 });
    await expect(counter(p)).toHaveText(/^01 \//, { timeout: 25_000 });
  }
  return { code, guest };
}

test.describe("Consenso (M5)", () => {
  test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");

  test("match só com unanimidade, e aparece para os dois ao mesmo tempo", async ({ page, browser }) => {
    const { code, guest } = await startWithGuest(page, browser);
    const first = await title(page).textContent();

    await vote(page, true);
    // Só um aprovou: nada de match, o anfitrião segue para o próximo filme.
    await expect(counter(page)).toHaveText(/^02 \//);
    await expect(page).toHaveURL(new RegExp(`/escolher/${code}$`));

    await vote(guest, true);
    for (const p of [page, guest]) {
      await expect(p).toHaveURL(new RegExp(`/match/${code}/\\w+$`));
      await expect(p.getByRole("heading", { name: "Deu match." })).toBeVisible({ timeout: 25_000 });
      await expect(p.getByRole("heading", { level: 2 })).toHaveText(first!);
      await expect(p.getByText("2 de 2 querem assistir.")).toBeVisible();
    }
  });

  test("passar não conta como aprovação: sem unanimidade, sem match", async ({ page, browser }) => {
    const { code, guest } = await startWithGuest(page, browser);
    await vote(page, true);
    await vote(guest, false);
    await expect(counter(guest)).toHaveText(/^02 \//);
    await page.waitForTimeout(1000); // dá tempo de um match indevido chegar por tempo real
    for (const p of [page, guest]) await expect(p).toHaveURL(new RegExp(`/escolher/${code}$`));
  });

  test("recarregar retoma do filme seguinte, sem perder nem repetir voto", async ({ page, browser }) => {
    await startWithGuest(page, browser);
    await vote(page, false);
    await vote(page, false);
    const third = await title(page).textContent();
    await expect(counter(page)).toHaveText(/^03 \//);

    await page.reload();
    await expect(counter(page)).toHaveText(/^03 \//, { timeout: 25_000 });
    await expect(title(page)).toHaveText(third!);
  });

  test("depois do match: continuar escolhendo segue o baralho, e ninguém novo entra", async ({ page, browser }) => {
    const { code, guest } = await startWithGuest(page, browser);
    await vote(page, true);
    await vote(guest, true);
    await expect(page).toHaveURL(new RegExp(`/match/${code}/\\w+$`));

    // A rodada continua (M0): volta para o próximo filme, sem ser mandado de novo para o match já visto.
    await page.getByRole("link", { name: "Continuar escolhendo" }).click();
    await expect(page).toHaveURL(new RegExp(`/escolher/${code}$`));
    await expect(counter(page)).toHaveText(/^02 \//, { timeout: 25_000 });
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(new RegExp(`/escolher/${code}$`));

    const late = await (await browser.newContext()).newPage();
    await late.goto(`/entrar?codigo=${code}`);
    await late.getByLabel("Seu apelido", { exact: true }).fill("Atrasado");
    await late.getByRole("button", { name: "Juntar-se" }).click();
    await expect(late.locator('p[role="alert"]')).toHaveText("Essa sala já deu match — não entra mais ninguém.");

    // Quem já estava na sala continua podendo voltar pelo convite (reconexão).
    await joinTestRoom(guest, code, "Convidado");
  });

  test("fim da rodada: espera a turma, mostra os mais aprovados e o anfitrião abre a próxima", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const { guest } = await startWithGuest(page, browser);
    const total = Number((await counter(page).textContent())!.match(/\/ (\d+)/)![1]);

    for (let i = 0; i < total; i++) await vote(page, i === 0);
    await expect(page.getByRole("heading", { name: "Você votou em todos." })).toBeVisible();

    for (let i = 0; i < total; i++) await vote(guest, false);
    for (const p of [page, guest]) {
      await expect(p.getByRole("heading", { name: "Fim da rodada." })).toBeVisible({ timeout: 25_000 });
      await expect(p.getByText("Nenhum filme agradou a todos. Os mais aprovados:")).toBeVisible();
      await expect(p.getByText("1 de 2 aprovaram")).toBeVisible();
    }
    await expect(guest.getByText("Esperando o anfitrião começar a próxima rodada.")).toBeVisible();

    await page.getByRole("button", { name: "Começar nova rodada" }).click();
    for (const p of [page, guest]) {
      await expect(p.getByText("Rodada 02")).toBeVisible({ timeout: 25_000 });
      await expect(counter(p)).toHaveText(/^01 \//);
    }
  });

  test("o halo ganha a cor do pôster de verdade", async ({ page, browser }) => {
    test.skip(!hasTmdb, "precisa de TMDB_API_KEY configurada (.env.local)");
    await startWithGuest(page, browser);
    // Pôsteres do TMDB: cor extraída (três números RGB) em vez das cores fixas da demonstração.
    await expect
      .poll(async () => page.locator("[data-halo]").evaluateAll((els) => els.filter((e) => /^\d+ \d+ \d+$/.test(e.getAttribute("data-halo")!)).length), {
        timeout: 25_000,
      })
      .toBeGreaterThan(0);
  });
});
