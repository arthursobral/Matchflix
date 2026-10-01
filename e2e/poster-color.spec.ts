import { expect, test } from "@playwright/test";
import { dominantColor } from "../lib/poster-color";

/** Monta pixels RGBA: `[cor, quantos pixels]`. */
function pixels(...parts: [[number, number, number], number][]) {
  const out: number[] = [];
  for (const [[r, g, b], n] of parts) for (let i = 0; i < n; i++) out.push(r, g, b, 255);
  return new Uint8ClampedArray(out);
}

function hueOf([r, g, b]: [number, number, number]) {
  if (r >= g && r >= b) return "vermelho";
  if (g >= r && g >= b) return "verde";
  return "azul";
}

test.describe("cor do halo a partir do pôster", () => {
  test("pôster claramente vermelho vira halo vermelho", () => {
    expect(hueOf(dominantColor(pixels([[200, 30, 40], 500]))!)).toBe("vermelho");
  });

  test("pôster escuro com um detalhe azul vira halo azul, não cinza", () => {
    const color = dominantColor(pixels([[10, 10, 12], 450], [[30, 60, 220], 60]));
    expect(hueOf(color!)).toBe("azul");
  });

  test("pôster preto e branco não inventa cor: halo neutro", () => {
    expect(dominantColor(pixels([[0, 0, 0], 200], [[255, 255, 255], 200], [[128, 128, 128], 100]))).toBeNull();
  });

  test("pôster multicolorido fica com a cor que mais domina", () => {
    const color = dominantColor(pixels([[220, 40, 40], 60], [[40, 200, 60], 300], [[40, 60, 220], 80]));
    expect(hueOf(color!)).toBe("verde");
  });

  test("brilho e saturação ficam dentro da faixa segura (não estoura nem some no fundo)", () => {
    for (const c of [
      dominantColor(pixels([[255, 250, 0], 400]))!, // amarelo berrante
      dominantColor(pixels([[40, 0, 0], 400]))!, // vermelho quase preto
    ]) {
      const l = (Math.max(...c) + Math.min(...c)) / 2 / 255;
      expect(l).toBeGreaterThanOrEqual(0.39);
      expect(l).toBeLessThanOrEqual(0.56);
    }
  });
});
