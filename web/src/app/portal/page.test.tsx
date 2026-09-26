// Tarea 157: el inicio del portal del cliente ya no usa components/ui
// (legacy). Render mínimo: saludo, próximas visitas con su estado y el
// formulario de corrección de datos con su rótulo asociado.
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PortalHomePage from "./page";

const h = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: h.replace, push: vi.fn() }), usePathname: () => "/portal" }));
vi.mock("@/components/PortalShell", () => ({ PortalShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/portalApi", () => ({
  obtenerTokenPortal: () => "token",
  obtenerConfigPortal: async () => ({
    secciones: { ordenes: true, citas: true, cotizaciones: true, cobros: true },
    marca: { color_primario: null, color_primario_foreground: null, color_secundario: null },
  }),
  portalFetch: async (ruta: string) => {
    if (ruta === "/api/portal/datos/visitas") {
      return new Response(
        JSON.stringify([{ id: "v1", cliente: "Ana", fecha: "2026-10-05", hora_programada: "10:00", descripcion: "Mantención", estado: "pendiente" }]),
        { status: 200 }
      );
    }
    return new Response("{}", { status: 404 });
  },
}));

describe("Portal: inicio", () => {
  test("muestra el saludo, las visitas con su estado y el campo de corrección rotulado", async () => {
    render(<PortalHomePage />);
    expect(screen.getByRole("heading", { name: /Hola/ })).toBeTruthy();
    expect(await screen.findByText("Mantención")).toBeTruthy();
    expect(screen.getByText("pendiente")).toBeTruthy();
    expect(screen.getByText("Hora estimada: 10:00")).toBeTruthy();
    expect(screen.getByLabelText(/Pide la corrección/)).toBeTruthy();
    const boton = screen.getByRole("button", { name: "Pedir corrección" }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    expect(h.replace).not.toHaveBeenCalled();
  });
});
