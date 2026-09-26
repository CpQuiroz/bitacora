// Tarea 157: el login del portal usa @bitacora/ui (Input con etiqueta,
// Aviso para el error). Render mínimo y validación sin red.
import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LoginPortalPage from "./page";

const h = vi.hoisted(() => ({ portalFetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/portal/login" }));
vi.mock("@/lib/portalApi", () => ({ guardarTokenPortal: vi.fn(), portalFetch: h.portalFetch }));

describe("Portal: login", () => {
  test("pide el RUT con su rótulo y avisa si falta, sin llamar a la API", () => {
    render(<LoginPortalPage />);
    expect(screen.getByLabelText("RUT")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enviarme un código" }));
    expect(screen.getByRole("alert").textContent).toBe("Ingresa tu RUT");
    expect(h.portalFetch).not.toHaveBeenCalled();
  });

  test("con el código enviado, el campo de código acepta solo dígitos", async () => {
    h.portalFetch.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    render(<LoginPortalPage />);
    fireEvent.change(screen.getByLabelText("RUT"), { target: { value: "12.345.678-9" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviarme un código" }));
    const codigo = (await screen.findByLabelText("Código")) as HTMLInputElement;
    fireEvent.change(codigo, { target: { value: "12a3" } });
    expect(codigo.value).toBe("123");
    expect(codigo.maxLength).toBe(6);
  });
});
