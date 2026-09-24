import { test } from "node:test";
import assert from "node:assert/strict";
import { esCumpleanos } from "./cumpleanosClientes";
import { hoyChile } from "./fechaChile";

test("esCumpleanos compara mes y día, sin importar el año", () => {
  assert.equal(esCumpleanos("1990-09-24", "2026-09-24"), true);
  assert.equal(esCumpleanos("1990-09-25", "2026-09-24"), false);
  assert.equal(esCumpleanos("1990-10-24", "2026-09-24"), false);
});

test("29 de febrero: se saluda el 28 en años no bisiestos, el 29 en bisiestos", () => {
  assert.equal(esCumpleanos("2000-02-29", "2026-02-28"), true);
  assert.equal(esCumpleanos("2000-02-29", "2028-02-28"), false);
  assert.equal(esCumpleanos("2000-02-29", "2028-02-29"), true);
  assert.equal(esCumpleanos("2000-02-28", "2026-02-28"), true);
});

test("hoyChile: a las 23:30 de Chile sigue siendo el mismo día aunque en UTC ya sea mañana", () => {
  // 24-sep-2026 23:30 en Chile (UTC-3) = 25-sep 02:30 UTC.
  assert.equal(hoyChile(new Date("2026-09-25T02:30:00Z")), "2026-09-24");
  assert.equal(hoyChile(new Date("2026-09-25T04:00:00Z")), "2026-09-25");
});
