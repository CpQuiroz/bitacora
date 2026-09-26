// Tarea 157 (ronda 5): ImportarCsvModal pasó de components/Modal a Dialog de
// @bitacora/ui/web. Se mantiene su API (abierto/onCerrar/titulo) y el Dialog
// aporta nombre accesible, foco al abrir, Escape y botón Cerrar.
import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ImportarCsvModal } from "./ImportarCsvModal";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

function montar(abierto = true) {
  const onCerrar = vi.fn();
  render(
    <ImportarCsvModal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Importar clientes"
      nombreArchivoPlantilla="plantilla-clientes"
      endpoint="/api/clientes/importar"
      columnas={[{ clave: "nombre", etiqueta: "Nombre", ejemplo: "ACME", requerido: true }]}
      onImportado={vi.fn()}
    />
  );
  return { onCerrar };
}

describe("ImportarCsvModal sobre Dialog", () => {
  test("cerrado no renderiza nada", () => {
    montar(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("abierto: diálogo con el título como nombre, ancho 'ancho' y foco adentro", () => {
    montar();
    const dialogo = screen.getByRole("dialog", { name: "Importar clientes" });
    expect(dialogo.className).toContain("max-w-2xl");
    expect(document.activeElement).toBe(dialogo);
  });

  test("Escape y el botón Cerrar llaman a onCerrar", () => {
    const { onCerrar } = montar();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCerrar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });
});
