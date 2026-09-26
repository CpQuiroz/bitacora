// Prueba de pantalla (tarea 135): Viajes › Tarifas abre con tramos y precio
// por km, y a un rol sin permiso le muestra "Sin acceso". API simulada.
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ME_ADMIN } from "@/test/simulacros";
import { ProveedoresFeedback } from "@/components/ProveedoresFeedback";
import TarifasViajesPage from "./page";

const h = vi.hoisted(() => ({ respuestas: {} as Record<string, unknown> }));
vi.mock("@/lib/api", async (importOriginal) => {
  const { apiFetchSimulado } = await import("@/test/simulacros");
  return { ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: (ruta: string, init?: RequestInit) => apiFetchSimulado(h.respuestas)(ruta, init) };
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

  // Tarea 156: borrar una tarifa no pide confirmación, se deshace desde el toast.
  function montarConFeedback(llamadas: string[]) {
    h.respuestas = {
      "/api/me": ME_ADMIN,
      "/api/clientes": [],
      "/api/viajes/tarifas": tarifas,
      "DELETE /api/viajes/tarifas/tramos/t1": () => {
        llamadas.push("DELETE t1");
        return new Response(null, { status: 204 });
      },
      "PATCH /api/viajes/tarifas/tramos/t1": (init?: RequestInit) => {
        llamadas.push(`PATCH t1 ${init?.body}`);
        return tarifas.tramos[0];
      },
    };
    render(
      <ProveedoresFeedback>
        <TarifasViajesPage />
      </ProveedoresFeedback>
    );
  }

  async function eliminarDesdeMenu() {
    fireEvent.click(await screen.findByRole("button", { name: "Más acciones" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
  }

  test("Eliminar tramo: se oculta al instante y Deshacer lo devuelve sin llamar a la API", async () => {
    const llamadas: string[] = [];
    montarConFeedback(llamadas);
    expect(await screen.findByText("Santiago ↔ Concepción")).toBeTruthy();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await eliminarDesdeMenu();
      expect(screen.queryByText("Santiago ↔ Concepción")).toBeNull();
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Deshacer" })));
      expect(screen.getByText("Santiago ↔ Concepción")).toBeTruthy();
      await act(async () => vi.advanceTimersByTime(6000));
      expect(llamadas).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  test("Eliminar tramo sin deshacer: la API se llama recién al terminar la espera", async () => {
    const llamadas: string[] = [];
    montarConFeedback(llamadas);
    expect(await screen.findByText("Santiago ↔ Concepción")).toBeTruthy();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await eliminarDesdeMenu();
      expect(llamadas).toEqual([]);
      await act(async () => vi.advanceTimersByTime(5100));
      expect(llamadas).toEqual(["DELETE t1"]);
    } finally {
      vi.useRealTimers();
    }
  });

  test("Cambiar precio abre un diálogo con el monto (reemplaza a prompt) y guarda con PATCH", async () => {
    const llamadas: string[] = [];
    montarConFeedback(llamadas);
    fireEvent.click(await screen.findByText("Santiago ↔ Concepción"));
    const dialogo = await screen.findByRole("dialog", { name: "Nuevo precio para Santiago ↔ Concepción" });
    const campo = within(dialogo).getByLabelText("Precio del tramo") as HTMLInputElement;
    expect(campo.value).toMatch(/300/);
    fireEvent.change(campo, { target: { value: "350000" } });
    await act(async () => fireEvent.click(within(dialogo).getByRole("button", { name: "Guardar" })));
    expect(llamadas).toEqual(['PATCH t1 {"precio":"350000"}']);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
