import type { StorybookConfig } from "@storybook/react-vite";
import { dirname } from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";

// Necesario en un monorepo (Yarn PnP también lo necesitaría, pero acá
// es por los workspaces de npm) — resuelve la ruta absoluta real de
// cada paquete de Storybook en vez de confiar en resolución relativa.
function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  // Deliberadamente mínimo — tarea #18: se separó de la #8 (Paso 7 del
  // sistema de diseño) justamente para no cargarla con lo más pesado.
  // Nada de Chromatic (SaaS externo), addon-vitest/Playwright (testing
  // de interacción con navegador real) ni addon-mcp — el objetivo es
  // navegar las primitivas visualmente, no armar un runner de tests.
  addons: [getAbsolutePath("@storybook/addon-docs"), getAbsolutePath("@storybook/addon-a11y")],
  framework: getAbsolutePath("@storybook/react-vite"),
  // Mismo criterio que web/postcss.config.mjs + web/src/app/globals.css:
  // Tailwind v4 vía su plugin de Vite (Storybook usa Vite acá) en vez
  // de PostCSS — más directo para este builder.
  async viteFinal(viteConfig) {
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()];
    return viteConfig;
  },
};
export default config;
