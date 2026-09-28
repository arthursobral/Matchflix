import type { Page } from "@playwright/test";

/**
 * Cria uma sala de teste pela UI de verdade (precisa de um Supabase configurado —
 * ver `hasSupabase` em `playwright.config.ts`) e deixa a página em `/sala/<código>`.
 * Devolve o código.
 */
export async function createTestRoom(page: Page, name = "Sala de teste"): Promise<string> {
  await page.goto("/criar");
  await page.getByLabel("Nome da sala", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Criar sala e convidar" }).click();
  await page.getByLabel("Seu apelido", { exact: true }).fill("Teste");
  await page.getByRole("button", { name: "Criar sala", exact: true }).click();
  await page.waitForURL(/\/sala\//);
  return new URL(page.url()).pathname.split("/").pop()!;
}

/** Entra numa sala existente pela UI de verdade, numa página (contexto) à parte. */
export async function joinTestRoom(page: Page, code: string, nickname: string): Promise<void> {
  await page.goto(`/entrar?codigo=${code}`);
  await page.getByLabel("Seu apelido", { exact: true }).fill(nickname);
  await page.getByRole("button", { name: "Juntar-se" }).click();
  await page.waitForURL(/\/sala\//);
}
