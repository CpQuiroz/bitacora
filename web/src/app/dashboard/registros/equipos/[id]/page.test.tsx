// Tareas 148 y 150: ficha del equipo en pestañas. Admin con Viajes y Flota ve
// Resumen · Actividad (OS + viajes) · Mantención · Documentos · Eventos y el
// total de los viajes; un colaborador no ve montos; sin el módulo Viajes la
// Actividad muestra solo OS (sin filtros).
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ME_ADMIN } from "@/test/simulacros";
import { ProveedoresFeedback } from "@/components/ProveedoresFeedback";
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
  historico_mantenciones: [
    { id: "t1", fecha: "2026-09-22", cliente: "Cliente OS", descripcion: "Cambio de aceite", estado: "completado", orden: { folio: 77, estado_os: "firmada" } },
  ],
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
    for (const t of ["Resumen", "Actividad", "Mantención", "Eventos"]) expect(screen.getByRole("button", { name: t })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "OS" })).toBeNull();
    // Pestaña Documentos y el dato del encabezado que lleva a ella.
    expect(screen.getAllByRole("button", { name: /Documentos/ }).length).toBe(2);
    expect(await screen.findByText("2026-12-01")).toBeTruthy();
    expect(screen.getByText("1 vencido")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Actividad" }));
    // OS y viaje en la misma lista, el viaje (más reciente) primero.
    expect(await screen.findByText("Viaje · Guía G-1")).toBeTruthy();
    expect(screen.getByText("OS N° 77")).toBeTruthy();
    expect(screen.getByText("Total viaje")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "OS" }));
    expect(screen.queryByText("Viaje · Guía G-1")).toBeNull();
    expect(screen.getByText("OS N° 77")).toBeTruthy();
  });

  test("Mantención junta el plan y los registros", async () => {
    simular({ ...ME_ADMIN, modulos_visibles: [...ME_ADMIN.modulos_visibles, "flota"] });
    render(<EquipoDetallePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Mantención" }));
    expect(screen.getByText("Plan de Mantención Preventiva")).toBeTruthy();
    expect(screen.getByText("Registros de mantención")).toBeTruthy();
  });

  test("colaborador con Viajes: ve la actividad sin montos", async () => {
    simular({ ...ME_ADMIN, usuario: { ...ME_ADMIN.usuario, rol: "colaborador" } });
    render(<EquipoDetallePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Actividad" }));
    expect(await screen.findByText("Viaje · Guía G-1")).toBeTruthy();
    expect(screen.queryByText("Total viaje")).toBeNull();
  });

  test("sin el módulo Viajes la Actividad muestra solo OS y sin filtros", async () => {
    simular({ ...ME_ADMIN, modulos_visibles: ["configuracion", "flota"] });
    render(<EquipoDetallePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Actividad" }));
    expect(await screen.findByText("OS N° 77")).toBeTruthy();
    expect(screen.queryByText("Viaje · Guía G-1")).toBeNull();
    expect(screen.queryByRole("button", { name: "Viajes" })).toBeNull();
  });

  test("eliminar un plan pide confirmación (tarea 156): Cancelar no borra, Eliminar sí", async () => {
    simular({ ...ME_ADMIN, modulos_visibles: [...ME_ADMIN.modulos_visibles, "flota"] });
    const borrados: string[] = [];
    h.respuestas["DELETE /api/planes-mantencion/p1"] = () => {
      borrados.push("p1");
      return new Response(null, { status: 204 });
    };
    render(
      <ProveedoresFeedback>
        <EquipoDetallePage />
      </ProveedoresFeedback>
    );
    fireEvent.click(await screen.findByRole("button", { name: "Mantención" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    const dialogo = await screen.findByRole("dialog", { name: "¿Eliminar este plan de mantención?" });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(borrados).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    const otra = await screen.findByRole("dialog", { name: "¿Eliminar este plan de mantención?" });
    fireEvent.click(within(otra).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(borrados).toEqual(["p1"]));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
