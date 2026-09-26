// Tarea 149: toda fila abre su objeto. En Proveedores, clic en la fila abre
// la edición y "Desactivar" vive en el menú ⋯ (sin abrir la edición).
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ME_ADMIN } from "@/test/simulacros";
import ProveedoresPage from "./page";

const h = vi.hoisted(() => ({ respuestas: {} as Record<string, unknown>, patch: vi.fn() }));
vi.mock("@/lib/api", async () => {
  const { apiFetchSimulado } = await import("@/test/simulacros");
  return { apiFetch: (ruta: string, init?: RequestInit) => apiFetchSimulado(h.respuestas)(ruta, init) };
});
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "x" } } }) } } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/dashboard/registros/proveedores" }));
vi.mock("@/components/DashboardShell", () => ({ DashboardShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

const proveedor = { id: "p1", folio: 1, nombre: "Repuestos Sur", razon_social: null, rut: null, telefono: null, correo: null, categoria: null, categoria_gasto_id: null, activo: true };

describe("Proveedores: la fila abre la edición", () => {
  test("clic en la fila abre 'Editar proveedor'; Desactivar va en el menú ⋯", async () => {
    h.respuestas = {
      "/api/me": { ...ME_ADMIN, modulos_visibles: [...ME_ADMIN.modulos_visibles, "proveedores"] },
      "/api/proveedores": [proveedor],
      "/api/categorias-gasto": [],
      "PATCH /api/proveedores/p1": (init?: RequestInit) => {
        h.patch(JSON.parse(String(init?.body)));
        return { ...proveedor, activo: false };
      },
    };
    render(<ProveedoresPage />);
    const celda = await screen.findByText("Repuestos Sur");
    fireEvent.click(screen.getByRole("button", { name: "Más acciones" }));
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    expect(h.patch).toHaveBeenCalledWith({ activo: false });
    expect(screen.queryByText("Editar proveedor")).toBeNull();
    fireEvent.click(celda.closest("tr")!, { detail: 1 });
    expect(await screen.findByText("Editar proveedor")).toBeTruthy();
  });
});
