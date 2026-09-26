import { test } from "node:test";
import assert from "node:assert/strict";
import { clasificarError } from "./errores";

test("un error inesperado es 500 y se reporta a Sentry/errores_backend", () => {
  assert.deepEqual(clasificarError(new Error("boom")), { status: 500, mensaje: "boom", reportar: true, esperado: false });
  assert.equal(clasificarError("texto").reportar, true);
});

test("un freno de negocio con status propio no se reporta, aunque sea 5xx", () => {
  const limite = Object.assign(new Error("Llegaste al límite"), { status: 403 });
  assert.deepEqual(clasificarError(limite), { status: 403, mensaje: "Llegaste al límite", reportar: false, esperado: true });
  const cola = Object.assign(new Error("Cola llena"), { status: 503 });
  assert.equal(clasificarError(cola).reportar, false);
});
