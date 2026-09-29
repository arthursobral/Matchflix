import { expect, test, type Page } from "@playwright/test";
import { hasTmdb } from "../playwright.config";

/**
 * `app/filme/[tmdbId]/data.ts` busca de `/api/movies/[tmdbId]` de verdade — em vez de um
 * mock local só da tela (que testaria uma função paralela, não o caminho real), interceptamos
 * essa chamada de rede com `page.route`. Assim os testes cobrem a tela de ponta a ponta (busca
 * + renderização) sem precisar de uma chave do TMDB configurada, e continuam determinísticos
 * mesmo que os dados reais de um filme mudem com o tempo.
 */
function mockMovie(page: Page, tmdbId: string, body: unknown, status = 200) {
  return page.route(`**/api/movies/${tmdbId}**`, (route) => route.fulfill({ status, contentType: "application/json", json: body }));
}

const fullAvailability = {
  id: "101",
  title: "Depois da Meia-Noite",
  synopsis: "Um segurança noturno descobre que o prédio onde trabalha guarda um segredo que atravessa décadas.",
  genres: ["Suspense", "Drama"],
  runtimeMinutes: 118,
  year: 2024,
  posterUrl: "https://image.tmdb.org/t/p/w500/fake.jpg",
  tmdbUrl: "https://www.themoviedb.org/movie/101",
  providers: {
    flatrate: [{ name: "Netflix", logoUrl: "https://image.tmdb.org/t/p/w92/netflix.png" }],
    rent: [{ name: "Google Play Filmes", logoUrl: "https://image.tmdb.org/t/p/w92/google-play.png" }],
    buy: [{ name: "Apple TV", logoUrl: "https://image.tmdb.org/t/p/w92/apple-tv.png" }],
  },
};

const noAvailability = {
  ...fullAvailability,
  id: "202",
  title: "Maré Alta",
  tmdbUrl: "https://www.themoviedb.org/movie/202",
  providers: null,
};

const noPoster = { ...fullAvailability, id: "303", title: "Sala 4", posterUrl: null, tmdbUrl: "https://www.themoviedb.org/movie/303" };

test("filme com disponibilidade completa mostra os três grupos de provedores e o link do TMDB", async ({ page }) => {
  await mockMovie(page, "101", fullAvailability);
  await page.goto("/filme/101");
  await expect(page.getByRole("heading", { name: "Depois da Meia-Noite" })).toBeVisible();

  const where = page.getByRole("region", { name: "Onde assistir" });
  await expect(where.getByText("Assinatura")).toBeVisible();
  await expect(where.getByText("Netflix")).toBeVisible();
  await expect(where.getByText("Aluguel")).toBeVisible();
  await expect(where.getByText("Google Play Filmes")).toBeVisible();
  await expect(where.getByText("Compra")).toBeVisible();
  await expect(where.getByText("Apple TV")).toBeVisible();

  await expect(page.getByRole("link", { name: "Ver página no TMDB" })).toHaveAttribute("href", "https://www.themoviedb.org/movie/101");
});

test("filme sem disponibilidade mostra o aviso, mas ainda linka pro TMDB", async ({ page }) => {
  await mockMovie(page, "202", noAvailability);
  await page.goto("/filme/202");
  await expect(page.getByRole("heading", { name: "Maré Alta" })).toBeVisible();

  const where = page.getByRole("region", { name: "Onde assistir" });
  await expect(where.getByText("Não há disponibilidade conhecida para esse filme nesse país.")).toBeVisible();
  // O link pro TMDB é obrigatório pelos termos de uso independente de haver streaming ou não.
  await expect(page.getByRole("link", { name: "Ver página no TMDB" })).toHaveAttribute("href", "https://www.themoviedb.org/movie/202");
});

test("filme sem pôster mostra só o aviso, sem inventar nenhum elemento visual novo", async ({ page }) => {
  await mockMovie(page, "303", noPoster);
  await page.goto("/filme/303");
  await expect(page.getByRole("heading", { name: "Sala 4" })).toBeVisible();
  await expect(page.getByText("Pôster indisponível.")).toBeVisible();
});

test("filme inexistente mostra o estado de não encontrado, com jeito de voltar", async ({ page }) => {
  await mockMovie(page, "999999", null, 404);
  await page.goto("/escolher");
  await page.goto("/filme/999999");
  await expect(page.getByText("Filme não encontrado.")).toBeVisible();

  await page.getByRole("button", { name: "← Voltar" }).click();
  await expect(page).toHaveURL(/\/escolher$/);
});

test("filme real via TMDB de verdade mostra título e onde assistir", async ({ page }) => {
  test.skip(!hasTmdb, "precisa de TMDB_API_KEY configurada (.env.local)");
  // Fight Club (id 550): filme antigo e estável, bom pra teste de fumaça contra a API real
  // sem depender de conteúdo que muda com o tempo (título/pôster não mudam; disponibilidade
  // de streaming pode, por isso não afirmamos o conteúdo do bloco "Onde assistir", só que existe).
  await page.goto("/filme/550");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Onde assistir" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver página no TMDB" })).toHaveAttribute("href", "https://www.themoviedb.org/movie/550");
});
