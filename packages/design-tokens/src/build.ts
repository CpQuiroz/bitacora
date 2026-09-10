/**
 * Generador de artefactos de tokens. Fuente de verdad: ../tokens.json.
 * Corre con `npm run gen` (tsx). Emite:
 *   - ../tokens.css        → @theme (Tailwind v4) con namespace `ds-` + :root
 *   - ./generated.ts       → objeto tipado `as const` (Expo / RN / TS)
 *
 * NO editar tokens.css ni generated.ts a mano: se pisan en cada build.
 *
 * ── Por qué el namespace `ds-` ──────────────────────────────────────
 * Durante la migración (Paso 6) el sistema viejo "Faena" y este conviven
 * en el mismo `@theme` de Tailwind. Faena ya ocupa --color-surface,
 * --color-accent y --radius-sm/md/lg con otros valores. Para no pisarlos,
 * los tokens nuevos salen como bg-ds-bg / rounded-ds-lg / text-ds-h1 /
 * font-ds-heading. Cuando Faena se retire, un sweep quita el prefijo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..");
const tokens = JSON.parse(readFileSync(join(RAIZ, "tokens.json"), "utf8")) as Tokens;

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

// Web: la familia real la carga next/font y la publica en --font-caprasimo /
// --font-figtree (ver web/src/app/layout.tsx). El literal queda de fallback.
const stackHeading = `var(--font-caprasimo), "${tokens.font.heading}", ui-sans-serif, system-ui, sans-serif`;
const stackBody = `var(--font-figtree), "${tokens.font.body}", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

// ── tokens.css (web / Tailwind v4) ─────────────────────────────────
function rampCss(prefijo: string, ramp: Ramp): string {
  return (Object.keys(ramp) as (keyof Ramp)[]).map((k) => `  --color-ds-${prefijo}-${k}: ${ramp[k]};`).join("\n");
}

const css = `${AVISO}

@theme {
  --color-ds-bg: ${tokens.color.bg};
  --color-ds-surface: ${tokens.color.surface};
  --color-ds-text: ${tokens.color.text};
  --color-ds-accent: ${tokens.color.accent};
  --color-ds-accent2: ${tokens.color.accent2};
  --color-ds-divider: ${tokens.color.divider};

${rampCss("neutral", tokens.color.neutral)}

${rampCss("accent", tokens.color.accentRamp)}

${rampCss("accent2", tokens.color.accent2Ramp)}

  /* Marca del tenant. --ds-brand se define abajo en :root (fallback) y lo
     pisan los shells por empresa. hover/pressed se derivan solos en OKLCH
     porque referencian var(--ds-brand) en el punto de uso. */
  --color-ds-brand: var(--ds-brand);
  --color-ds-brand-hover: var(--ds-brand-hover);
  --color-ds-brand-pressed: var(--ds-brand-pressed);
  --color-ds-brand-foreground: var(--ds-brand-foreground);

  --font-ds-heading: ${stackHeading};
  --font-ds-body: ${stackBody};

  --text-ds-h1: ${tokens.size.h1}px;
  --text-ds-h2: ${tokens.size.h2}px;
  --text-ds-h3: ${tokens.size.h3}px;
  --text-ds-h4: ${tokens.size.h4}px;
  --text-ds-h5: ${tokens.size.h5}px;
  --text-ds-body: ${tokens.size.body}px;
  --text-ds-small: ${tokens.size.small}px;
  --text-ds-caption: ${tokens.size.caption}px;
  --text-ds-micro: ${tokens.size.micro}px;

  --spacing-ds-1: ${tokens.space["1"]}px;
  --spacing-ds-2: ${tokens.space["2"]}px;
  --spacing-ds-3: ${tokens.space["3"]}px;
  --spacing-ds-4: ${tokens.space["4"]}px;
  --spacing-ds-6: ${tokens.space["6"]}px;
  --spacing-ds-8: ${tokens.space["8"]}px;

  --radius-ds-sm: ${tokens.radius.sm}px;
  --radius-ds-md: ${tokens.radius.md}px;
  --radius-ds-lg: ${tokens.radius.lg}px;
  --radius-ds-pill: ${tokens.radius.pill}px;

  --shadow-ds-sm: ${tokens.shadow.sm};
  --shadow-ds-md: ${tokens.shadow.md};
  --shadow-ds-lg: ${tokens.shadow.lg};
}

:root {
  /* Fallback de marca = acento. Los shells (DashboardShell / PortalShell /
     SuperAdminShell) pisan --ds-brand y --ds-brand-foreground con
     empresas.color_primario. hover/pressed: una y dos "paradas" más
     oscuras en OKLCH, derivadas en el punto de uso. */
  --ds-brand: ${tokens.color.accent};
  --ds-brand-hover: oklch(from var(--ds-brand) calc(l - 0.05) c h);
  --ds-brand-pressed: oklch(from var(--ds-brand) calc(l - 0.11) c h);
  --ds-brand-foreground: #ffffff;

  --font-ds-heading-weight: ${tokens.font.headingWeight};
}

/* Voz display (Caprasimo): SOLO titulares y botones grandes, nunca
   párrafos. Combinar con text-ds-h1…h5 para el tamaño. */
@utility ds-heading {
  font-family: var(--font-ds-heading);
  font-weight: ${tokens.font.headingWeight};
  line-height: 1.12;
  letter-spacing: -0.015em;
}

/* Base de cuerpo (Figtree). */
@utility ds-body {
  font-family: var(--font-ds-body);
  font-size: ${tokens.size.body}px;
  line-height: 1.55;
}
`;

writeFileSync(join(RAIZ, "tokens.css"), css);

// ── generated.ts (Expo / RN / TS) ─────────────────────────────────
const ts = `// GENERADO por packages/design-tokens/src/build.ts — no editar a mano
// Fuente de verdad: packages/design-tokens/tokens.json

export const tokens = ${JSON.stringify(tokens, null, 2)} as const;

export type Tokens = typeof tokens;

/**
 * Stack de fuentes para CSS (web). Usa var(--font-caprasimo) /
 * var(--font-figtree) que publica next/font. En RN NO sirve (fontFamily
 * necesita un solo nombre) — mobile usa mobile/src/theme/fuentes.ts.
 */
export const fontStackCss = {
  heading: ${JSON.stringify(stackHeading)},
  body: ${JSON.stringify(stackBody)},
} as const;
`;

writeFileSync(join(RAIZ, "src", "generated.ts"), ts);

console.log("design-tokens: tokens.css + src/generated.ts regenerados");
