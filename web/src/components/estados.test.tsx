// Tarea 157: estados.tsx dejó el components/ui.tsx antiguo y ahora envuelve
// EmptyState/ErrorState de @bitacora/ui/web. La API pública no cambia.
import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EstadoCargando, EstadoError, EstadoVacio } from "./estados";

describe("estados compartidos", () => {
  test("EstadoCargando muestra el mensaje (default y propio)", () => {
    const { rerender } = render(<EstadoCargando />);
    expect(screen.getByText("Cargando…")).toBeTruthy();
    rerender(<EstadoCargando mensaje="Buscando citas" />);
    expect(screen.getByText("Buscando citas…")).toBeTruthy();
  });

  test("EstadoVacio muestra título, mensaje, acción e ícono", () => {
    const Icono = ({ className }: { className?: string }) => <svg data-testid="icono" className={className} />;
    render(<EstadoVacio icono={Icono} titulo="Sin cobros" mensaje="Todavía no hay nada" accion={<a href="/x">Ir</a>} />);
    expect(screen.getByText("Sin cobros")).toBeTruthy();
    expect(screen.getByText("Todavía no hay nada")).toBeTruthy();
    expect(screen.getByText("Ir")).toBeTruthy();
    expect(screen.getByTestId("icono")).toBeTruthy();
  });

  test("EstadoError usa el título por defecto y reintenta", () => {
    const onReintentar = vi.fn();
    render(<EstadoError mensaje="Sin conexión" onReintentar={onReintentar} />);
    expect(screen.getByText("No se pudo cargar")).toBeTruthy();
    expect(screen.getByText("Sin conexión")).toBeTruthy();
    fireEvent.click(screen.getByText("Reintentar"));
    expect(onReintentar).toHaveBeenCalledOnce();
  });
});
