import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hasSupabase, hasTmdb } from "../playwright.config";
import { createTestRoom, joinTestRoom } from "./helpers";

// M8: verificação automática de acessibilidade (axe-core, regras WCAG 2.1 A/AA) em cada
// tela, no desktop e no celular. Lista cada violação com o seletor do elemento, para o
// relatório do teste já dizer onde está o problema.

async function axe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  return violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const [device, viewport] of [
  ["desktop", { width: 1440, height: 1000 }],
  ["celular", { width: 390, height: 844 }],
] as const) {
  test.describe(`Acessibilidade (${device})`, () => {
    test.use({ viewport });

    for (const path of ["/", "/criar", "/entrar", "/escolher", "/match", "/pagina-que-nao-existe"]) {
      test(`${path}`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        expect(await axe(page)).toEqual([]);
      });
    }

    test("/criar com o modal do apelido aberto", async ({ page }) => {
      await page.goto("/criar");
      await page.getByRole("button", { name: "Criar sala e convidar" }).click();
      await expect(page.getByLabel("Seu apelido", { exact: true })).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });

    test("modal do apelido prende o foco do teclado e devolve ao fechar", async ({ page }) => {
      await page.goto("/criar");
      const opener = page.getByRole("button", { name: "Criar sala e convidar" });
      await opener.click();
      const dialog = page.getByRole("dialog");
      await expect(page.getByLabel("Seu apelido", { exact: true })).toBeFocused();
      // O axe não pega isso: com Tab/Shift+Tab, o foco nunca pode ir parar na página atrás do modal.
      const focusInside = () => dialog.evaluate((d) => d.contains(document.activeElement) || document.activeElement === document.body);
      for (const key of ["Tab", "Tab", "Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
        await page.keyboard.press(key);
        expect(await focusInside(), `foco saiu do modal depois de ${key}`).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
    });

    test("/filme/[id]", async ({ page }) => {
      test.skip(!hasTmdb, "precisa de TMDB_API_KEY configurada (.env.local)");
      await page.goto("/filme/550");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
      expect(await axe(page)).toEqual([]);
    });

    test("sala, rodada, fim de rodada e match de verdade", async ({ page, browser }) => {
      test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");
      test.setTimeout(120_000);
      const code = await createTestRoom(page);
      const guest = await (await browser.newContext({ viewport })).newPage();
      await joinTestRoom(guest, code, "Convidado");
      await expect(page.locator("li")).toHaveCount(2);
      expect(await axe(page), "sala de espera").toEqual([]);

      await page.getByRole("button", { name: "Todos aqui? Começar" }).click();
      const counter = page.getByText(/^\d+ \/ \d+ filmes$/);
      await expect(counter).toBeVisible({ timeout: 25_000 });
      await page.waitForLoadState("networkidle");
      expect(await axe(page), "escolher filme").toEqual([]);

      // Fim de rodada (só o anfitrião vê o seletor de gênero), e depois o match.
      const total = Number((await counter.textContent())!.match(/\/ (\d+)/)![1]);
      const vote = async (p: Page, approve: boolean) => {
        const saved = p.waitForResponse((r) => r.url().includes("/rpc/cast_vote") && r.ok());
        await p.keyboard.press(approve ? "ArrowRight" : "ArrowLeft");
        await saved;
      };
      await expect(guest.getByText(/^\d+ \/ \d+ filmes$/)).toBeVisible({ timeout: 25_000 });
      for (let i = 0; i < total; i++) await vote(page, false);
      expect(await axe(page), "esperando a turma").toEqual([]);
      for (let i = 0; i < total; i++) await vote(guest, false);
      await expect(page.getByRole("heading", { name: "Fim da rodada." })).toBeVisible({ timeout: 25_000 });
      expect(await axe(page), "fim da rodada").toEqual([]);

      await page.getByRole("button", { name: "Começar nova rodada" }).click();
      await expect(page.getByText(/^01 \/ \d+ filmes$/)).toBeVisible({ timeout: 25_000 });
      await expect(guest.getByText(/^01 \/ \d+ filmes$/)).toBeVisible({ timeout: 25_000 });
      await vote(page, true);
      await vote(guest, true);
      await expect(page.getByRole("heading", { name: "Deu match." })).toBeVisible({ timeout: 25_000 });
      await page.waitForLoadState("networkidle");
      expect(await axe(page), "match").toEqual([]);
    });
  });
}
