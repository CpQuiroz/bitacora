/**
 * Generador de artefactos de tokens. Fuente de verdad: ../tokens.json.
 * Corre con `npm run gen` (tsx). Emite:
 *   - ../tokens.css        → custom properties + @theme para Tailwind v4 (web)
 *   - ./generated.ts       → objeto tipado `as const` (Expo / RN / TS)
 *
 * NO editar tokens.css ni generated.ts a mano: se pisan en cada build.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..");
const tokens = JSON.parse(readFileSync(join(RAIZ, "tokens.json"), "utf8")) as Tokens;

// ── Tipos (deben reflejar tokens.json) ──────────────────────────────
type Ramp = Record<"100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900", string>;
export type Tokens = {
  color: {
    bg: string; surface: string; text: string; accent: string; accent2: string; divider: string;
    neutral: Ramp; accentRamp: Ramp; accent2Ramp: Ramp;
  };
  font: { heading: string; body: string; headingWeight: number };
  size: Record<"h1" | "h2" | "h3" | "h4" | "h5" | "body" | "small" | "caption" | "micro", number>;
  space: Record<"1" | "2" | "3" | "4" | "6" | "8", number>;
  radius: Record<"sm" | "md" | "lg" | "pill", number>;
  shadow: Record<"sm" | "md" | "lg", string>;
};

const AVISO = "/* GENERADO por packages/design-tokens/src/build.ts — no editar a mano */";

// ── tokens.css (web / Tailwind v4) ─────────────────────────────────
function rampCss(prefijo: string, ramp: Ramp): string {
  return (Object.keys(ramp) as (keyof Ramp)[]).map((k) => `  --color-${prefijo}-${k}: ${ramp[k]};`).join("\n");
}

const stackHeading = `"${tokens.font.heading}", "Figtree", ui-sans-serif, system-ui, sans-serif`;
const stackBody = `"${tokens.font.body}", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

const css = `${AVISO}

@theme {
  --color-bg: ${tokens.color.bg};
  --color-surface: ${tokens.color.surface};
  --color-text: ${tokens.color.text};
  --color-accent: ${tokens.color.accent};
  --color-accent2: ${tokens.color.accent2};
  --color-divider: ${tokens.color.divider};

${rampCss("neutral", tokens.color.neutral)}

${rampCss("accent", tokens.color.accentRamp)}

${rampCss("accent2", tokens.color.accent2Ramp)}

  --font-heading: ${stackHeading};
  --font-body: ${stackBody};

  --text-h1: ${tokens.size.h1}px;
  --text-h2: ${tokens.size.h2}px;
  --text-h3: ${tokens.size.h3}px;
  --text-h4: ${tokens.size.h4}px;
  --text-h5: ${tokens.size.h5}px;
  --text-body: ${tokens.size.body}px;
  --text-small: ${tokens.size.small}px;
  --text-caption: ${tokens.size.caption}px;
  --text-micro: ${tokens.size.micro}px;

  --spacing-1: ${tokens.space["1"]}px;
  --spacing-2: ${tokens.space["2"]}px;
  --spacing-3: ${tokens.space["3"]}px;
  --spacing-4: ${tokens.space["4"]}px;
  --spacing-6: ${tokens.space["6"]}px;
  --spacing-8: ${tokens.space["8"]}px;

  --radius-sm: ${tokens.radius.sm}px;
  --radius-md: ${tokens.radius.md}px;
  --radius-lg: ${tokens.radius.lg}px;
  --radius-pill: ${tokens.radius.pill}px;

  --shadow-sm: ${tokens.shadow.sm};
  --shadow-md: ${tokens.shadow.md};
  --shadow-lg: ${tokens.shadow.lg};
}

/* La marca por tenant (--brand / --brand-hover / --brand-pressed) y las
   reglas globales (html background, color-scheme) las define el layout
   del servidor en el Paso 2 — NO acá, para no cambiar el look de las
   pantallas todavía sin migrar. */
`;

writeFileSync(join(RAIZ, "tokens.css"), css);

// ── generated.ts (Expo / RN / TS) ─────────────────────────────────
const ts = `${AVISO.replace("/*", "//").replace("*/", "")}
// Fuente de verdad: packages/design-tokens/tokens.json

export const tokens = ${JSON.stringify(tokens, null, 2)} as const;

export type Tokens = typeof tokens;

/** Familia con fallback, lista para \`fontFamily\` de RN o CSS. */
export const fontStack = {
  heading: ${JSON.stringify(stackHeading)},
  body: ${JSON.stringify(stackBody)},
} as const;
`;

writeFileSync(join(RAIZ, "src", "generated.ts"), ts);

console.log("design-tokens: tokens.css + src/generated.ts regenerados");
