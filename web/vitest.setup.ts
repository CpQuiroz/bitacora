import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Sin red: valores de mentira para que el cliente de Supabase se construya.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://pruebas.supabase.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "clave-de-pruebas";
process.env.NEXT_PUBLIC_API_URL ??= "https://api.pruebas.invalid";

afterEach(() => cleanup());

// next/link y next/image traen su propio React (el de la raíz del
// monorepo) y en pruebas no aportan nada: se reemplazan por <a> e <img>.
import { createElement, type ReactNode } from "react";
import { vi } from "vitest";
vi.mock("next/link", () => ({
  default: ({ href, children, ...resto }: { href: string | { pathname?: string }; children?: ReactNode }) =>
    createElement("a", { href: typeof href === "string" ? href : (href?.pathname ?? ""), ...resto }, children),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt, ...resto }: { src: string; alt: string }) => createElement("img", { src, alt, ...resto }),
}));

// Íconos: lucide-react vive en la raíz del monorepo con su propio React.
// En pruebas cada ícono es un <svg> vacío (se conservan todos los nombres).
vi.mock("lucide-react", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  const icono = () => createElement("svg", { "aria-hidden": true });
  return Object.fromEntries(Object.keys(original).map((k) => [k, typeof original[k] === "function" || typeof original[k] === "object" ? icono : original[k]]));
});
