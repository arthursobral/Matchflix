import { expect, test } from "@playwright/test";
import { hasSupabase, hasTmdb } from "../playwright.config";

// M8: o que quem opera o app (e quem usa) vê quando algo sai do caminho.

test("página que não existe: 404 e tela em português, com volta ao início", async ({ page }) => {
  const res = await page.goto("/pagina-que-nao-existe");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Essa página não existe." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
});

test("/api/health: 200 com Supabase e TMDB respondendo, sem vazar chave nenhuma", async ({ request }) => {
  test.skip(!hasSupabase || !hasTmdb, "precisa de Supabase e TMDB configurados (.env.local)");
  const res = await request.get("/api/health");
  const body = await res.text();
  expect(res.status()).toBe(200);
  expect(JSON.parse(body)).toEqual({ ok: true, supabase: "ok", tmdb: "ok" });
  for (const secret of [process.env.TMDB_API_KEY, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, process.env.NEXT_PUBLIC_SUPABASE_URL]) {
    expect(body).not.toContain(secret!);
  }
});
