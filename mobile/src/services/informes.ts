import { apiJson } from "./api";

// Mismos endpoints y mismo formato de query (?periodo=personalizado&
// desde=&hasta=) que ya usa web/src/app/dashboard/informes — acá solo
// se consumen, ninguna agregación se recalcula en el cliente. Los tipos
// son un espejo de los que ya declara cada page.tsx de la web.

type Periodo = { desde: string; hasta: string };
export type PuntoDistribucion = { estado: string; cantidad: number };
export type PuntoRanking = { nombre: string; valor: number };

async function obtener<T>(ruta: string, desde: string, hasta: string, extra = ""): Promise<T> {
  const res = await apiJson<T>(`/api/informes/${ruta}?periodo=personalizado&desde=${desde}&hasta=${hasta}${extra}`);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

// --- Visión General ---
export type VisionGeneralKpis = {
  ingresos_totales: number;
  cant_presupuestos: number;
  pct_conversion: number;
  ot_completadas: number;
  pct_conclusion_ot: number;
  clientes_activos: number;
};
export type ResumenGastos = {
  pagado: number;
  pendiente: number;
  vencido: number;
  total: number;
  cantidad_pagado: number;
  cantidad_pendiente: number;
  cantidad_vencido: number;
  cantidad_total: number;
};
export type IngresosVsGastos = { ingresos_recibidos: number; gastos_pagados: number; resultado_neto: number };
export type PuntoIngresoMes = { mes: string; recibido: number; pendiente: number; vencido: number };
export type VisionGeneral = Periodo & {
  kpis: VisionGeneralKpis;
  resumen_gastos: ResumenGastos;
  ingresos_vs_gastos: IngresosVsGastos;
  ingresos_por_mes: PuntoIngresoMes[];
};
export function obtenerVisionGeneral(desde: string, hasta: string) {
  return obtener<VisionGeneral>("vision-general", desde, hasta);
}

// --- Financiero ---
export type ResumenFinanciero = { recibido: number; pendiente: number; atrasado: number; total: number };
export type PorFormaPago = { medio_pago: string; monto: number; cantidad: number };
export type MejorCliente = { cliente: string; cobros: number; ingreso: number };
export type Financiero = Periodo & {
  resumen_financiero: ResumenFinanciero;
  ingresos_por_mes: PuntoIngresoMes[];
  por_forma_pago: PorFormaPago[];
  mejores_clientes: MejorCliente[];
};
export function obtenerFinanciero(desde: string, hasta: string) {
  return obtener<Financiero>("financiero", desde, hasta);
}

// --- Ventas ---
export type VentasKpis = { total_cotizaciones: number; valor_total: number; tasa_conversion: number; ticket_promedio: number };
export type PuntoCotizacionesMes = { mes: string; total: number; aprobadas: number };
export type TopServicio = { servicio: string; cantidad: number; valor: number };
export type Ventas = Periodo & {
  kpis: VentasKpis;
  cotizaciones_por_mes: PuntoCotizacionesMes[];
  distribucion_estado: PuntoDistribucion[];
  top_servicios: TopServicio[];
};
export function obtenerVentas(desde: string, hasta: string) {
  return obtener<Ventas>("ventas", desde, hasta);
}

// --- Operaciones ---
export type OperacionesKpis = { total_os: number; completadas: number; pct_conclusion: number; en_curso: number; agendadas: number };
export type PuntoOsMes = { mes: string; total: number; completadas: number };
export type PuntoTiempoConclusion = { mes: string; dias_promedio: number | null };
export type Operaciones = Periodo & {
  kpis: OperacionesKpis;
  distribucion_estado: PuntoDistribucion[];
  os_por_mes: PuntoOsMes[];
  tiempo_promedio_conclusion: PuntoTiempoConclusion[];
};
export function obtenerOperaciones(desde: string, hasta: string) {
  return obtener<Operaciones>("operaciones", desde, hasta);
}

// --- Servicios ---
export type ServiciosKpis = { total_os: number; completadas: number; tipos_utilizados: number; tasa_promedio: number };
export type TopClientePorTipo = { cliente: string; tipo: string; cantidad: number };
export type Servicios = Periodo & {
  kpis: ServiciosKpis;
  distribucion_tipo: PuntoDistribucion[];
  ranking_tipos: PuntoRanking[];
  top_clientes_por_tipo: TopClientePorTipo[];
};
export function obtenerServicios(desde: string, hasta: string) {
  return obtener<Servicios>("servicios", desde, hasta);
}

// --- Clientes ---
export type ClientesKpis = { total_clientes: number; clientes_activos: number; nuevos_clientes: number; ingreso_promedio: number };
export type PuntoClientesMes = { mes: string; nuevos: number; total: number };
export type PuntoPorcentaje = { mes: string; valor: number | null };
export type ClientesInforme = Periodo & {
  kpis: ClientesKpis;
  distribucion_estado: PuntoDistribucion[];
  clientes_por_mes: PuntoClientesMes[];
  tasa_retencion: PuntoPorcentaje[];
  por_comuna: PuntoRanking[];
};
export function obtenerClientesInforme(desde: string, hasta: string) {
  return obtener<ClientesInforme>("clientes", desde, hasta);
}

// --- Gastos (con selector interno de agrupación) ---
export type AgrupacionGastos = "categoria" | "centro_costo" | "os";
export type GastosKpis = {
  total_gastos: number;
  grupos_con_gastos: number;
  promedio_por_grupo: number;
  mayor_grupo: string | null;
  cantidad_gastos: number;
};
export type PuntoEvolucionSimple = { mes: string; monto: number };
export type GastosInforme = Periodo & {
  agrupacion: AgrupacionGastos;
  kpis: GastosKpis;
  distribucion: PuntoDistribucion[];
  ranking: PuntoRanking[];
  evolucion: PuntoEvolucionSimple[];
};
export function obtenerGastosInforme(desde: string, hasta: string, agrupacion: AgrupacionGastos) {
  return obtener<GastosInforme>("gastos", desde, hasta, `&agrupacion=${agrupacion}`);
}
