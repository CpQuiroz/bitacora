// Prueba de regresión (tarea 127): crear una OS en la web. API y sesión
// simuladas: el formulario abre, valida y no envía sin los datos mínimos.
import type { ReactNode } from "react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ME_ADMIN } from "@/test/simulacros";
import NuevaOrdenServicioPage from "./page";

const h = vi.hoisted(() => ({ respuestas: {} as Record<string, unknown>, llamadas: [] as string[] }));
vi.mock("@/lib/api", async () => {
  const { apiFetchSimulado } = await import("@/test/simulacros");
  return {
    apiFetch: (ruta: string, init?: RequestInit) => {
      h.llamadas.push(`${init?.method ?? "GET"} ${ruta}`);
      return apiFetchSimulado(h.respuestas)(ruta, init);
    },
  };
});
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "x" } } }) } } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard/ordenes/nueva",
}));
vi.mock("@/components/DashboardShell", () => ({ DashboardShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

describe("crear OS (web)", () => {
  beforeEach(() => {
    h.llamadas = [];
    h.respuestas = {
      "/api/me": ME_ADMIN,
      "/api/usuarios": [{ id: "u2", nombre: "Técnico QA", activo: true, rol: "colaborador" }],
      "/api/clientes": [{ id: "c1", nombre: "Cliente de Prueba SpA", activo: true }],
      "/api/equipos": [],
      "/api/catalogo": [],
    };
  });

  test("abre el formulario y sin cliente no envía", async () => {
    render(<NuevaOrdenServicioPage />);
    // submit directo del formulario: jsdom respeta los `required` del HTML
    // y el clic no llegaría a la validación propia de la pantalla.
    const boton = await screen.findByText("Crear y enviar OS");
    fireEvent.submit(boton.closest("form")!);
    expect(await screen.findByText("Selecciona un cliente")).toBeTruthy();
    expect(h.llamadas.some((l) => l.startsWith("POST /api/trabajos"))).toBe(false);
  });
});
