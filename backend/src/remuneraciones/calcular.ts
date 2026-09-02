// ============================================================
// BITÁCORA — Módulo Remuneraciones: arma la entrada del cálculo desde
// los datos laborales del colaborador + los haberes variables del mes,
// y mapea el resultado a una fila de `liquidaciones` (con snapshot).
// ============================================================
import {
  calcularLiquidacion,
  type DatosLaborales,
  type EntradaLiquidacion,
  type Liquidacion,
  type ParametroPrevisional,
} from "@bitacora/shared";
import { comisionDeAfp } from "./parametros";

// Haberes/descuentos variables que el contador ajusta por mes en la
// pantalla de detalle. Los fijos (sueldo base, colación, movilización)
// salen de datos_laborales.
export type VariablesMes = {
  dias_trabajados?: number;
  horas_extra?: number;
  otros_imponibles?: number;
  otros_no_imponibles?: number;
  asignacion_familiar?: number;
  otros_descuentos?: number;
};

export async function armarLiquidacion(
  periodo: string,
  datos: DatosLaborales,
  params: ParametroPrevisional,
  variables: VariablesMes
): Promise<Omit<Liquidacion, "id" | "empresa_id" | "usuario_id" | "pdf_url" | "estado" | "creado_por" | "emitida_en" | "creado_en" | "actualizado_en">> {
  const comision = await comisionDeAfp(periodo, datos.afp);

  const entrada: EntradaLiquidacion = {
    diasTrabajados: variables.dias_trabajados ?? 30,
    tipoContrato: datos.tipo_contrato,
    cotizaAfp: Boolean(datos.afp),
    sistemaSalud: datos.sistema_salud,
    planIsapreUf: datos.plan_isapre_uf,
    planIsaprePesos: datos.plan_isapre_pesos,
    gratificacionLegal: datos.gratificacion_legal,
    sueldoBaseMensual: Number(datos.sueldo_base),
    colacionMensual: Number(datos.colacion_mensual),
    movilizacionMensual: Number(datos.movilizacion_mensual),
    horasExtra: Number(variables.horas_extra ?? 0),
    otrosImponibles: Number(variables.otros_imponibles ?? 0),
    otrosNoImponibles: Number(variables.otros_no_imponibles ?? 0),
    asignacionFamiliarMonto: Number(variables.asignacion_familiar ?? 0),
    otrosDescuentos: Number(variables.otros_descuentos ?? 0),
    tasaMutualEmpresa: datos.tasa_mutual_empresa,
  };

  const p = {
    periodo: params.periodo,
    uf: Number(params.uf),
    utm: Number(params.utm),
    ingresoMinimo: Number(params.ingreso_minimo),
    topeImponibleUf: Number(params.tope_imponible_uf),
    topeAfcUf: Number(params.tope_afc_uf),
    topeGratificacionMensual: Number(params.tope_gratificacion_mensual),
    tasaSis: Number(params.tasa_sis),
    tasaMutualBase: Number(params.tasa_mutual_base),
    tramosImpuesto: params.tramos_impuesto,
    comisionAfp: comision,
  };

  const res = calcularLiquidacion(entrada, p);

  return {
    periodo,
    dias_trabajados: res.diasTrabajados,
    sueldo_base: res.sueldoBase,
    gratificacion: res.gratificacion,
    horas_extra: res.horasExtra,
    otros_imponibles: res.otrosImponibles,
    colacion: res.colacion,
    movilizacion: res.movilizacion,
    otros_no_imponibles: res.otrosNoImponibles,
    asignacion_familiar: res.asignacionFamiliar,
    total_haberes: res.totalHaberes,
    base_imponible: res.baseImponible,
    base_tributable: res.baseTributable,
    cotizacion_afp: res.cotizacionAfp,
    comision_afp: res.comisionAfp,
    cotizacion_salud: res.cotizacionSalud,
    salud_adicional: res.saludAdicional,
    cotizacion_afc: res.cotizacionAfc,
    impuesto_unico: res.impuestoUnico,
    otros_descuentos: res.otrosDescuentos,
    total_descuentos: res.totalDescuentos,
    liquido_pagar: res.liquidoPagar,
    aporte_afc_empleador: res.aporteAfcEmpleador,
    aporte_sis: res.aporteSis,
    aporte_mutual: res.aporteMutual,
    // Snapshot inmutable: qué insumos se usaron.
    detalle: {
      parametros: p,
      entrada,
      resultado: res,
      calculado_en: new Date().toISOString(),
    },
  };
}
