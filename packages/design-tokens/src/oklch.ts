/**
 * Derivación de color en OKLab — JS puro (sirve en RN/Hermes, sin CSS).
 * El web deriva --ds-brand-hover / --ds-brand-pressed con
 * `oklch(from var(--ds-brand) calc(l - N) c h)`; esto replica lo mismo
 * para mobile. Matrices de Björn Ottosson (bottosson.github.io/posts/oklab).
 */

type RGB = { r: number; g: number; b: number };

function parseHex(hex: string): RGB {
  const limpio = hex.replace("#", "").trim();
  const full = limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio;
  const n = parseInt(full.slice(0, 6) || "000000", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }: RGB): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

const sRgbALineal = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linealASRgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/**
 * Baja la luminosidad de `color` en `deltaL` (0..1) en OKLab, manteniendo
 * a/b (tono y croma). Devuelve `#rrggbb`.
 */
export function oscurecerOklch(color: string, deltaL: number): string {
  const { r: r255, g: g255, b: b255 } = parseHex(color);
  const r = sRgbALineal(r255 / 255);
  const g = sRgbALineal(g255 / 255);
  const b = sRgbALineal(b255 / 255);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  let L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  L = Math.max(0, Math.min(1, L - deltaL));

  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.291485548 * B;
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  return toHex({
    r: linealASRgb(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3) * 255,
    g: linealASRgb(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3) * 255,
    b: linealASRgb(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3) * 255,
  });
}
