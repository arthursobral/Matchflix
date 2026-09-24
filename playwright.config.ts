import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const PORT = 3100; // porta própria para não colidir com o `npm run dev` (3000)

// Playwright não carrega .env.local sozinho (diferente do Next, que o webServer abaixo
// usa por baixo dos panos). Lemos aqui só para decidir se os testes que dependem de um
// projeto Supabase configurado devem rodar — o app em si recebe as variáveis via o
// próprio `next start`, não daqui.
const envLocal = path.join(__dirname, ".env.local");
if (fs.existsSync(envLocal)) {
  for (const line of fs.readFileSync(envLocal, "utf8").split("\n")) {
    const m = line.match(/^([\w.-]+)\s*=\s*(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

/** Só true quando há um projeto Supabase configurado (ex.: localmente, com .env.local). */
export const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Testes que tocam um Supabase de verdade criam sessões anônimas, que têm limite de
  // taxa por padrão. Em paralelo (vários workers criando sessões ao mesmo tempo), esse
  // limite estoura rápido e os testes ficam instáveis — não é bug do app. No CI não há
  // Supabase configurado (esses testes pulam sozinhos), então o paralelismo cheio ali é seguro.
  workers: hasSupabase ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Local: usa o Chrome instalado (sem baixar navegador). CI: Chromium do Playwright.
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
    // O app desliga suas transições (halo, arraste) nesse modo — evita testes instáveis
    // por medirem a posição de um elemento ainda em animação (transition: transform 250ms).
    reducedMotion: "reduce",
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
