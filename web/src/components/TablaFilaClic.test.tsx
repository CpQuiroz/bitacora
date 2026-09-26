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
  test("clic, doble clic y Enter abren la fila", () => {
    const { abrir, fila } = montar();
    fireEvent.click(fila);
    fireEvent.doubleClick(fila);
    fireEvent.keyDown(fila, { key: "Enter" });
    expect(abrir).toHaveBeenCalledTimes(3);
    expect(abrir).toHaveBeenCalledWith(filas[0]);
  });

  test("el menú ⋯ muestra las acciones visibles y no abre la fila", () => {
    const { abrir, editar } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Más acciones" }));
    expect(screen.getByRole("menuitem", { name: "Editar" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Oculta" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
    expect(editar).toHaveBeenCalledWith(filas[0]);
    expect(abrir).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
