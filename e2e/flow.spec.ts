import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });

test("percorre as 5 telas em sequência", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Menos indecisão/ })).toBeVisible();

  await page.getByRole("link", { name: "Criar uma sala" }).click();
  await expect(page).toHaveURL(/\/criar$/);

  await page.getByRole("link", { name: "Criar sala e convidar" }).click();
  await expect(page).toHaveURL(/\/sala$/);
  await expect(page.getByText("MFX 824")).toBeVisible();

  await page.getByRole("link", { name: "Todos aqui? Começar" }).click();
  await expect(page).toHaveURL(/\/escolher$/);

  await page.getByRole("button", { name: /Quero assistir/ }).click();
  await expect(page).toHaveURL(/\/match$/);
  await expect(page.getByRole("heading", { name: "Deu match." })).toBeVisible();

  await page.getByRole("link", { name: "Continuar escolhendo" }).click();
  await expect(page).toHaveURL(/\/escolher$/);
});

test.describe("Criar sala", () => {
  test("gêneros: 'Todos' é exclusivo e nunca fica vazio", async ({ page }) => {
    await page.goto("/criar");
    const todos = page.getByLabel("Todos", { exact: true });
    const acao = page.getByLabel("Ação", { exact: true });
    const terror = page.getByLabel("Terror", { exact: true });

    await expect(todos).toBeChecked();
    await acao.check();
    await terror.check();
    await expect(todos).not.toBeChecked();
    await expect(acao).toBeChecked();
    await expect(terror).toBeChecked();

    await acao.uncheck();
    await terror.uncheck();
    await expect(todos).toBeChecked();

    await acao.check();
    await todos.check();
    await expect(acao).not.toBeChecked();
  });

  test("o nome digitado aparece no ingresso; vazio mostra o texto padrão", async ({ page }) => {
    await page.goto("/criar");
    const ticket = page.getByRole("complementary", { name: "Seu ingresso para hoje" });

    await page.getByLabel("Nome da sala", { exact: true }).fill("Noite do Arthur");
    await expect(ticket).toContainText("Noite do Arthur");

    await page.getByLabel("Nome da sala", { exact: true }).fill("");
    await expect(ticket).toContainText("Nome da sala");
  });

  test("modo de assistir: só uma opção marcada", async ({ page }) => {
    await page.goto("/criar");
    await expect(page.getByLabel("Na mesma casa")).toBeChecked();
    await page.getByLabel("Cada um na sua").check();
    await expect(page.getByLabel("Na mesma casa")).not.toBeChecked();
  });
});

test("Sala de espera: copiar link de convite usa a área de transferência", async ({ page }) => {
  await page.goto("/sala");
  await page.getByRole("button", { name: "Copiar link de convite" }).click();
  await expect(page.getByRole("button", { name: "Link copiado" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/\/entrar\?codigo=MFX824$/);
  await expect(page.getByRole("button", { name: "Copiar link de convite" })).toBeVisible();
});

test.describe("Escolher filme", () => {
  const counter = (n: number) => `0${n} / 20 filmes`;

  test("Passar avança os filmes de demonstração e o contador", async ({ page }) => {
    await page.goto("/escolher");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("A última sessão");
    await expect(page.getByText(counter(4))).toBeVisible();

    await page.getByRole("button", { name: "Passar" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Horizonte");
    await expect(page.getByText(counter(5))).toBeVisible();

    await page.getByRole("button", { name: "Passar" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Silêncio");
  });

  test("setas do teclado: ← passa, → aprova", async ({ page }) => {
    await page.goto("/escolher");
    // Espera a hidratação (o listener de teclado é registrado em useEffect) antes de teclar.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Horizonte");
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\/match$/);
  });

  test("arrastar o pôster: esquerda passa, direita aprova", async ({ page }) => {
    await page.goto("/escolher");
    const poster = page.getByAltText(/A última sessão/);
    const box = (await poster.boundingBox())!;
    const y = box.y + box.height / 2;

    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 10, y, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Horizonte");

    const next = (await page.getByAltText(/Horizonte/).boundingBox())!;
    await page.mouse.move(next.x + 40, next.y + 100);
    await page.mouse.down();
    await page.mouse.move(next.x + 260, next.y + 100, { steps: 8 });
    await page.mouse.up();
    await expect(page).toHaveURL(/\/match$/);
  });

  test("arraste curto não vota", async ({ page }) => {
    await page.goto("/escolher");
    const box = (await page.getByAltText(/A última sessão/).boundingBox())!;
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + 100, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("A última sessão");
    await expect(page).toHaveURL(/\/escolher$/);
  });
});

test("Match: 'Ver opções para assistir' avisa que ainda não existe", async ({ page }) => {
  await page.goto("/match");
  await page.getByRole("button", { name: "Ver opções para assistir" }).click();
  await expect(page.getByRole("button", { name: "Em breve" })).toBeVisible();
});

test("botões sem função ficam marcados como indisponíveis", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Entrar com código" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: "Brasil · PT" })).toHaveAttribute("aria-disabled", "true");
});
