import { expect, test, type Route } from "@playwright/test";
import { hasSupabase, hasTmdb } from "../playwright.config";
import { createTestRoom, joinTestRoom } from "./helpers";

test.use({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });

test("percorre as 5 telas em sequência", async ({ page }) => {
  test.skip(!hasSupabase, "criar/entrar em sala precisa de um projeto Supabase configurado (.env.local)");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Menos indecisão/ })).toBeVisible();

  await page.getByRole("link", { name: "Criar uma sala" }).click();
  await expect(page).toHaveURL(/\/criar$/);

  await page.getByRole("button", { name: "Criar sala e convidar" }).click();
  await page.getByLabel("Seu apelido", { exact: true }).fill("Teste");
  await page.getByRole("button", { name: "Criar sala", exact: true }).click();
  await expect(page).toHaveURL(/\/sala\/MFX\d{3}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cinema de sexta");

  await page.getByRole("button", { name: "Todos aqui? Começar" }).click();
  // Timeout maior: montar o baralho agora chama o TMDB de verdade (M4), mais lento que
  // a demonstração fixa do M1.
  await expect(page).toHaveURL(/\/escolher\/MFX\d{3}$/, { timeout: 25_000 });

  // M5: voto de verdade. Sozinho na sala, aprovar já é unanimidade.
  await page.getByRole("button", { name: /Quero assistir/ }).click();
  await expect(page).toHaveURL(/\/match\/MFX\d{3}\/\w+$/);
  // Timeout maior: a tela de match real busca a sala, a rodada e o filme (TMDB) antes de
  // renderizar — mais lento que o reveal fixo da demonstração.
  await expect(page.getByRole("heading", { name: "Deu match." })).toBeVisible({ timeout: 25_000 });

  await page.getByRole("link", { name: "Continuar escolhendo" }).click();
  await expect(page).toHaveURL(/\/escolher\/MFX\d{3}$/);
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
  test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");
  const code = await createTestRoom(page);

  await page.getByRole("button", { name: "Copiar link de convite" }).click();
  await expect(page.getByRole("button", { name: "Link copiado" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`http://localhost:3100/entrar?codigo=${code}`);
  await expect(page.getByRole("button", { name: "Copiar link de convite" })).toBeVisible();
});

test.describe("Entrar por código", () => {
  test("duas pessoas em sessões diferentes entram na mesma sala", async ({ page, browser }) => {
    test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");

    const code = await createTestRoom(page, "Sala compartilhada");
    await expect(page.locator("li strong")).toHaveText([/Teste · Você/]);

    // Segunda pessoa: sessão (contexto) totalmente separada, como um outro aparelho.
    const guestPage = await (await browser.newContext()).newPage();
    await guestPage.goto(`/entrar?codigo=${code}`);
    await expect(guestPage.getByLabel("Código da sala")).toHaveValue(code);
    await guestPage.getByLabel("Seu apelido", { exact: true }).fill("Convidado");
    await guestPage.getByRole("button", { name: "Juntar-se" }).click();
    await expect(guestPage).toHaveURL(new RegExp(`/sala/${code}$`));
    await expect(guestPage.locator("li strong")).toHaveText([/Teste/, /Convidado · Você/]);

    // M3: o anfitrião vê o convidado ao vivo, via Realtime, sem recarregar.
    await expect(page.locator("li strong")).toHaveText([/Teste · Você/, /Convidado/]);
  });

  test("código inexistente mostra mensagem clara", async ({ page }) => {
    test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");
    await page.goto("/entrar?codigo=MFX000");
    await page.getByLabel("Seu apelido", { exact: true }).fill("Alguém");
    await page.getByRole("button", { name: "Juntar-se" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText("Não achamos essa sala. Confira o código.");
  });

  test("desafio interativo do Cloudflare aparece por cima do modal e pode ser resolvido", async ({ page }) => {
    // Chave de teste do Cloudflare que sempre pede interação (como acontece com quem parece robô).
    test.skip(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY !== "3x00000000000000000000FF", "rode com NEXT_PUBLIC_TURNSTILE_SITE_KEY=3x00000000000000000000FF");
    test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");
    await page.goto("/criar");
    await page.getByRole("button", { name: "Criar sala e convidar" }).click();
    await page.getByLabel("Seu apelido", { exact: true }).fill("Teste");
    await page.getByRole("button", { name: "Criar sala", exact: true }).click();
    // O modal do apelido é um <dialog> (camada de cima, resto da página inerte): o quadro do
    // desafio tem que ficar por cima dele, senão ninguém consegue resolver e a sala nunca é criada.
    const overlay = page.locator('div[style*="z-index: 9999"]');
    await expect(overlay).toHaveCSS("opacity", "1", { timeout: 20_000 });
    await page.waitForTimeout(2000); // o widget do Cloudflare termina de desenhar
    const box = await overlay.evaluate((o) => {
      const r = o.firstElementChild!.getBoundingClientRect();
      return { x: r.x, y: r.y, h: r.height, onTop: o.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
    });
    expect(box.onTop, "o desafio ficou escondido atrás de outra coisa").toBe(true);
    await page.mouse.click(box.x + 48, box.y + box.h / 2); // a caixinha "confirme que é humano"
    await page.waitForURL(/\/sala\//, { timeout: 20_000 });
  });

  // O CAPTCHA depende da rede até o Cloudflare: quando ela falha, a pessoa precisa de
  // uma mensagem clara e de um "tente de novo" que funcione sem recarregar a página.
  for (const failure of [
    {
      name: "desafio do Cloudflare que nunca responde não prende a entrada na sala",
      urls: "https://challenges.cloudflare.com/cdn-cgi/challenge-platform/**",
      // Nem sucesso nem erro: o pedido fica pendurado (rede instável, firewall).
      block: () => undefined,
      message: /demorou demais/,
    },
    {
      name: "script do Cloudflare que falha ao carregar pode ser carregado de novo",
      urls: "https://challenges.cloudflare.com/turnstile/**",
      block: (route: Route) => route.abort(),
      message: /Não foi possível carregar a verificação de segurança/,
    },
  ]) {
    test(failure.name, async ({ page, browser }) => {
      test.skip(!hasSupabase || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, "precisa de Supabase e de NEXT_PUBLIC_TURNSTILE_SITE_KEY");
      test.setTimeout(60_000);
      const code = await createTestRoom(page);

      let offline = true;
      const guest = await (await browser.newContext()).newPage();
      await guest.route(failure.urls, (route) => (offline ? failure.block(route) : route.continue()));
      await guest.goto(`/entrar?codigo=${code}`);
      await guest.getByLabel("Seu apelido", { exact: true }).fill("Convidado");
      await guest.getByRole("button", { name: "Juntar-se" }).click();
      await expect(guest.locator('p[role="alert"]')).toHaveText(failure.message, { timeout: 25_000 });

      offline = false;
      await guest.getByRole("button", { name: "Juntar-se" }).click();
      await expect(guest).toHaveURL(new RegExp(`/sala/${code}$`), { timeout: 15_000 });
    });
  }
});

test.describe("Início de rodada", () => {
  test("o anfitrião inicia e todos na sala vão para a escolha ao mesmo tempo", async ({ page, browser }) => {
    test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");

    const code = await createTestRoom(page);
    const guestPage = await (await browser.newContext()).newPage();
    await joinTestRoom(guestPage, code, "Convidado");

    await page.getByRole("button", { name: "Todos aqui? Começar" }).click();

    // Timeout maior: montar o baralho e buscar os detalhes de cada filme agora chama o
    // TMDB de verdade (M4), mais lento que a demonstração fixa do M1.
    await expect(page).toHaveURL(new RegExp(`/escolher/${code}$`), { timeout: 25_000 });
    await expect(guestPage).toHaveURL(new RegExp(`/escolher/${code}$`), { timeout: 25_000 });

    // Mesmo baralho, mesma ordem: o primeiro filme é o mesmo para os dois.
    const hostTitle = await page.getByRole("heading", { level: 1 }).textContent({ timeout: 25_000 });
    await expect(guestPage.getByRole("heading", { level: 1 })).toHaveText(hostTitle!, { timeout: 25_000 });
  });

  test("'Mais sobre o filme' leva para a tela de detalhes do mesmo filme", async ({ page }) => {
    test.skip(!hasSupabase || !hasTmdb, "precisa de Supabase e TMDB_API_KEY configurados (.env.local)");

    await createTestRoom(page);
    await page.getByRole("button", { name: "Todos aqui? Começar" }).click();
    await expect(page).toHaveURL(/\/escolher\//, { timeout: 25_000 });

    const title = await page.getByRole("heading", { level: 1 }).textContent({ timeout: 25_000 });
    await page.getByRole("link", { name: /Mais sobre o filme/ }).click();

    await expect(page).toHaveURL(/\/filme\/\d+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title!);
  });

  test("quem não é anfitrião não vê o botão de começar como clicável", async ({ page, browser }) => {
    test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");

    const code = await createTestRoom(page);
    const guestPage = await (await browser.newContext()).newPage();
    await joinTestRoom(guestPage, code, "Convidado");

    // Marcado como indisponível (mesmo padrão de botão sem ação do design aprovado, com
    // `aria-disabled`, não o atributo nativo `disabled`) — a pessoa nem consegue clicar; o
    // Playwright já recusa a ação por "not enabled", prova de que não há nada pra acontecer.
    await expect(guestPage.getByRole("button", { name: "Todos aqui? Começar" })).toHaveAttribute("aria-disabled", "true");
    await expect(guestPage).toHaveURL(new RegExp(`/sala/${code}$`));
  });
});

test.describe("Reconexão", () => {
  test("entrar de novo com a mesma sessão não duplica o participante", async ({ page, browser }) => {
    test.skip(!hasSupabase, "precisa de um projeto Supabase configurado (.env.local)");

    const code = await createTestRoom(page);
    const guestPage = await (await browser.newContext()).newPage();
    await joinTestRoom(guestPage, code, "Convidado");
    await joinTestRoom(guestPage, code, "Convidado"); // mesma sessão (mesmo contexto), entra de novo

    await page.reload();
    await expect(page.locator("li")).toHaveCount(2);
  });
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

test("botões do início que já ganharam função não ficam mais marcados como indisponíveis", async ({ page }) => {
  await page.goto("/");
  // O seletor "Brasil · PT" passou a trocar o idioma (ver idioma.spec.ts).
  await expect(page.getByRole("button", { name: "Mudar o idioma para inglês" })).not.toHaveAttribute("aria-disabled", "true");
  // "Entrar com código" já tem função (M2): é um link de verdade para /entrar.
  await expect(page.getByRole("link", { name: "Entrar com código" })).toHaveAttribute("href", "/entrar");
});
