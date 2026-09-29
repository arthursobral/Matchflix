import { expect, test } from "@playwright/test";
import { hasTmdb } from "../playwright.config";

test("baralho com dois gêneros marcados junta filmes de qualquer um deles, não só da interseção", async ({ request }) => {
  test.skip(!hasTmdb, "precisa de TMDB_API_KEY configurada (.env.local)");

  // Bug real: `with_genres` do TMDB trata vírgula como E (interseção). Dois gêneros populares
  // e bem distintos (ação, terror) juntos têm poucos filmes em comum — se o baralho ainda
  // tratasse como interseção, viria bem menos que os 20 pedidos.
  const res = await request.post("/api/movies", { data: { genres: ["romance", "documentario"], exclude: [] } });
  expect(res.ok()).toBeTruthy();
  const { movieIds } = (await res.json()) as { movieIds: string[] };
  expect(movieIds.length).toBeGreaterThanOrEqual(18);
  expect(new Set(movieIds).size).toBe(movieIds.length);
});
