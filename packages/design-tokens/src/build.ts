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
type Paleta = {
  bg: string; surface: string; text: string; accent: string; accent2: string; divider: string;
  neutral: Ramp; accentRamp: Ramp; accent2Ramp: Ramp;
};
export type Tokens = {
  color: Paleta;
  // Modo Nocturno (18-sep-2026) — misma marca, misma forma, paleta oscura.
  // Solo web por ahora (mobile sigue con un único `tokens.color` estático,
  // ver docs/harness — pasar mobile a esto es un cambio de arquitectura
  // aparte, no incluido acá).
  colorDark: Paleta;
  // Tema "Taller" (19-sep-2026) — alternativa opcional por empresa
  // (empresas.tema), independiente de Modo Nocturno. Solo claro por ahora:
  // no tiene una variante colorTallerDark. Ver DashboardShell (data-tema)
  // y UsuarioShell.tema.
  colorTaller: Paleta;
  // Tema "Confianza" (20-sep-2026) — misma idea que Taller pero SOLO
  // color, sin tipografía propia (usa Caprasimo/Figtree, igual que
  // Faena) — investigación de mercado sugirió un azul clásico como
  // alternativa "segura" para clientes nuevos, sin tocar la voz
  // tipográfica de la marca.
  colorConfianza: Paleta;
  // Semántico (23-sep-2026) — peligro/advertencia, INDEPENDIENTE de la
  // marca por tenant (a diferencia de accent/accent2, no se pisa en
  // colorTaller/colorConfianza): una alerta real ("vencido") tiene que
  // leerse igual sin importar qué tema eligió la empresa. Sí cambia
  // entre claro/oscuro (semanticDark), mismo criterio que color/
  // colorDark. Antes no existía — StatusBadge solo tenía 4 tonos
  // ligados a marca, así que "vencido" cae en gris ("cancelado", el
  // más parecido) en vez de rojo. Ver docs/design-system.md.
  semantic: { danger: string; dangerSoft: string; warning: string; warningSoft: string };
  semanticDark: { danger: string; dangerSoft: string; warning: string; warningSoft: string };
  font: { heading: string; body: string; headingWeight: number };
  fontTaller: { heading: string; body: string; headingWeight: number };
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

// Tema "Taller": heading propio (Archivo, --font-archivo cargado en
// layout.tsx solo para este tema); body reusa --font-plex-sans, que YA
// se carga globalmente para Faena (evita un font load nuevo).
const stackHeadingTaller = `var(--font-archivo), "${tokens.fontTaller.heading}", ui-sans-serif, system-ui, sans-serif`;
const stackBodyTaller = `var(--font-plex-sans), "${tokens.fontTaller.body}", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

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

  /* Semántico (23-sep-2026) — peligro/advertencia, fijo sin importar
     la marca por tenant. Re-declarado abajo para Modo Nocturno; NO se
     toca en [data-tema="taller"/"confianza"] (esos solo pisan lo
     ligado a marca). */
  --color-ds-danger: ${tokens.semantic.danger};
  --color-ds-danger-soft: ${tokens.semantic.dangerSoft};
  --color-ds-warning: ${tokens.semantic.warning};
  --color-ds-warning-soft: ${tokens.semantic.warningSoft};

  /* Marca del tenant. --ds-brand se define abajo en :root (fallback) y lo
     pisan los shells por empresa. hover/pressed se derivan solos en OKLCH
     porque referencian var(--ds-brand) en el punto de uso. */
  --color-ds-brand: var(--ds-brand);
  --color-ds-brand-hover: var(--ds-brand-hover);
  --color-ds-brand-pressed: var(--ds-brand-pressed);
  --color-ds-brand-foreground: var(--ds-brand-foreground);

  /* Segundo color del tenant (empresas.color_secundario, 14-sep-2026).
     A propósito NO pisa --color-ds-accent2-*: ese ramp ya se usa en
     decenas de pantallas existentes con el tono fijo del sistema, y
     retocarlo de golpe las recolorearía todas sin haberlas revisado una
     por una. Este es un par NUEVO y angosto (bg suave / texto fuerte),
     pensado para lo que se agregue de acá en adelante — mismo criterio
     que --ds-brand: variable de marca angosta, no todo el ramp. */
  --color-ds-accent2-soft: var(--ds-accent2-soft);
  --color-ds-accent2-strong: var(--ds-accent2-strong);

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

  /* Igual patrón que --ds-brand pero para empresas.color_secundario.
     soft/strong con color-mix (no oklch: a diferencia de oscurecer una
     marca ya elegida, aclarar un hex arbitrario hacia blanco en OKLCH
     se sale de gamut para tonos como el teal — mezclar en sRGB con
     color-mix se queda siempre dentro de gamut). */
  --ds-accent2: ${tokens.color.accent2};
  --ds-accent2-soft: color-mix(in srgb, var(--ds-accent2) 22%, white);
  --ds-accent2-strong: color-mix(in srgb, var(--ds-accent2) 50%, black);

  --font-ds-heading-weight: ${tokens.font.headingWeight};
}

/* Modo Nocturno (18-sep-2026). Mismos nombres de variable que arriba —
   re-declararlas acá alcanza para toda la web, ninguna clase Tailwind
   se toca. Automático por sistema (prefers-color-scheme) salvo que la
   persona elija explícito en Configuración > Cuenta (data-theme en
   <html>, ver web/src/app/layout.tsx + ThemeToggle) — un "light"
   explícito le gana al sistema en los dos sentidos.
   --ds-brand/--ds-accent2 (color de marca por empresa) NO se tocan
   acá: son arbitrarios por tenant, siguen igual en los dos modos —
   riesgo de contraste conocido y aceptado por ahora, no resuelto. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-ds-bg: ${tokens.colorDark.bg};
    --color-ds-surface: ${tokens.colorDark.surface};
    --color-ds-text: ${tokens.colorDark.text};
    --color-ds-accent: ${tokens.colorDark.accent};
    --color-ds-accent2: ${tokens.colorDark.accent2};
    --color-ds-divider: ${tokens.colorDark.divider};

${rampCss("neutral", tokens.colorDark.neutral)}

${rampCss("accent", tokens.colorDark.accentRamp)}

${rampCss("accent2", tokens.colorDark.accent2Ramp)}

    --color-ds-danger: ${tokens.semanticDark.danger};
    --color-ds-danger-soft: ${tokens.semanticDark.dangerSoft};
    --color-ds-warning: ${tokens.semanticDark.warning};
    --color-ds-warning-soft: ${tokens.semanticDark.warningSoft};
  }
}

:root[data-theme="dark"] {
  --color-ds-bg: ${tokens.colorDark.bg};
  --color-ds-surface: ${tokens.colorDark.surface};
  --color-ds-text: ${tokens.colorDark.text};
  --color-ds-accent: ${tokens.colorDark.accent};
  --color-ds-accent2: ${tokens.colorDark.accent2};
  --color-ds-divider: ${tokens.colorDark.divider};

${rampCss("neutral", tokens.colorDark.neutral)}

${rampCss("accent", tokens.colorDark.accentRamp)}

${rampCss("accent2", tokens.colorDark.accent2Ramp)}

  --color-ds-danger: ${tokens.semanticDark.danger};
  --color-ds-danger-soft: ${tokens.semanticDark.dangerSoft};
  --color-ds-warning: ${tokens.semanticDark.warning};
  --color-ds-warning-soft: ${tokens.semanticDark.warningSoft};
}

/* Tema "Taller" (19-sep-2026) — override opcional por empresa
   (empresas.tema), independiente de Modo Nocturno. Se activa con
   data-tema="taller" en el div que YA fija --ds-brand por tenant
   (DashboardShell) — no en <html> como Modo Nocturno. La resolución de
   custom properties es "ancestro más cercano que la define", no
   especificidad/orden de :root, así que este bloque no necesita el
   :not([data-theme="light"]) que sí necesitó Modo Nocturno (ese pisa
   :root arriba en <html>; este pisa un div más abajo en el árbol, y
   siempre gana ahí sin importar qué puso :root). Solo claro por ahora
   (no hay colorTallerDark todavía). */
[data-tema="taller"] {
  --color-ds-bg: ${tokens.colorTaller.bg};
  --color-ds-surface: ${tokens.colorTaller.surface};
  --color-ds-text: ${tokens.colorTaller.text};
  --color-ds-accent: ${tokens.colorTaller.accent};
  --color-ds-accent2: ${tokens.colorTaller.accent2};
  --color-ds-divider: ${tokens.colorTaller.divider};

${rampCss("neutral", tokens.colorTaller.neutral)}

${rampCss("accent", tokens.colorTaller.accentRamp)}

${rampCss("accent2", tokens.colorTaller.accent2Ramp)}

  --font-ds-heading: ${stackHeadingTaller};
  --font-ds-body: ${stackBodyTaller};
  --font-ds-heading-weight: ${tokens.fontTaller.headingWeight};
}

/* Tema "Confianza" (20-sep-2026) — mismo mecanismo que Taller
   (data-tema en el div de marca por tenant), pero SOLO color: no pisa
   --font-ds-heading/body/weight, así que hereda Caprasimo/Figtree tal
   cual vienen de :root arriba. Azul clásico + acento naranja, pensado
   como alternativa "segura" de confianza para empresas que recién
   arrancan con clientes nuevos (ver investigación en progress/current.md). */
[data-tema="confianza"] {
  --color-ds-bg: ${tokens.colorConfianza.bg};
  --color-ds-surface: ${tokens.colorConfianza.surface};
  --color-ds-text: ${tokens.colorConfianza.text};
  --color-ds-accent: ${tokens.colorConfianza.accent};
  --color-ds-accent2: ${tokens.colorConfianza.accent2};
  --color-ds-divider: ${tokens.colorConfianza.divider};

${rampCss("neutral", tokens.colorConfianza.neutral)}

${rampCss("accent", tokens.colorConfianza.accentRamp)}

${rampCss("accent2", tokens.colorConfianza.accent2Ramp)}
}

/* Voz display (Caprasimo en Faena/Confianza / Archivo en Taller): SOLO titulares y
   botones grandes, nunca párrafos. Combinar con text-ds-h1…h5 para el
   tamaño. font-weight sale de --font-ds-heading-weight (no un literal)
   para que Taller pueda pisarlo a 700 sin duplicar este @utility. */
@utility ds-heading {
  font-family: var(--font-ds-heading);
  font-weight: var(--font-ds-heading-weight);
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

export const fontStackCssTaller = {
  heading: ${JSON.stringify(stackHeadingTaller)},
  body: ${JSON.stringify(stackBodyTaller)},
} as const;
`;

writeFileSync(join(RAIZ, "src", "generated.ts"), ts);

console.log("design-tokens: tokens.css + src/generated.ts regenerados");
