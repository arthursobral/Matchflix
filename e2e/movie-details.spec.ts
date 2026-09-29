import { expect, test } from "@playwright/test";

// Dados fixos do mock local (app/filme/[tmdbId]/data.ts) — não dependem de Supabase nem de
// uma chave de API real, então esses testes rodam sempre, sem test.skip.

test("filme com disponibilidade completa mostra os três grupos de provedores", async ({ page }) => {
  await page.goto("/filme/101");
  await expect(page.getByRole("heading", { name: "Depois da Meia-Noite" })).toBeVisible();

  const where = page.getByRole("region", { name: "Onde assistir" });
  await expect(where.getByText("Assinatura")).toBeVisible();
  await expect(where.getByText("Netflix")).toBeVisible();
  await expect(where.getByText("Prime Video")).toBeVisible();
  await expect(where.getByText("Aluguel")).toBeVisible();
  await expect(where.getByText("Google Play Filmes")).toBeVisible();
  await expect(where.getByText("Compra")).toBeVisible();
  await expect(where.getByText("Apple TV")).toBeVisible();

  await expect(page.getByRole("link", { name: "Ver página no TMDB" })).toHaveAttribute("href", "https://www.themoviedb.org/movie/101");
});

test("filme sem disponibilidade mostra o aviso", async ({ page }) => {
  await page.goto("/filme/202");
  await expect(page.getByRole("heading", { name: "Maré Alta" })).toBeVisible();

  const where = page.getByRole("region", { name: "Onde assistir" });
  await expect(where.getByText("Não há disponibilidade conhecida para esse filme nesse país.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver página no TMDB" })).toHaveCount(0);
});

test("filme inexistente mostra o estado de não encontrado", async ({ page }) => {
  await page.goto("/filme/999999");
  await expect(page.getByText("Filme não encontrado.")).toBeVisible();
});

test("voltar leva de volta para a página anterior", async ({ page }) => {
  await page.goto("/escolher");
  await page.goto("/filme/303");
  await expect(page.getByRole("heading", { name: "Sala 4" })).toBeVisible();
  // Sem pôster no mock: mostra só o texto de aviso, sem inventar nenhum elemento novo.
  await expect(page.getByText("Pôster indisponível.")).toBeVisible();

  await page.getByRole("button", { name: "← Voltar" }).click();
  await expect(page).toHaveURL(/\/escolher$/);
});
