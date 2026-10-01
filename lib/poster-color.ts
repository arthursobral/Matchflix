export type Rgb = [number, number, number];

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Cor representativa de um pôster a partir dos pixels RGBA. Agrupa por matiz, pesando pela
 * intensidade da cor (croma) — assim quase-preto, quase-branco e cinza não "diluem" a cor de
 * verdade, e um pôster escuro com um detalhe azul vira azul. Depois limita saturação e brilho:
 * o halo é luz ambiente, não pode sumir no grafite nem brigar com o vermelho da marca.
 * `null` = pôster sem cor dominante (preto e branco, quase todo escuro) → halo neutro.
 */
export function dominantColor(data: Uint8ClampedArray): Rgb | null {
  const buckets = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    if (chroma < 0.15) continue;
    const bucket = buckets[Math.floor(rgbToHsl(r, g, b)[0] * 12) % 12];
    bucket.w += chroma;
    bucket.r += r * chroma;
    bucket.g += g * chroma;
    bucket.b += b * chroma;
  }
  const best = buckets.reduce((a, c) => (c.w > a.w ? c : a));
  if (best.w < (data.length / 4) * 0.02) return null;
  const [h, s, l] = rgbToHsl(best.r / best.w, best.g / best.w, best.b / best.w);
  return hslToRgb(h, clamp(s, 0.35, 0.7), clamp(l, 0.4, 0.55));
}

/** Mesmo desenho dos halos do design aprovado (globals.css, `--halo-*`), com a cor do pôster. */
export function haloGradient([r, g, b]: Rgb): string {
  return `radial-gradient(closest-side, rgb(${r} ${g} ${b} / 0.3), rgb(${r} ${g} ${b} / 0.12) 55%, rgb(22 22 24 / 0))`;
}

/** Lê o pôster (versão pequena do TMDB, que libera CORS) e devolve a cor do halo. Só no navegador. */
export function posterColor(url: string): Promise<Rgb | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, size, size);
        resolve(dominantColor(ctx.getImageData(0, 0, size, size).data));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url.replace("/w500/", "/w92/");
  });
}
