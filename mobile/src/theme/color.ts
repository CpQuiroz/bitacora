// Utilidades de color en JS puro — React Native no tiene color-mix()
// como el CSS del web. Todo trabaja sobre hex #rrggbb.

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

/** Mezcla `color` con `fondo` — cantidad = peso de `color` (0..1). */
export function mezclar(color: string, fondo: string, cantidad: number): string {
  const c = parseHex(color);
  const f = parseHex(fondo);
  const t = Math.max(0, Math.min(1, cantidad));
  return toHex({
    r: c.r * t + f.r * (1 - t),
    g: c.g * t + f.g * (1 - t),
    b: c.b * t + f.b * (1 - t),
  });
}

/** Aclara un color mezclándolo con blanco. */
export function aclarar(color: string, cantidad: number): string {
  return mezclar(color, "#ffffff", 1 - cantidad);
}

/**
 * Devuelve "#ffffff" o "#111111" según cuál contraste mejor sobre `fondo`.
 * Mismo criterio de luminancia que usa el web al calcular
 * empresas.color_primario_foreground.
 */
export function contraste(fondo: string): string {
  const { r, g, b } = parseHex(fondo);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111111" : "#ffffff";
}

/** true si `valor` parece un hex válido de 3 o 6 dígitos. */
export function esHexValido(valor: string | null | undefined): valor is string {
  return typeof valor === "string" && /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(valor.trim());
}
