// Prueba de pantalla (tarea 135): Viajes › Tarifas abre con tramos y precio
// por km, y a un rol sin permiso le muestra "Sin acceso". API simulada.
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ME_ADMIN } from "@/test/simulacros";
import TarifasViajesPage from "./page";

const h = vi.hoisted(() => ({ respuestas: {} as Record<string, unknown> }));
vi.mock("@/lib/api", async () => {
  const { apiFetchSimulado } = await import("@/test/simulacros");
  return { apiFetch: (ruta: string, init?: RequestInit) => apiFetchSimulado(h.respuestas)(ruta, init) };
});
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "x" } } }) } } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/dashboard/viajes/tarifas" }));
vi.mock("@/components/DashboardShell", () => ({ DashboardShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

const tarifas = {
  tramos: [{ id: "t1", empresa_id: "e1", cliente_id: null, cliente: null, origen: "Santiago", destino: "Concepción", par_a: "concepcion", par_b: "santiago", precio: 300000, activo: true }],
  km: [{ id: "k1", empresa_id: "e1", cliente_id: null, cliente: null, precio_km: 950, activo: true }],
};

describe("Viajes › Tarifas (web)", () => {
  test("muestra los tramos y el precio general por km", async () => {
    h.respuestas = { "/api/me": ME_ADMIN, "/api/clientes": [], "/api/viajes/tarifas": tarifas };
    render(<TarifasViajesPage />);
    expect(await screen.findByText("Santiago ↔ Concepción")).toBeTruthy();
    expect(screen.getByText("General")).toBeTruthy();
    expect((screen.getByDisplayValue(/950/) as HTMLInputElement).value).toMatch(/950/);
  });

  test("un rol sin permiso ve 'Sin acceso' y no se cae", async () => {
    h.respuestas = { "/api/me": { ...ME_ADMIN, usuario: { ...ME_ADMIN.usuario, rol: "colaborador" } }, "/api/clientes": [], "/api/viajes/tarifas": new Response("{}", { status: 403 }) };
    render(<TarifasViajesPage />);
    expect(await screen.findByText("Sin acceso")).toBeTruthy();
  });
});
