import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
