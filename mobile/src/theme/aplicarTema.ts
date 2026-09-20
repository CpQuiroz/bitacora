import { tokens } from "@bitacora/design-tokens";
import type { Empresa } from "@bitacora/shared";

// Tema por empresa en mobile (20-sep-2026) — mismo dato que ya usa la web
// (empresas.tema, PATCH /api/empresa) pero un mecanismo distinto para
// aplicarlo: la web cambia colores vía variables CSS que cascadean solas
// (packages/design-tokens/src/build.ts, bloques [data-tema="x"]). React
// Native no tiene cascada — `tokens.color.*` se lee inline en ~800 lugares
// (72 archivos) de mobile/ y packages/ui/, así que portar el mecanismo de
// la web (Context + hook) sería un refactor enorme para lo que se pidió
// ("cambio de colores").
//
// En vez de eso: `tokens` es un único objeto JS compartido (no
// Object.freeze — `as const` es solo de TypeScript), y casi todos esos
// ~800 usos leen `tokens.color.X` fresco en cada render, no una constante
// congelada a nivel de módulo. Mutar `tokens.color` in-place hace que TODO
// ese código existente recoja la paleta nueva sin tocar los 72 archivos —
// alcanza con llamar aplicarTemaMobile() una vez cuando cambia
// usuario.empresa.tema (ver AuthContext.tsx) para que el próximo render
// ya la use.
//
// Deliberadamente NO toca tipografía: en la web, "Taller" también cambia
// la fuente (tokens.fontTaller), pero mobile precarga con useFonts() solo
// Caprasimo/Figtree (mobile/src/shell/App.tsx, packages/ui/src/native/
// fuentes.ts) — agregar Archivo/IBM Plex Sans es un cambio aparte, más
// grande, que no se pidió acá ("cambio de COLORES"). "Confianza" en la
// web tampoco cambia tipografía, así que ese tema queda idéntico en
// ambas plataformas; "Taller" en mobile es solo-color por ahora.

// Tipo ensanchado a propósito (no `typeof tokens.color`): tokens.json
// tiene `as const`, así que cada paleta (color/colorTaller/colorConfianza)
// infiere sus propios literales exactos ("#f5ead8" vs "#eceae4", ...) —
// tipos distintos e incompatibles entre sí para TS aunque tengan la misma
// forma. Acá solo importa la FORMA (todas son la misma), no el valor.
type Paleta = {
  bg: string;
  surface: string;
  text: string;
  accent: string;
  accent2: string;
  divider: string;
  neutral: Record<string, string>;
  accentRamp: Record<string, string>;
  accent2Ramp: Record<string, string>;
};

// Snapshot de "faena" tomado ANTES de cualquier mutación — tokens.color
// ya ES la paleta faena por defecto (ver generated.ts), así que este
// snapshot es lo que se restaura si el usuario vuelve a "faena".
const PALETA_FAENA: Paleta = { ...tokens.color };

const PALETAS: Record<Empresa["tema"], Paleta> = {
  faena: PALETA_FAENA,
  taller: tokens.colorTaller,
  confianza: tokens.colorConfianza,
};

let temaAplicado: Empresa["tema"] | null = null;

/** Aplica la paleta de `tema` mutando tokens.color in-place. Se llama
 * sincrónicamente durante el render de `NavegacionConTema` (shell/App.tsx)
 * — no en un useEffect, para que ya esté aplicada antes del primer render
 * de la navegación (ver comentario ahí). No-op si ya está aplicado. */
export function aplicarTemaMobile(tema: Empresa["tema"] | undefined): void {
  const t = tema && PALETAS[tema] ? tema : "faena";
  if (t === temaAplicado) return;
  temaAplicado = t;
  // Object.assign copia solo las claves de primer nivel (bg, surface,
  // accent, neutral, accentRamp, ...) — neutral/accentRamp/accent2Ramp se
  // reemplazan por el objeto completo del tema nuevo, no se mezclan
  // clave a clave, que es lo que corresponde (son rampas de 9 pasos
  // completas y consistentes entre sí, no colores sueltos).
  Object.assign(tokens.color, PALETAS[t]);
}
