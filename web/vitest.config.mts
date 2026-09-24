// Pruebas de pantallas de la web (tarea 127) — Vitest + Testing Library,
// según la guía de Next 16 (node_modules/next/dist/docs/01-app/02-guides/
// testing/vitest.md). Sin red: cada prueba simula apiFetch y la sesión.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

// En el monorepo hay dos React: el de web (web/node_modules) y otro en la
// raíz. El código de web y sus imports se resuelven al de web; las librerías
// de la raíz que traen su propio React (next/link, next/image, lucide-react)
// se simulan en vitest.setup.ts.
const reactDeWeb = fileURLToPath(new URL("./node_modules/react", import.meta.url));
const reactDomDeWeb = fileURLToPath(new URL("./node_modules/react-dom", import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: [
      { find: /^react$/, replacement: reactDeWeb },
      { find: /^react\/(.*)$/, replacement: `${reactDeWeb}/$1` },
      { find: /^react-dom$/, replacement: reactDomDeWeb },
      { find: /^react-dom\/(.*)$/, replacement: `${reactDomDeWeb}/$1` },
    ],
  },
  test: {
    environment: "jsdom",
    // Solo pantallas: src/lib/api.test.ts usa node:test y va aparte.
    include: ["src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
