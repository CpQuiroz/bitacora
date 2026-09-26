// Convención de la app (tarea 148): en una tabla, clic, doble clic y Enter
// sobre la fila abren el objeto; el menú "⋯" ejecuta su acción sin abrir la
// fila. Componente Table de @bitacora/ui/web.
import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Table } from "@bitacora/ui/web";

type Fila = { id: string; nombre: string };
const filas: Fila[] = [{ id: "e1", nombre: "Camión 1" }];

function montar() {
  const abrir = vi.fn();
  const editar = vi.fn();
  render(
    <Table<Fila>
      filas={filas}
      claveFila={(f) => f.id}
      vacio={{ titulo: "Nada" }}
      columnas={[{ encabezado: "Nombre", celda: (f) => f.nombre }]}
      onFilaClick={abrir}
      accionesEnMenu
      acciones={[
        { etiqueta: "Editar", onPress: editar },
        { etiqueta: "Oculta", onPress: vi.fn(), oculta: () => true },
      ]}
    />
  );
  return { abrir, editar, fila: screen.getByText("Camión 1").closest("tr")! };
}

describe("tabla con fila clicable y menú de acciones", () => {
  test("un clic abre la fila una vez", () => {
    const { abrir, fila } = montar();
    fireEvent.click(fila, { detail: 1 });
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir).toHaveBeenCalledWith(filas[0]);
  });

  test("un doble clic real (clic, clic, dblclick) también abre, pero una sola vez", () => {
    const { abrir, fila } = montar();
    fireEvent.click(fila, { detail: 1 });
    fireEvent.click(fila, { detail: 2 });
    fireEvent.doubleClick(fila, { detail: 2 });
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  test("Enter con la fila enfocada la abre", () => {
    const { abrir, fila } = montar();
    fireEvent.keyDown(fila, { key: "Enter" });
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  test("el menú ⋯ muestra las acciones visibles y no abre la fila", () => {
    const { abrir, editar } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Más acciones" }));
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Oculta" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(editar).toHaveBeenCalledWith(filas[0]);
    expect(abrir).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
  });
});
