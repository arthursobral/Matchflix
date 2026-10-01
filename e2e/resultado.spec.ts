import { expect, test, type Page } from "@playwright/test";
import { hasSupabase, hasTmdb } from "../playwright.config";
import { createTestRoom, joinTestRoom } from "./helpers";

test.use({ viewport: { width: 1440, height: 1000 } });

async function vote(page: Page, approve: boolean) {
  const saved = page.waitForResponse((r) => r.url().includes("/rpc/cast_vote") && r.ok());
  await page.keyboard.press(approve ? "ArrowRight" : "ArrowLeft");
  await saved;
}

/** Sala sozinho: aprovar já é unanimidade, mais rápido para chegar a um match de verdade. */
async function reachMatch(page: Page) {
  const code = await createTestRoom(page);
  await page.getByRole("button", { name: "Todos aqui? Começar" }).click();
  await expect(page).toHaveURL(new RegExp(`/escolher/${code}$`), { timeout: 25_000 });
  // Espera a tela de fato montar (filme carregado) antes de votar pelo teclado — só a URL
  // já ter mudado não garante que o listener de teclado já esteja registrado.
  await expect(page.getByText(/^\d+ \/ \d+ filmes$/)).toBeVisible({ timeout: 25_000 });
  await vote(page, true);
  await expect(page).toHaveURL(/\/match\/MFX\d{3}\/\w+$/, { timeout: 25_000 });
  return code;
}

test.describe("Resultado e opções para assistir (M6)", () => {
  test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");

  test("resultado do match persiste ao recarregar a página", async ({ page }) => {
    await reachMatch(page);
    const title = await page.getByRole("heading", { level: 2 }).textContent();
    const url = page.url();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Deu match." })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(title!);
    expect(page.url()).toBe(url);
  });

  test("aviso de disponibilidade aparece junto do provedor, quando há um", async ({ page }) => {
    test.skip(!hasTmdb, "precisa de TMDB_API_KEY configurada (.env.local) para ter provedor real");
    await reachMatch(page);
    await expect(page.getByRole("heading", { name: "Deu match." })).toBeVisible({ timeout: 25_000 });
    // Só afirma o aviso se de fato apareceu um provedor (filme pode não ter disponibilidade).
    const hasProvider = await page.locator("strong").first().isVisible().catch(() => false);
    test.skip(!hasProvider, "filme sorteado não tem disponibilidade no país para checar o aviso junto");
    await expect(page.getByText(/não garante que você já tenha acesso/)).toBeVisible();
  });

  test("'Ver opções para assistir' vai para a página do filme no TMDB, nunca direto pro serviço", async ({ page }) => {
    test.skip(!hasTmdb, "precisa de TMDB_API_KEY configurada (.env.local)");
    await reachMatch(page);
    await expect(page.getByRole("heading", { name: "Deu match." })).toBeVisible({ timeout: 25_000 });
    const link = page.getByRole("link", { name: "Ver opções para assistir" });
    await expect(link).toHaveAttribute("href", /^https:\/\/www\.themoviedb\.org\/movie\/\d+$/);
  });

  test("'Continuar escolhendo' não diverge entre dois participantes depois do match", async ({ page, browser }) => {
    const code = await createTestRoom(page);
    const guest = await (await browser.newContext()).newPage();
    await joinTestRoom(guest, code, "Convidado");
    await page.getByRole("button", { name: "Todos aqui? Começar" }).click();
    await expect(page).toHaveURL(new RegExp(`/escolher/${code}$`), { timeout: 25_000 });
    await expect(guest).toHaveURL(new RegExp(`/escolher/${code}$`), { timeout: 25_000 });
    await expect(page.getByText(/^\d+ \/ \d+ filmes$/)).toBeVisible({ timeout: 25_000 });
    await expect(guest.getByText(/^\d+ \/ \d+ filmes$/)).toBeVisible({ timeout: 25_000 });

    await vote(page, true);
    await vote(guest, true);
    await expect(page).toHaveURL(/\/match\//, { timeout: 25_000 });
    await expect(guest).toHaveURL(/\/match\//, { timeout: 25_000 });
    expect(page.url()).toBe(guest.url());

    await page.getByRole("link", { name: "Continuar escolhendo" }).click();
    await guest.getByRole("link", { name: "Continuar escolhendo" }).click();
    await expect(page).toHaveURL(new RegExp(`/escolher/${code}$`));
    await expect(guest).toHaveURL(new RegExp(`/escolher/${code}$`));
    // Mesmo próximo filme para os dois — nenhum resultado divergente entre as sessões.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText((await guest.getByRole("heading", { level: 1 }).textContent())!);
  });
});
