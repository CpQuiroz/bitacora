// Tarea 157 (ronda 5): Etapas de Cotización pasó de DataTable a Table de
// @bitacora/ui/web. Convención tarea 148/149: clic en la fila abre la
// edición y el menú ⋯ tiene las acciones (sin abrir la fila). API simulada.
import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CotizacionEtapasPage from "./page";

const h = vi.hoisted(() => ({ respuestas: {} as Record<string, unknown> }));
vi.mock("@/lib/api", async (importOriginal) => {
  const { apiFetchSimulado } = await import("@/test/simulacros");
  return { ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: (ruta: string, init?: RequestInit) => apiFetchSimulado(h.respuestas)(ruta, init) };
});

const etapas = [{ id: "et1", empresa_id: "e1", nombre: "Vendidos", orden: 1 }];

describe("Configuración › Etapas de Cotización (Table)", () => {
  test("muestra la etapa en la tabla y el clic en la fila abre la edición", async () => {
    h.respuestas = { "/api/cotizacion-etapas": etapas };
    render(<CotizacionEtapasPage />);
    const celda = await screen.findByText("Vendidos");
    expect(screen.getByRole("columnheader", { name: "Nombre" })).toBeTruthy();
    fireEvent.click(celda.closest("tr")!, { detail: 1 });
    expect(screen.getByText("Editar etapa")).toBeTruthy();
    expect(screen.getByDisplayValue("Vendidos")).toBeTruthy();
  });

  test("Eliminar desde el menú ⋯ llama a la API y no abre la edición", async () => {
    const llamadas: string[] = [];
    h.respuestas = {
      "/api/cotizacion-etapas": etapas,
      "DELETE /api/cotizacion-etapas/et1": () => {
        llamadas.push("DELETE et1");
        return new Response(null, { status: 204 });
      },
    };
    render(<CotizacionEtapasPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Más acciones" }));
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(llamadas).toEqual(["DELETE et1"]));
    expect(screen.queryByText("Editar etapa")).toBeNull();
  });
});
