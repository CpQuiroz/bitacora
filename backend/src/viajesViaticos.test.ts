import { test } from "node:test";
import assert from "node:assert/strict";
import { leerViatico, mismoViatico, periodoDe, resumirViaticos } from "./viajesViaticos";

test("leerViatico: ausente, quitar, válido e inválido", () => {
  assert.deepEqual(leerViatico(undefined, undefined), { sinCambio: true });
  assert.deepEqual(leerViatico(null, undefined), { viatico: null });
  assert.deepEqual(leerViatico("", 5000), { viatico: null });
  assert.deepEqual(leerViatico("local", "15000"), { viatico: { tipo: "local", monto: 15000 } });
  assert.deepEqual(leerViatico("interregional", 25000.4), { viatico: { tipo: "interregional", monto: 25000 } });
  assert.ok("error" in leerViatico("nacional", 1000));
  assert.ok("error" in leerViatico("local", -1));
  assert.ok("error" in leerViatico("local", ""));
  assert.ok("error" in leerViatico("local", undefined));
});

test("mismoViatico compara tipo y monto (número o texto de la BD)", () => {
  assert.equal(mismoViatico(null, null), true);
  assert.equal(mismoViatico({ tipo: "local", monto: 1000 }, null), false);
  assert.equal(mismoViatico({ tipo: "local", monto: 1000 }, { tipo: "local", monto: "1000" as unknown as number }), true);
  assert.equal(mismoViatico({ tipo: "local", monto: 1000 }, { tipo: "interregional", monto: 1000 }), false);
});

test("periodoDe: lunes de la semana y primer día del mes", () => {
  assert.equal(periodoDe("2026-09-24", "semana"), "2026-09-21"); // jueves → lunes
  assert.equal(periodoDe("2026-09-27", "semana"), "2026-09-21"); // domingo → lunes anterior
  assert.equal(periodoDe("2026-09-21", "semana"), "2026-09-21");
  assert.equal(periodoDe("2026-03-01", "semana"), "2026-02-23"); // cruza de mes
  assert.equal(periodoDe("2026-09-24", "mes"), "2026-09-01");
});

test("resumirViaticos suma por chofer y período, separando pendiente y pagado", () => {
  const filas = resumirViaticos(
    [
      { monto: "10000", estado: "pendiente", fecha: "2026-09-22", chofer_id: "a", chofer: "Ana" },
      { monto: 25000, estado: "pagado", fecha: "2026-09-24", chofer_id: "a", chofer: "Ana" },
      { monto: 10000, estado: "pendiente", fecha: "2026-09-24", chofer_id: "b", chofer: "Beto" },
      { monto: 10000, estado: "pendiente", fecha: "2026-09-15", chofer_id: "a", chofer: "Ana" },
    ],
    "semana"
  );
  assert.deepEqual(filas, [
    { periodo: "2026-09-21", chofer_id: "a", chofer: "Ana", cantidad: 2, total: 35000, pendiente: 10000, pagado: 25000 },
    { periodo: "2026-09-21", chofer_id: "b", chofer: "Beto", cantidad: 1, total: 10000, pendiente: 10000, pagado: 0 },
    { periodo: "2026-09-14", chofer_id: "a", chofer: "Ana", cantidad: 1, total: 10000, pendiente: 10000, pagado: 0 },
  ]);
  assert.equal(resumirViaticos([{ monto: 1, estado: "pagado", fecha: "2026-09-02", chofer_id: "a", chofer: "Ana" }, { monto: 2, estado: "pendiente", fecha: "2026-09-29", chofer_id: "a", chofer: "Ana" }], "mes")[0]!.total, 3);
});
