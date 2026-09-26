// Tonos del portal que no cubre el mapa compartido (tarea 157): mismos que
// tenía el Badge antiguo.
import { expect, test } from "vitest";
import { tonoPortal } from "./tonoEstado";

test("pendiente es aviso, enviada en curso y lo demás lo decide StatusBadge", () => {
  expect(tonoPortal("pendiente")).toBe("advertencia");
  expect(tonoPortal("enviada")).toBe("en_progreso");
  expect(tonoPortal("borrador")).toBe("cerrado");
  expect(tonoPortal("pagada")).toBeUndefined();
});
