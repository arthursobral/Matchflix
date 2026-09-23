import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Confere as caixas dos elementos contra as coordenadas do design aprovado
 * (Matchflix-Design-Aprovado-v1). Só elementos de tamanho fixo por CSS, para o resultado
 * não depender das fontes do sistema (Georgia e Segoe UI não existem nos runners Linux).
 * Formato: [x, y, largura, altura].
 */
type Box = [number, number, number, number];
type Check = { name: string; find: (page: Page) => Locator; box: Box };
type Screen = { path: string; checks: Check[] };

// ponytail: 3px localmente (Chrome + Georgia/Segoe UI instaladas), mas o runner do CI é
// Linux sem essas fontes (proprietárias, sem licença para redistribuir — ver docs/m0).
// O texto renderiza com a fonte de sistema alternativa, com métricas um pouco diferentes,
// o que desloca em cascata os elementos que vêm depois em cada tela (até ~12px observado).
// Upgrade: instalar fontes metricamente compatíveis no CI (ex.: Gelasio p/ Georgia) e
// reduzir a tolerância, se algum dia isso importar mais que velocidade do CI.
const TOLERANCE = process.env.CI ? 16 : 3;

const link = (name: string) => (p: Page) => p.getByRole("link", { name, exact: true });
const button = (name: string) => (p: Page) => p.getByRole("button", { name, exact: true });
const alt = (title: string) => (p: Page) => p.getByAltText(new RegExp(title));
const label = (text: string) => (p: Page) => p.getByLabel(text, { exact: true });

const desktop: Screen[] = [
  {
    path: "/",
    checks: [
      { name: "Criar uma sala", find: link("Criar uma sala"), box: [84, 526, 244, 52] },
      { name: "Entrar com código", find: button("Entrar com código"), box: [344, 526, 244, 52] },
      { name: "pôster Horizonte", find: alt("Horizonte"), box: [927, 167, 260, 376] },
    ],
  },
  {
    path: "/criar",
    checks: [
      { name: "campo nome", find: label("Nome da sala"), box: [670, 191, 650, 52] },
      { name: "pílula Todos", find: label("Todos"), box: [670, 501, 152, 34] },
      { name: "Criar sala e convidar", find: link("Criar sala e convidar"), box: [670, 731, 650, 52] },
    ],
  },
  {
    path: "/sala",
    checks: [
      { name: "Copiar link de convite", find: button("Copiar link de convite"), box: [116, 584, 469, 52] },
      { name: "Todos aqui? Começar", find: link("Todos aqui? Começar"), box: [737, 624, 583, 52] },
    ],
  },
  {
    path: "/escolher",
    checks: [
      { name: "Passar", find: button("Passar"), box: [420, 675, 147, 56] },
      { name: "Quero assistir", find: button("Quero assistir"), box: [581, 675, 180, 56] },
      { name: "pôster", find: alt("A última sessão"), box: [422, 188, 312, 451] },
    ],
  },
  {
    path: "/match",
    checks: [
      { name: "pôster", find: alt("A última sessão"), box: [278, 198, 334, 483] },
      { name: "Ver opções para assistir", find: button("Ver opções para assistir"), box: [735, 670, 593, 52] },
      { name: "Continuar escolhendo", find: link("Continuar escolhendo"), box: [735, 735, 593, 52] },
    ],
  },
];

