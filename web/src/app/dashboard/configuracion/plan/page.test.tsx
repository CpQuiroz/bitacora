// Prueba de regresión (tarea 127): la pantalla de Plan abre con el plan
// actual y los planes contratables. API y sesión simuladas (sin red).
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfiguracionContext, type UsuarioConEmpresa } from "../ConfiguracionContext";
import PlanPage from "./page";

const h = vi.hoisted(() => ({ respuestas: {} as Record<string, unknown> }));
vi.mock("@/lib/api", async () => {
  const { apiFetchSimulado } = await import("@/test/simulacros");
  return { apiFetch: (ruta: string, init?: RequestInit) => apiFetchSimulado(h.respuestas)(ruta, init) };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard/configuracion/plan",
}));

const usuario = {
  id: "u1",
  nombre: "Admin QA",
  rol: "admin",
  empresa: { id: "e1", nombre: "Empresa QA", plan: "operacion", prueba_termina_en: null, moneda: "CLP" },
} as unknown as UsuarioConEmpresa;

describe("pantalla de Plan (web)", () => {
  test("abre con el plan actual y el uso de módulos", async () => {
    h.respuestas = {
      "/api/suscripcion": { suscripcion: null, cobros: [] },
      "/api/plan": { planActual: "operacion", trialVencido: false, contratables: { basico: true, operacion: true, pro: true }, modulosActivos: 7, modulosMax: 10, historial: [] },
    };
    render(
      <ConfiguracionContext.Provider value={{ usuario, recargar: async () => {}, pruebaVencida: false }}>
        <PlanPage />
      </ConfiguracionContext.Provider>
    );
    expect((await screen.findAllByText(/Operación/)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Pro/)).length).toBeGreaterThan(0);
  });

  test("si falla la suscripción muestra el error, no se cae", async () => {
    h.respuestas = { "/api/suscripcion": new Response("{}", { status: 500 }), "/api/plan": new Response("{}", { status: 500 }) };
    render(
      <ConfiguracionContext.Provider value={{ usuario, recargar: async () => {}, pruebaVencida: false }}>
        <PlanPage />
      </ConfiguracionContext.Provider>
    );
    expect(await screen.findByText(/No se pudo cargar tu suscripción/)).toBeTruthy();
  });
});
