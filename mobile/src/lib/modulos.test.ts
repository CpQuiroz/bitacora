// Tarea 152: el menú mobile oculta lo que la empresa o el rol no tienen,
// sin dejar sin trabajo a técnicos y choferes (rol colaborador).
import type { Modulo } from "@bitacora/shared";
import { accesoModulos, type EntradaAcceso } from "./modulos";

const COLABORADOR: Modulo[] = ["agenda", "agenda_pro", "asistente", "catalogo", "equipos", "inventario", "proveedores", "registros"];
const base: EntradaAcceso = { visibles: COLABORADOR, deshabilitados: [], funcion: "tecnico", rol: "colaborador", acciones: [] };

describe("accesoModulos", () => {
  test("técnico con la empresa completa: ve sus OS y levantamientos, no viajes ni mantención", () => {
    const a = accesoModulos(base);
    expect(a.ordenesServicio).toBe(true);
    expect(a.levantamientos).toBe(true);
    expect(a.viajes).toBe(false);
    expect(a.mantencion).toBe(false);
    expect(a.clientes).toBe(true);
  });

  test("chofer: ve viajes, mantención y su vehículo", () => {
    const a = accesoModulos({ ...base, funcion: "chofer" });
    expect(a.viajes).toBe(true);
    expect(a.mantencion).toBe(true);
    expect(a.miVehiculo).toBe(true);
  });

  test("módulos apagados en la empresa se ocultan también para el trabajo propio", () => {
    const a = accesoModulos({ ...base, funcion: "chofer", deshabilitados: ["ordenes_servicio", "viajes", "flota", "levantamientos"] });
    expect(a.ordenesServicio).toBe(false);
    expect(a.viajes).toBe(false);
    expect(a.mantencion).toBe(false);
    expect(a.miVehiculo).toBe(false);
    expect(a.levantamientos).toBe(false);
  });

  test("gestión: sin el módulo en su rol no ve la entrada", () => {
    const a = accesoModulos({ visibles: ["agenda", "registros"], deshabilitados: [], funcion: null, rol: "supervisor", acciones: ["registrar_venta"] });
    expect(a.viajes).toBe(false);
    expect(a.mantencion).toBe(false);
    expect(a.registrarVenta).toBe(false);
    expect(a.levantamientos).toBe(false);
  });

  test("Clientes depende del módulo registros; vender, de la acción más Catálogo o Agenda Pro", () => {
    expect(accesoModulos({ ...base, visibles: ["agenda"] }).clientes).toBe(false);
    expect(accesoModulos({ ...base, acciones: ["registrar_venta"] }).registrarVenta).toBe(true);
    expect(accesoModulos({ ...base, acciones: ["registrar_venta"], visibles: ["registros"] }).registrarVenta).toBe(false);
  });

  test("admin ve levantamientos aunque no tenga función técnica", () => {
    expect(accesoModulos({ ...base, funcion: null, rol: "admin" }).levantamientos).toBe(true);
  });
});
