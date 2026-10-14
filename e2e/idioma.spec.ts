import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { hasSupabase, hasTmdb } from "../playwright.config";

// Versão em inglês: o seletor "Brasil · PT" do cabeçalho alterna o idioma e a escolha fica
// num cookie, lido no servidor (a página já chega no idioma certo, sem piscar em português).

const inEnglish = (context: BrowserContext) => context.addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);

test("o seletor troca para inglês, lembra a escolha e volta para português", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await page.getByRole("button", { name: "Mudar o idioma para inglês" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Less indecision.");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "Switch language to Portuguese" })).toHaveText("Brazil · EN");

  // Fica guardado: recarregar (e navegar) continua em inglês.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Less indecision.");
  await page.getByRole("link", { name: "Create a room" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your night starts here.");

  await page.getByRole("button", { name: "Switch language to Portuguese" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sua noite começa aqui.");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
});

test("no celular, o seletor fica no lugar do Beta 01", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Mudar o idioma para inglês" })).toBeVisible();
  await expect(page.getByText("Beta 01", { exact: true })).toHaveCount(0);
});

async function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

test("em inglês, nenhuma tela rola para o lado (textos mais longos)", async ({ page, context }) => {
  await inEnglish(context);
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const path of ["/", "/criar", "/entrar", "/escolher", "/match"]) {
      await page.goto(path);
      expect(await noHorizontalScroll(page), `${path} em ${viewport.width}px`).toBe(true);
    }
  }
});

test.describe("Sala de verdade em inglês", () => {
  test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");

  test("erros também saem em inglês", async ({ page, context }) => {
    await inEnglish(context);
    await page.goto("/entrar?codigo=MFX000");
    await page.getByLabel("Your nickname", { exact: true }).fill("Someone");
    await page.getByRole("button", { name: "Join" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText("We couldn't find that room. Check the code.");
  });

  test("criar sala e votar em inglês, com os filmes pedidos ao TMDB em inglês", async ({ page, context }) => {
    test.skip(!hasTmdb, "precisa de TMDB_API_KEY configurada (.env.local)");
    await inEnglish(context);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/criar");
    await page.getByLabel("Room name", { exact: true }).fill("Movie night");
    await page.getByRole("button", { name: "Create room and invite" }).click();
    await page.getByLabel("Your nickname", { exact: true }).fill("Tester");
    await page.getByRole("button", { name: "Create room", exact: true }).click();
    await page.waitForURL(/\/sala\//);
    await expect(page.getByText("Brazil · All genres").first()).toBeVisible();

    const englishCatalog = page.waitForRequest((r) => r.url().includes("/api/movies/") && r.url().includes("lang=en-US"));
    await page.getByRole("button", { name: "Everyone here? Start" }).click();
    await englishCatalog;
    await expect(page.getByText(/^01 \/ \d+ movies$/)).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole("button", { name: "I want to watch" })).toBeVisible();
  });
});
