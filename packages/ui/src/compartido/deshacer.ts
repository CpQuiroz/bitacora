import type { ConDeshacer, MostrarToast } from "../tipos";

// Lógica de "Deshacer" (tarea 156), igual en web y mobile: oculta al
// instante, muestra el toast con "Deshacer" y llama a la API recién al
// terminar la espera. Sin papelera en el backend, así se puede revertir.
export const ESPERA_DESHACER_MS = 5000;

function mensajeDe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "No se pudo completar la acción";
}

export function crearConDeshacer(toast: MostrarToast): ConDeshacer {
  return ({ mensaje, ocultar, restaurar, ejecutar, alTerminar, mensajeError, esperaMs = ESPERA_DESHACER_MS }) => {
    let cancelado = false;
    ocultar();
    const timer = setTimeout(async () => {
      if (cancelado) return;
      try {
        await ejecutar();
        alTerminar?.();
      } catch (e) {
        restaurar();
        toast(mensajeError ? mensajeError(e) : mensajeDe(e), { tono: "error" });
      }
    }, esperaMs);
    toast(mensaje, {
      tono: "exito",
      duracionMs: esperaMs,
      accion: {
        etiqueta: "Deshacer",
        onPress: () => {
          cancelado = true;
          clearTimeout(timer);
          restaurar();
        },
      },
    });
  };
}
