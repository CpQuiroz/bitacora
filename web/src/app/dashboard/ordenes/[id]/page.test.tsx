// Prueba de regresión (tarea 127): el detalle de una OS en la web abre en
// sus distintos estados sin caerse. API y sesión simuladas (sin red).
import type { ReactNode } from "react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { apiFetchSimulado, ME_ADMIN, type RespuestasApi } from "@/test/simulacros";
import DetalleOrdenServicioPage from "./page";

const h = vi.hoisted(() => ({ respuestas: {} as Record<string, unknown> }));
vi.mock("@/lib/api", async () => {
  const { apiFetchSimulado } = await import("@/test/simulacros");
  return { apiFetch: (ruta: string, init?: RequestInit) => apiFetchSimulado(h.respuestas)(ruta, init) };
});
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "x" } } }) } } }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t1" }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dashboard/ordenes/t1",
}));
vi.mock("@/components/DashboardShell", () => ({ DashboardShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

function os(orden: Record<string, unknown> | null) {
  return {
    id: "t1",
    empresa_id: "e1",
    cliente: "Cliente de Prueba SpA",
    cliente_id: "c1",
    cliente_info: { id: "c1", nombre: "Cliente de Prueba SpA", direccion: "Alameda 100, Santiago" },
    responsable: { id: "u2", nombre: "Técnico QA" },
    responsable_id: "u2",
    tipo: { id: "tp1", nombre: "Mantención", campos: [] },
    descripcion: "Mantención preventiva",
    estado: "en_proceso",
    fecha: "2026-09-24",
    hora_programada: "09:30:00",
    datos: {},
    items: [{ id: "i1", descripcion: "Revisión general", cantidad: 1, precio_unitario: 50000, subtotal: 50000 }],
    fotos: [],
    orden: orden === null ? null : { id: "o1", folio: 42, estado_os: "en_proceso", checklist: [], ...orden },
  };
}

function base(detalle: unknown): RespuestasApi {
  return { "/api/me": ME_ADMIN, "/api/ordenes-servicio/t1": detalle, "/api/catalogo": [], "/api/usuarios": [], "/api/trabajos/t1/pdf-versiones": [] };
}

describe("detalle de OS (web)", () => {
  beforeEach(() => {
    h.respuestas = {};
  });

  test.each([
    ["en proceso", os({})],
    ["con llegada y salida", os({ check_in_at: "2026-09-24T12:40:00Z", check_in_lat: -33.45, check_in_lng: -70.66, check_out_at: "2026-09-24T14:00:00Z", check_out_lat: -33.45, check_out_lng: -70.66 })],
    ["finalizada y firmada", os({ estado_os: "firmada", finalizada_en: "2026-09-24T14:00:00Z", observaciones_cierre: "Todo OK" })],
    ["sin orden", os(null)],
  ])("%s: abre y muestra el cliente", async (_n, detalle) => {
    h.respuestas = base(detalle);
    render(<DetalleOrdenServicioPage />);
    expect((await screen.findAllByText(/Cliente de Prueba SpA/)).length).toBeGreaterThan(0);
  });

  test("si la API falla muestra el error", async () => {
    h.respuestas = { ...base(null), "/api/ordenes-servicio/t1": new Response("{}", { status: 500 }) };
    render(<DetalleOrdenServicioPage />);
    expect(await screen.findByText(/No se pudo cargar la orden de servicio/)).toBeTruthy();
  });
});
