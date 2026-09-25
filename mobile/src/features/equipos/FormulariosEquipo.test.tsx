// Tarea 146: render básico de editar equipo y plan de mantención.
import { render, screen } from "@testing-library/react-native";
import { EquipoFormScreen } from "./EquipoFormScreen";
import { PlanMantencionFormScreen } from "./PlanMantencionFormScreen";

jest.mock("../../services/equipos", () => ({
  obtenerEquipo: jest.fn(async () => ({ id: "e1", nombre: "Camión 1", categoria: "Vehículo", patente: "ABCD12", marca: "Volvo", modelo: null, anio: 2020, numero_serie: null, tipo_vehiculo: null, capacidad_carga: null, garantia_vencimiento: null, notas: null })),
  actualizarEquipo: jest.fn(async () => ({ ok: true })),
  planesDeEquipo: jest.fn(async () => [{ id: "p1", equipo_id: "e1", frecuencia_dias: 90, proxima_fecha: "2027-01-15", notas: "Service", activo: true }]),
  guardarPlan: jest.fn(async () => ({ ok: true })),
}));

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn() }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

test("editar equipo: precarga los datos y muestra campos de vehículo", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await render(<EquipoFormScreen route={{ key: "k", name: "EquipoForm", params: { equipoId: "e1" } } as any} navigation={nav()} />);
  expect(await screen.findByDisplayValue("Camión 1")).toBeTruthy();
  expect(screen.getByDisplayValue("ABCD12")).toBeTruthy();
  expect(screen.getByDisplayValue("2020")).toBeTruthy();
});

test("editar plan: precarga frecuencia y notas", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await render(<PlanMantencionFormScreen route={{ key: "k", name: "PlanMantencionForm", params: { equipoId: "e1", planId: "p1" } } as any} navigation={nav()} />);
  expect(await screen.findByDisplayValue("90")).toBeTruthy();
  expect(screen.getByDisplayValue("Service")).toBeTruthy();
});
