// Reglas de hooks de React en mobile + packages/ui (web ya las corre con
// su propio ESLint). Existe por un crash real (24-sep-2026): un useEffect
// declarado después de un `return` anticipado en TrabajoDetalleScreen
// cerraba la app al abrir una OS (build 1.10.16). Lo corre verificar.sh.
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parser: tseslint.parser },
    plugins: { "react-hooks": reactHooks },
    rules: { "react-hooks/rules-of-hooks": "error" },
  },
];
