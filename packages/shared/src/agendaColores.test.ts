import { test } from "node:test";
import assert from "node:assert/strict";
import { ETIQUETA_TIPO_AGENDA, ICONO_TIPO_AGENDA, estadoAgendaDeViaje } from "./agendaColores";

test("viaje en la agenda: agendado hasta que se cobra", () => {
  assert.equal(estadoAgendaDeViaje("borrador"), "agendado");
  assert.equal(estadoAgendaDeViaje("confirmado"), "agendado");
  assert.equal(estadoAgendaDeViaje("facturado"), "completado");
});

test("viaje tiene etiqueta e ícono propios", () => {
  assert.equal(ETIQUETA_TIPO_AGENDA.viaje, "Viaje");
  assert.equal(ICONO_TIPO_AGENDA.viaje, "Truck");
});
