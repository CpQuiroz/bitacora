/**
 * Contraste WCAG 2.x (tarea 154) — JS puro (web, RN/Hermes y backend).
 * Una sola implementación para decidir el texto sobre el color de marca
 * (antes había 3 copias con una fórmula de brillo YIQ que no garantizaba
 * AA: blanco sobre el terracota por defecto daba 3,6:1).
 */
import { oscurecerOklch } from "./oklch";

export const AA_TEXTO_NORMAL = 4.5;
export const TEXTO_CLARO = "#ffffff";
export const TEXTO_OSCURO = "#1a1a1a";

function canales(hex: string): [number, number, number] {
  const limpio = hex.replace("#", "").trim();
  const full = limpio.length === 3 ? limpio.split("").map((c) => c + c).join("") : limpio;
  const n = parseInt(full.slice(0, 6) || "000000", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminancia relativa WCAG de un color #rrggbb. */
export function luminanciaRelativa(hex: string): number {
  const [r, g, b] = canales(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste WCAG entre dos colores (1 a 21). */
export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminanciaRelativa(a), luminanciaRelativa(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** El texto (blanco o casi negro) con más contraste sobre `fondo`. */
export function textoSobreFondo(fondo: string): string {
  return contraste(TEXTO_CLARO, fondo) >= contraste(TEXTO_OSCURO, fondo) ? TEXTO_CLARO : TEXTO_OSCURO;
}

/**
 * Fondo y texto legibles para un color de marca: si con blanco o casi negro
 * se llega a AA (4,5:1), el fondo queda igual; si no (p. ej. el naranja del
 * tema Taller, #d1580f: 4,1 con blanco, 4,2 con negro), se oscurece el
 * fondo en OKLab —mismo tono— hasta que el blanco llegue a AA.
 */
export function marcaLegible(color: string): { fondo: string; texto: string } {
  const texto = textoSobreFondo(color);
  if (contraste(texto, color) >= AA_TEXTO_NORMAL) return { fondo: color, texto };
  let fondo = color;
  for (let paso = 1; paso <= 40 && contraste(TEXTO_CLARO, fondo) < AA_TEXTO_NORMAL; paso++) {
    fondo = oscurecerOklch(color, paso * 0.01);
  }
  return { fondo, texto: TEXTO_CLARO };
}
