/**
 * Mezcla dos colores hex en sRGB (canal por canal, sin pasar a luz
 * lineal) — para derivar un tinte suave (hacia blanco) o una sombra
 * fuerte (hacia negro) de un color arbitrario elegido por el usuario
 * (empresas.color_secundario), en vez de mantener un ramp fijo.
 *
 * Por qué NO oklch/oscurecerOklch acá: subir la luminosidad (L) en
 * OKLab manteniendo el croma/tono (a/b) fijos se sale de gamut para
 * varios tonos reales de empresa (probado con un teal #0d9488: a los
 * pocos pasos da un cian casi blanco, perdiendo el matiz) — el mismo
 * problema que resuelve `color-mix(in srgb, ...)` en el CSS del lado
 * web (ver packages/design-tokens/src/build.ts). Mezclar en sRGB es
 * una interpolación lineal dentro del cubo RGB: nunca se sale de
 * gamut, sin importar el tono de entrada. Calibrado contra el ramp
 * accent2 real (accent2Ramp 200/800) — t≈0.78 hacia blanco y t≈0.50
 * hacia negro dan un resultado visualmente equivalente.
 */
function parseHex(hex: string): { r: number; g: number; b: number } {
  const limpio = hex.replace("#", "").trim();
  const full = limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio;
  const n = parseInt(full.slice(0, 6) || "000000", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function mezclarHex(colorA: string, colorB: string, t: number): string {
  const a = parseHex(colorA);
  const b = parseHex(colorB);
  const lerp = (ca: number, cb: number) => ca * (1 - t) + cb * t;
  return toHex({ r: lerp(a.r, b.r), g: lerp(a.g, b.g), b: lerp(a.b, b.b) });
}

/** Tinte suave (fondo de tag/badge) a partir de un color base. */
export function tinteSuave(base: string): string {
  return mezclarHex(base, "#ffffff", 0.78);
}

/** Tono fuerte (texto legible sobre el tinte suave) a partir de un color base. */
export function tonoFuerte(base: string): string {
  return mezclarHex(base, "#000000", 0.5);
}
