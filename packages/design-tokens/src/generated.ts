// GENERADO por packages/design-tokens/src/build.ts — no editar a mano
// Fuente de verdad: packages/design-tokens/tokens.json

export const tokens = {
  "color": {
    "bg": "#f5ead8",
    "surface": "#ebddc5",
    "text": "#201e1d",
    "accent": "#c67139",
    "accent2": "#7a8a5e",
    "divider": "rgba(32, 30, 29, 0.16)",
    "neutral": {
      "100": "#f9f4ed",
      "200": "#eee7db",
      "300": "#dcd3c4",
      "400": "#c0b6a5",
      "500": "#a19786",
      "600": "#82796a",
      "700": "#645c50",
      "800": "#474238",
      "900": "#2e2b25"
    },
    "accentRamp": {
      "100": "#fff2eb",
      "200": "#ffe1d0",
      "300": "#ffc6a5",
      "400": "#f6a06b",
      "500": "#d67f48",
      "600": "#b2622d",
      "700": "#8c491a",
      "800": "#643312",
      "900": "#402310"
    },
    "accent2Ramp": {
      "100": "#f0fae1",
      "200": "#e1eecc",
      "300": "#ccdbb2",
      "400": "#aebf92",
      "500": "#8fa073",
      "600": "#728157",
      "700": "#56633f",
      "800": "#3d472b",
      "900": "#272e1b"
    }
  },
  "colorDark": {
    "bg": "#17140f",
    "surface": "#201b13",
    "text": "#f2e9d8",
    "accent": "#e08a52",
    "accent2": "#9db27a",
    "divider": "rgba(242, 233, 216, 0.14)",
    "neutral": {
      "100": "#2e2b25",
      "200": "#474238",
      "300": "#645c50",
      "400": "#82796a",
      "500": "#a19786",
      "600": "#c0b6a5",
      "700": "#dcd3c4",
      "800": "#eee7db",
      "900": "#f9f4ed"
    },
    "accentRamp": {
      "100": "#2a1b10",
      "200": "#3a2416",
      "300": "#4d301c",
      "400": "#603a20",
      "500": "#c9743e",
      "600": "#d88f56",
      "700": "#f6a06b",
      "800": "#ffc6a5",
      "900": "#ffe1d0"
    },
    "accent2Ramp": {
      "100": "#232a1a",
      "200": "#333d24",
      "300": "#44512f",
      "400": "#566640",
      "500": "#82945e",
      "600": "#93a76c",
      "700": "#c7d6a8",
      "800": "#e1eecc",
      "900": "#f0fae1"
    }
  },
  "font": {
    "heading": "Caprasimo",
    "body": "Figtree",
    "headingWeight": 400
  },
  "size": {
    "h1": 42,
    "h2": 32,
    "h3": 25,
    "h4": 20,
    "h5": 16,
    "body": 15,
    "small": 13,
    "caption": 12,
    "micro": 11
  },
  "space": {
    "1": 4.4,
    "2": 8.8,
    "3": 13.2,
    "4": 17.6,
    "6": 26.4,
    "8": 35.2
  },
  "radius": {
    "sm": 8,
    "md": 16,
    "lg": 28,
    "pill": 999
  },
  "shadow": {
    "sm": "0 1px 2px rgba(46, 43, 37, 0.14)",
    "md": "0 3px 10px rgba(46, 43, 37, 0.16)",
    "lg": "0 12px 32px rgba(46, 43, 37, 0.22)"
  }
} as const;

export type Tokens = typeof tokens;

/**
 * Stack de fuentes para CSS (web). Usa var(--font-caprasimo) /
 * var(--font-figtree) que publica next/font. En RN NO sirve (fontFamily
 * necesita un solo nombre) — mobile usa mobile/src/theme/fuentes.ts.
 */
export const fontStackCss = {
  heading: "var(--font-caprasimo), \"Caprasimo\", ui-sans-serif, system-ui, sans-serif",
  body: "var(--font-figtree), \"Figtree\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
} as const;
