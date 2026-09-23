// Test del bug real (23-sep-2026): "Marcar cotizado externamente" en
// Levantamientos SIEMPRE mostraba "El servidor está iniciando..."
// aunque el endpoint funcionaba bien — un PATCH sin Idempotency-Key
// tenía 0 reintentos, insuficiente para un cold start de Render.
// Se testean las 2 funciones puras que arregla el fix — no hace falta
// mockear fetch/Supabase/Next para esto, ver comentario largo en
// api.ts. Corrida manual (web/ no tiene runner de tests propio,
// package.json §Sistema de diseño §PASO 6):
//   npx tsx --env-file=web/.env.local --test web/src/lib/api.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { esSeguroReintentar, mensajeFalloRed } from "./api";

test("PATCH y DELETE son seguros de reintentar sin Idempotency-Key (idempotentes por convención)", () => {
  assert.equal(esSeguroReintentar("PATCH"), true);
  assert.equal(esSeguroReintentar("patch"), true); // sin distinguir mayúsculas
  assert.equal(esSeguroReintentar("DELETE"), true);
  assert.equal(esSeguroReintentar("GET"), true);
  assert.equal(esSeguroReintentar("HEAD"), true);
});

test("POST sin Idempotency-Key NO se reintenta (podría duplicar un recurso)", () => {
  assert.equal(esSeguroReintentar("POST"), false);
});

test("POST CON Idempotency-Key sí se reintenta (el backend deduplica)", () => {
  assert.equal(esSeguroReintentar("POST", "una-key"), true);
});

test("los 2 mensajes de fallo de red son distintos entre sí", () => {
  assert.notEqual(mensajeFalloRed("red"), mensajeFalloRed("timeout"));
});

test("timeout menciona explícitamente que puede ser el servidor iniciando", () => {
  assert.match(mensajeFalloRed("timeout"), /iniciando|tardó/i);
});

test("red (sin respuesta ni timeout) apunta a la conexión del usuario, no al servidor", () => {
  assert.match(mensajeFalloRed("red"), /conexión|conectar/i);
  assert.doesNotMatch(mensajeFalloRed("red"), /iniciando/i);
});
