import { test } from "node:test";
import assert from "node:assert/strict";
import { ufAClp } from "./ufDiaria";

test("el precio en CLP se redondea al peso", () => {
  assert.equal(ufAClp(1.5, 39485.65), 59228);
  assert.equal(ufAClp(6, 39485.65), 236914);
});
