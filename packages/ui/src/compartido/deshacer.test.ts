import { test } from "node:test";
import assert from "node:assert/strict";
import { crearConDeshacer } from "./deshacer";
import type { OpcionesToast } from "../tipos";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function armar() {
  const toasts: { mensaje: string; opciones?: OpcionesToast }[] = [];
  const estado = { visible: true, ejecutado: false, terminado: false };
  const conDeshacer = crearConDeshacer((mensaje, opciones) => toasts.push({ mensaje, opciones }));
  return { toasts, estado, conDeshacer };
}

test("oculta al instante y ejecuta la API recién al terminar la espera", async () => {
  const { toasts, estado, conDeshacer } = armar();
  conDeshacer({
    mensaje: "Foto eliminada",
    ocultar: () => (estado.visible = false),
    restaurar: () => (estado.visible = true),
    ejecutar: async () => void (estado.ejecutado = true),
    alTerminar: () => (estado.terminado = true),
    esperaMs: 20,
  });
  assert.equal(estado.visible, false);
  assert.equal(estado.ejecutado, false);
  assert.equal(toasts[0].opciones?.accion?.etiqueta, "Deshacer");
  await esperar(40);
  assert.deepEqual(estado, { visible: false, ejecutado: true, terminado: true });
});

test("Deshacer restaura y la API nunca se llama", async () => {
  const { toasts, estado, conDeshacer } = armar();
  conDeshacer({
    mensaje: "Tarea eliminada",
    ocultar: () => (estado.visible = false),
    restaurar: () => (estado.visible = true),
    ejecutar: async () => void (estado.ejecutado = true),
    esperaMs: 20,
  });
  toasts[0].opciones!.accion!.onPress();
  await esperar(40);
  assert.equal(estado.visible, true);
  assert.equal(estado.ejecutado, false);
});

test("si la API falla, restaura y avisa con toast de error", async () => {
  const { toasts, estado, conDeshacer } = armar();
  conDeshacer({
    mensaje: "Tarifa eliminada",
    ocultar: () => (estado.visible = false),
    restaurar: () => (estado.visible = true),
    ejecutar: async () => {
      throw new Error("La tarifa está en uso");
    },
    esperaMs: 10,
  });
  await esperar(30);
  assert.equal(estado.visible, true);
  assert.deepEqual(toasts[1], { mensaje: "La tarifa está en uso", opciones: { tono: "error" } });
});
