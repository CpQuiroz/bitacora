import { test } from "node:test";
import assert from "node:assert/strict";
import { oscurecerOklch } from "./oklch";

const hex = /^#[0-9a-f]{6}$/;

test("deltaL = 0 devuelve (casi) el mismo color", () => {
  // Ida y vuelta por OKLab tiene error de redondeo de ±1 por canal.
  const out = oscurecerOklch("#c67139", 0);
  assert.match(out, hex);
  const n = (h: string) => parseInt(h.slice(1), 16);
  const d = Math.abs(n(out) - n("#c67139"));
  assert.ok(d < 0x020202, `esperaba ~#c67139, vino ${out}`);
});

test("oscurece: el resultado es más oscuro que el original", () => {
  const luminancia = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  };
  const base = "#c67139";
  const hover = oscurecerOklch(base, 0.05);
  const pressed = oscurecerOklch(base, 0.11);
  assert.ok(luminancia(hover) < luminancia(base), "hover debe ser más oscuro que base");
  assert.ok(luminancia(pressed) < luminancia(hover), "pressed debe ser más oscuro que hover");
});

test("mantiene el tono (un azul sigue siendo azul)", () => {
  const out = oscurecerOklch("#3b82f6", 0.08);
  const n = parseInt(out.slice(1), 16);
  const r = (n >> 16) & 255;
  const b = n & 255;
  assert.ok(b > r, `esperaba que el azul siga dominando, vino ${out}`);
});

test("clampa a negro sin romper", () => {
  const out = oscurecerOklch("#111111", 0.9);
  assert.match(out, hex);
  assert.equal(out, "#000000");
});

test("acepta hex de 3 dígitos y sin #", () => {
  assert.match(oscurecerOklch("fff", 0.1), hex);
  assert.match(oscurecerOklch("#abc", 0.1), hex);
});
