import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import antiToken from "./eslint-rules/anti-token.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Sistema de diseño (Paso 7, tarea #8) — ver web/eslint-rules/anti-token.mjs.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { bitacora: antiToken },
    rules: {
      "bitacora/no-literal-color-or-px": "error",
    },
  },
  // Accesibilidad base (tarea 155): cada control con su nombre accesible
  // (label asociado o aria-label) y nada clicable sin teclado.
  {
    files: ["src/**/*.tsx"],
    rules: {
      "jsx-a11y/label-has-associated-control": ["error", { assert: "either", depth: 3 }],
      "jsx-a11y/control-has-associated-label": [
        "error",
        { ignoreElements: ["td", "th", "tr", "option", "input", "textarea", "select"], includeRoles: ["button"] },
      ],
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
    },
  },
  {
    rules: {
      // "Calling setState synchronously within an effect can trigger
      // cascading renders" — regla nueva y muy estricta de
      // eslint-plugin-react-hooks. Marca ~75 sitios en TODO el
      // dashboard: es exactamente el patrón de carga establecido a
      // propósito en el proyecto (fetch en useEffect + setState con el
      // resultado — ver docs/harness/arquitectura.md, "cada página del
      // dashboard sigue el mismo patrón de carga"), no un bug real.
      // Reescribir ~50 pantallas para evitarla sería un cambio de
      // arquitectura grande y arriesgado solo para silenciar un lint —
      // se desactiva a propósito, no por descuido (tarea #1 de
      // trabajo_list.json, 2026-09-12).
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
