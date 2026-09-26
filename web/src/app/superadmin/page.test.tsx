// Prueba de pantalla (tarea 157): el listado de empresas del Super-Admin usa
// Table de @bitacora/ui/web — la fila abre la ficha (sin acción suelta que
// la repita) y "Nueva empresa" abre el Dialog. API simulada.
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SuperAdminEmpresasPage from "./page";

const h = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, replace: h.replace }), usePathname: () => "/superadmin" }));
vi.mock("@/components/SuperAdminShell", () => ({ SuperAdminShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/superadminApi", () => ({
  obtenerTokenSuperAdmin: () => "token",
  superadminFetch: async () =>
    new Response(
      JSON.stringify([{ id: "e1", nombre: "Transportes Sur", plan: "pro", estado: "activa", creado_en: "2026-09-01T12:00:00Z", cantidad_usuarios: 4 }]),
      { status: 200 }
    ),
}));

describe("Super-Admin › Empresas (web)", () => {
  beforeEach(() => {
    h.push.mockReset();
  });

  test("clic en la fila abre la ficha de la empresa", async () => {
    render(<SuperAdminEmpresasPage />);
    const celda = await screen.findByText("Transportes Sur");
    fireEvent.click(celda.closest("tr")!, { detail: 1 });
    expect(h.push).toHaveBeenCalledWith("/superadmin/empresas/e1");
  });

  test("la fila no repite su clic con una acción suelta (convención de listas)", async () => {
    render(<SuperAdminEmpresasPage />);
    await screen.findByText("Transportes Sur");
    expect(screen.queryByRole("button", { name: "Ver salud →" })).toBeNull();
  });

  test("'Nueva empresa' abre el diálogo con el formulario", async () => {
    render(<SuperAdminEmpresasPage />);
    await screen.findByText("Transportes Sur");
    fireEvent.click(screen.getByRole("button", { name: "Nueva empresa" }));
    expect(screen.getByRole("dialog", { name: "Nueva empresa" })).toBeTruthy();
    expect(screen.getByLabelText("Nombre de la empresa")).toBeTruthy();
  });
});
