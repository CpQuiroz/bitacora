// Feedback unificado (tarea 156): useConfirmar reemplaza a confirm() y
// useToast/useDeshacer dan avisos que no bloquean.
import { describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ConfirmarProvider, ToastProvider, useConfirmar, useDeshacer, useToast } from "@bitacora/ui/web";

function BotonEliminar({ alResponder }: { alResponder: (ok: boolean) => void }) {
  const confirmar = useConfirmar();
  return (
    <button type="button" onClick={async () => alResponder(await confirmar({ titulo: "¿Eliminar este viaje?", accion: "Eliminar", destructivo: true }))}>
      Eliminar viaje
    </button>
  );
}

function montar(ui: React.ReactNode) {
  return render(
    <ToastProvider>
      <ConfirmarProvider>{ui}</ConfirmarProvider>
    </ToastProvider>
  );
}

describe("useConfirmar", () => {
  test("resuelve true al confirmar", async () => {
    const alResponder = vi.fn();
    montar(<BotonEliminar alResponder={alResponder} />);
    fireEvent.click(screen.getByText("Eliminar viaje"));
    expect(await screen.findByRole("dialog", { name: "¿Eliminar este viaje?" })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Eliminar" })));
    expect(alResponder).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("Cancelar y Escape resuelven false", async () => {
    const alResponder = vi.fn();
    montar(<BotonEliminar alResponder={alResponder} />);
    fireEvent.click(screen.getByText("Eliminar viaje"));
    await act(async () => fireEvent.click(await screen.findByRole("button", { name: "Cancelar" })));
    fireEvent.click(screen.getByText("Eliminar viaje"));
    await screen.findByRole("dialog");
    await act(async () => fireEvent.keyDown(document, { key: "Escape" }));
    expect(alResponder.mock.calls).toEqual([[false], [false]]);
  });
});

describe("useToast y useDeshacer", () => {
  test("el toast de error se anuncia como alerta", async () => {
    function Aviso() {
      const toast = useToast();
      return <button type="button" onClick={() => toast("Sin conexión", { tono: "error" })}>Probar</button>;
    }
    montar(<Aviso />);
    fireEvent.click(screen.getByText("Probar"));
    expect((await screen.findByRole("alert")).textContent).toContain("Sin conexión");
  });

  test("Deshacer evita la llamada a la API", async () => {
    vi.useFakeTimers();
    const ejecutar = vi.fn(async () => {});
    function Borrar() {
      const conDeshacer = useDeshacer();
      return (
        <button type="button" onClick={() => conDeshacer({ mensaje: "Foto eliminada", ocultar: () => {}, restaurar: () => {}, ejecutar })}>
          Borrar foto
        </button>
      );
    }
    montar(<Borrar />);
    fireEvent.click(screen.getByText("Borrar foto"));
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    await act(async () => vi.advanceTimersByTime(6000));
    expect(ejecutar).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
