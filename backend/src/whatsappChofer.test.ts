import { test } from "node:test";
import assert from "node:assert/strict";
import { elegirChofer } from "./whatsapp";

const ana = { id: "ana", empresa_id: "e1", telefono: "+56 9 1234 5678" };
const beto = { id: "beto", empresa_id: "e2", telefono: "912345678" };
const caro = { id: "caro", empresa_id: "e1", telefono: "+56 2 8765 4321" };

test("coincidencia exacta gana aunque otro comparta el sufijo", () => {
  assert.equal(elegirChofer([ana, beto], "56912345678")?.id, "ana");
  assert.equal(elegirChofer([ana, beto], "912345678")?.id, "beto");
});

test("sin exacta: sufijo de 8 dígitos único (wa_id sin el 9 o con otro prefijo)", () => {
  assert.equal(elegirChofer([caro], "56228765432")?.id, undefined);
  assert.equal(elegirChofer([caro], "5687654321")?.id, "caro");
});

test("sufijo repetido y sin exacta: no se adivina", () => {
  assert.equal(elegirChofer([ana, beto], "5612345678"), null);
});

test("números cortos o candidatos sin teléfono válido", () => {
  assert.equal(elegirChofer([ana], "1234567"), null);
  assert.equal(elegirChofer([{ id: "x", empresa_id: "e", telefono: "123" }], "12345678"), null);
  assert.equal(elegirChofer([{ id: "x", empresa_id: "e", telefono: null }], "12345678"), null);
});