const mobile: Screen[] = [
  {
    path: "/",
    checks: [
      { name: "Criar uma sala", find: link("Criar uma sala"), box: [24, 652, 342, 52] },
      { name: "Entrar com código", find: button("Entrar com código"), box: [24, 716, 342, 52] },
      { name: "pôster Horizonte", find: alt("Horizonte"), box: [105, 331, 180, 260] },
    ],
  },
  {
    path: "/criar",
    checks: [
      { name: "campo nome", find: label("Nome da sala"), box: [24, 272, 342, 52] },
      { name: "pílula Todos", find: label("Todos"), box: [24, 554, 108, 34] },
      { name: "Criar sala e convidar", find: link("Criar sala e convidar"), box: [24, 759, 342, 52] },
    ],
  },
  {
    path: "/sala",
    checks: [
      { name: "Copiar link de convite", find: button("Copiar link de convite"), box: [48, 360, 294, 46] },
      { name: "Todos aqui? Começar", find: link("Todos aqui? Começar"), box: [24, 780, 342, 52] },
    ],
  },
  {
    path: "/escolher",
    checks: [
      { name: "Passar", find: button("Passar"), box: [24, 768, 137, 56] },
      { name: "Quero assistir", find: button("Quero assistir"), box: [173, 768, 193, 56] },
      { name: "pôster", find: alt("A última sessão"), box: [93, 196, 204, 295] },
    ],
  },
  {
    path: "/match",
    checks: [
      { name: "pôster", find: alt("A última sessão"), box: [129, 270, 132, 191] },
      { name: "Ver opções para assistir", find: button("Ver opções para assistir"), box: [24, 753, 342, 52] },
      { name: "Continuar escolhendo", find: link("Continuar escolhendo"), box: [24, 817, 342, 44] },
    ],
  },
];

async function expectBox(locator: Locator, expected: Box) {
  const box = await locator.boundingBox();
  expect(box, "elemento não encontrado ou invisível").not.toBeNull();
  const actual = [box!.x, box!.y, box!.width, box!.height];
  const names = ["x", "y", "largura", "altura"];
  actual.forEach((value, i) => {
    expect(Math.abs(value - expected[i]), `${names[i]}: esperado ${expected[i]}, obtido ${Math.round(value)}`).toBeLessThanOrEqual(TOLERANCE);
  });
}

for (const [device, viewport, screens] of [
  ["desktop 1440×1000", { width: 1440, height: 1000 }, desktop],
  ["mobile 390×920", { width: 390, height: 920 }, mobile],
] as const) {
  test.describe(`layout ${device}`, () => {
    test.use({ viewport });

    for (const screen of screens) {
      test(`${screen.path} confere com o design aprovado`, async ({ page }) => {
        await page.goto(screen.path);
        for (const check of screen.checks) {
          await test.step(check.name, async () => expectBox(check.find(page), check.box));
        }
      });
    }
  });
}

test("desktop: não há rolagem horizontal em nenhuma tela", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const path of ["/", "/criar", "/sala", "/escolher", "/match"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `rolagem horizontal em ${path}`).toBeLessThanOrEqual(0);
  }
});

test("mobile: não há rolagem horizontal em nenhuma tela", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 920 });
  for (const path of ["/", "/criar", "/sala", "/escolher", "/match"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `rolagem horizontal em ${path}`).toBeLessThanOrEqual(0);
  }
});

test("o rodapé não fica com um vão gigante num aparelho mais alto que a referência do design", async ({ page }) => {
  // Achado pelo usuário testando num iPhone 16 Pro Max: um .page com min-height: 100vh e
  // footer com margin-top: auto gruda o rodapé no fim da viewport, e num aparelho bem mais
  // alto que os 920px de referência isso vira um vão vazio enorme entre o conteúdo e o rodapé.
  await page.setViewportSize({ width: 390, height: 1400 });
  for (const path of ["/", "/criar", "/sala", "/escolher", "/match"]) {
    await page.goto(path);
    const gap = await page.evaluate(() => {
      const footerEl = document.querySelector("footer")!;
      const footer = footerEl.getBoundingClientRect();
      // Maior "bottom" entre os irmãos visíveis antes do rodapé (a Início tem uma seção
      // oculta no mobile via display:none, que não deve contar como o fim do conteúdo).
      const bottoms = [...footerEl.parentElement!.children]
        .filter((el) => el !== footerEl && el.tagName !== "HEADER")
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => r.bottom);
      return Math.round(footer.top - Math.max(0, ...bottoms));
    });
    expect(gap, `vão acima do rodapé em ${path}`).toBeLessThanOrEqual(100);
  }
});
