// Tarea 148: ficha del equipo en pestañas. Admin con Viajes y Flota ve
// Resumen · Mantención · OS · Viajes · Documentos · Eventos y el total de los
// viajes; un colaborador no ve montos; sin el módulo Viajes no hay pestaña.
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ME_ADMIN } from "@/test/simulacros";
import EquipoDetallePage from "./page";

const h = vi.hoisted(() => ({ respuestas: {} as Record<string, unknown> }));
vi.mock("@/lib/api", async () => {
  const { apiFetchSimulado } = await import("@/test/simulacros");
  return { apiFetch: (ruta: string, init?: RequestInit) => apiFetchSimulado(h.respuestas)(ruta, init) };
});
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "x" } } }) } } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), useParams: () => ({ id: "e1" }), usePathname: () => "/dashboard/registros/equipos/e1" }));
vi.mock("@/components/DashboardShell", () => ({ DashboardShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("./RegistrosMantencion", () => ({ RegistrosMantencion: () => <p>Registros de mantención</p> }));
vi.mock("./EventosFlota", () => ({ EventosFlota: () => <p>Eventos</p> }));
vi.mock("@/components/DocumentoForm", () => ({ DocumentoForm: () => <p>Documentos del vehículo</p> }));

const equipo = {
  id: "e1",
  nombre: "Camión 1",
  categoria: "Vehículo",
  patente: "ABCD12",
  marca: "Volvo",
  modelo: "FH",
  activo: true,
  cliente: null,
  asignacion_vigente: { colaborador_id: "u2", colaborador_nombre: "Chofer QA" },
  historico_mantenciones: [],
};
const viajes = [
  { id: "v1", fecha: "2026-09-20", numero_guia: "G-1", origen: "Santiago", destino: "Rancagua", estado: "confirmado", total: 150000, cliente_info: { id: "c1", nombre: "Cliente QA" }, chofer: { id: "u2", nombre: "Chofer QA" } },
];

function simular(me: unknown) {
  h.respuestas = {
    "/api/me": me,
    "/api/equipos/e1": equipo,
    "/api/planes-mantencion": [{ id: "p1", equipo_id: "e1", frecuencia_dias: 90, proxima_fecha: "2026-12-01", notas: null, activo: true }],
    "/api/documentos": [{ estado: "vencido" }],
    "/api/viajes": viajes,
  };
}

describe("ficha del equipo en pestañas", () => {
  test("admin: pestañas completas, resumen con próxima mantención y documentos, y total en Viajes", async () => {
    simular({ ...ME_ADMIN, modulos_visibles: [...ME_ADMIN.modulos_visibles, "flota"] });
    render(<EquipoDetallePage />);
    expect(await screen.findByText("Camión 1")).toBeTruthy();
    for (const t of ["Resumen", "Mantención", "OS", "Viajes", "Eventos"]) expect(screen.getByRole("button", { name: t })).toBeTruthy();
    // Pestaña Documentos y el dato del encabezado que lleva a ella.
    expect(screen.getAllByRole("button", { name: /Documentos/ }).length).toBe(2);
    expect(await screen.findByText("2026-12-01")).toBeTruthy();
    expect(screen.getByText("1 vencido")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Viajes" }));
    expect(await screen.findByText("Santiago → Rancagua")).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
  });

  test("Mantención junta el plan y los registros", async () => {
    simular({ ...ME_ADMIN, modulos_visibles: [...ME_ADMIN.modulos_visibles, "flota"] });
    render(<EquipoDetallePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Mantención" }));
    expect(screen.getByText("Plan de Mantención Preventiva")).toBeTruthy();
    expect(screen.getByText("Registros de mantención")).toBeTruthy();
  });

  test("colaborador con Viajes: ve los viajes sin montos", async () => {
    simular({ ...ME_ADMIN, usuario: { ...ME_ADMIN.usuario, rol: "colaborador" } });
    render(<EquipoDetallePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Viajes" }));
    expect(await screen.findByText("Santiago → Rancagua")).toBeTruthy();
    expect(screen.queryByText("Total")).toBeNull();
  });

  test("sin el módulo Viajes no hay pestaña Viajes", async () => {
    simular({ ...ME_ADMIN, modulos_visibles: ["configuracion", "flota"] });
    render(<EquipoDetallePage />);
    expect(await screen.findByText("Camión 1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Viajes" })).toBeNull();
  });
});
