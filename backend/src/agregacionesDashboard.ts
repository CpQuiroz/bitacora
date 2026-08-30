// ============================================================
// BITÁCORA — Agregaciones para el dashboard de KPIs y para el
// informe con IA estructurado (comparten exactamente la misma
// aritmética, para no calcular lo mismo dos veces).
//
// Todo se agrega en JS a partir de filas ya filtradas por
// empresa_id + rango de fecha — el volumen esperado para una
// pyme es chico, no vale la pena una función SQL de agregación.
// ============================================================
import { supabase } from "./supabase";

function sum(rows: { monto: number }[]): number {
  return rows.reduce((acc, r) => acc + Number(r.monto ?? 0), 0);
}

export async function kpis(empresaId: string, desde: string, hasta: string) {
  const [{ data: facturas }, { data: presupuestos }, { data: trabajos }] = await Promise.all([
    supabase
      .from("facturas")
      .select("monto, estado")
      .eq("empresa_id", empresaId)
      .gte("fecha_emision", desde)
      .lte("fecha_emision", hasta),
    supabase
      .from("presupuestos")
      .select("estado, trabajo_id")
      .eq("empresa_id", empresaId)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("trabajos")
      .select("estado, cliente_id, cliente")
      .eq("empresa_id", empresaId)
      .gte("fecha", desde)
      .lte("fecha", hasta),
  ]);

  const f = facturas ?? [];
  const p = presupuestos ?? [];
  const t = trabajos ?? [];

  const ingresosTotales = sum(f);
  const ingresosRecibidos = sum(f.filter((x) => x.estado === "pagada"));
  const montoPendiente = sum(f.filter((x) => x.estado === "pendiente"));
  const montoVencido = sum(f.filter((x) => x.estado === "vencida"));

  const cantPresupuestos = p.length;
  const convertidos = p.filter((x) => x.estado === "aprobado" || x.trabajo_id != null).length;

  const otCompletadas = t.filter((x) => x.estado === "completado").length;

  const clientesActivos = new Set(t.map((x) => x.cliente_id ?? x.cliente)).size;

  return {
    ingresos_totales: ingresosTotales,
    ingresos_recibidos: ingresosRecibidos,
    pct_recibido: ingresosTotales > 0 ? (ingresosRecibidos / ingresosTotales) * 100 : 0,
    monto_pendiente: montoPendiente,
    monto_vencido: montoVencido,
    cant_presupuestos: cantPresupuestos,
    pct_conversion: cantPresupuestos > 0 ? (convertidos / cantPresupuestos) * 100 : 0,
    ot_completadas: otCompletadas,
    pct_conclusion_ot: t.length > 0 ? (otCompletadas / t.length) * 100 : 0,
    clientes_activos: clientesActivos,
    ticket_promedio: f.length > 0 ? ingresosTotales / f.length : 0,
  };
}

export async function resumenFinanciero(empresaId: string, desde: string, hasta: string) {
  const { data } = await supabase
    .from("facturas")
    .select("monto, estado")
    .eq("empresa_id", empresaId)
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta);
  const f = data ?? [];
  const recibido = sum(f.filter((x) => x.estado === "pagada"));
  const pendiente = sum(f.filter((x) => x.estado === "pendiente"));
  const atrasado = sum(f.filter((x) => x.estado === "vencida"));
  return { recibido, pendiente, atrasado, total: recibido + pendiente + atrasado };
}

export async function resumenGastos(empresaId: string, desde: string, hasta: string) {
  const { data } = await supabase
    .from("gastos")
    .select("monto, estado, fecha")
    .eq("empresa_id", empresaId)
    .gte("fecha", desde)
    .lte("fecha", hasta);
  const g = data ?? [];
  const hoy = new Date().toISOString().slice(0, 10);
  const filaPagado = g.filter((x) => x.estado === "pagado");
  const filaPendiente = g.filter((x) => x.estado === "pendiente" && x.fecha >= hoy);
  const filaVencido = g.filter((x) => x.estado === "pendiente" && x.fecha < hoy);
  const pagado = sum(filaPagado);
  const pendiente = sum(filaPendiente);
  const vencido = sum(filaVencido);
  return {
    pagado,
    pendiente,
    vencido,
    total: pagado + pendiente + vencido,
    cantidad_pagado: filaPagado.length,
    cantidad_pendiente: filaPendiente.length,
    cantidad_vencido: filaVencido.length,
    cantidad_total: g.length,
  };
}

export async function ingresosVsGastos(empresaId: string, desde: string, hasta: string) {
  const [financiero, gastos] = await Promise.all([
    resumenFinanciero(empresaId, desde, hasta),
    resumenGastos(empresaId, desde, hasta),
  ]);
  return {
    ingresos_recibidos: financiero.recibido,
    gastos_pagados: gastos.pagado,
    resultado_neto: financiero.recibido - gastos.pagado,
  };
}

// "vencida" no es un estado guardado — una cotización "enviada" cuya
// fecha_vencimiento ya pasó se reclasifica acá, mismo criterio que ya
// usa la lista de Cotizaciones en el navegador.
export async function estadoPresupuestos(empresaId: string, desde: string, hasta: string) {
  const { data } = await supabase
    .from("presupuestos")
    .select("estado, fecha_vencimiento")
    .eq("empresa_id", empresaId)
    .gte("fecha", desde)
    .lte("fecha", hasta);
  const hoy = new Date().toISOString().slice(0, 10);
  const conteo = new Map<string, number>();
  for (const row of data ?? []) {
    const estado = row.estado === "enviado" && row.fecha_vencimiento && row.fecha_vencimiento < hoy ? "vencida" : row.estado;
    conteo.set(estado, (conteo.get(estado) ?? 0) + 1);
  }
  return Array.from(conteo.entries()).map(([estado, cantidad]) => ({ estado, cantidad }));
}

export async function estadoOT(empresaId: string, desde: string, hasta: string) {
  const { data } = await supabase
    .from("trabajos")
    .select("estado")
    .eq("empresa_id", empresaId)
    .gte("fecha", desde)
    .lte("fecha", hasta);
  const conteo = new Map<string, number>();
  for (const row of data ?? []) conteo.set(row.estado, (conteo.get(row.estado) ?? 0) + 1);
  return Array.from(conteo.entries()).map(([estado, cantidad]) => ({ estado, cantidad }));
}

// Últimos 12 meses (fijo, independiente del selector de período del
// dashboard) — es lo único que tiene sentido para una evolución mensual.
export async function ingresosPorMes(empresaId: string) {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("facturas")
    .select("monto, estado, fecha_emision")
    .eq("empresa_id", empresaId)
    .gte("fecha_emision", desde);

  const meses: { mes: string; recibido: number; pendiente: number; vencido: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ mes: d.toISOString().slice(0, 7), recibido: 0, pendiente: 0, vencido: 0 });
  }
  const porMes = new Map(meses.map((m) => [m.mes, m]));

  for (const row of data ?? []) {
    const mes = String(row.fecha_emision).slice(0, 7);
    const bucket = porMes.get(mes);
    if (!bucket) continue;
    if (row.estado === "pagada") bucket.recibido += Number(row.monto ?? 0);
    else if (row.estado === "pendiente") bucket.pendiente += Number(row.monto ?? 0);
    else if (row.estado === "vencida") bucket.vencido += Number(row.monto ?? 0);
  }

  return meses;
}

// Pestaña Financiero de Informes — distribución del ingreso emitido
// en el período por medio de pago (los cobros sin medio_pago definido
// se agrupan como "Sin definir", no se descartan).
export async function porFormaPago(empresaId: string, desde: string, hasta: string) {
  const { data } = await supabase
    .from("facturas")
    .select("monto, medio_pago")
    .eq("empresa_id", empresaId)
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta);

  type Fila = { medio_pago: string; monto: number; cantidad: number };
  const porMedio = new Map<string, Fila>();
  for (const row of data ?? []) {
    const clave = row.medio_pago ?? "sin_definir";
    let fila = porMedio.get(clave);
    if (!fila) {
      fila = { medio_pago: clave, monto: 0, cantidad: 0 };
      porMedio.set(clave, fila);
    }
    fila.monto += Number(row.monto ?? 0);
    fila.cantidad += 1;
  }
  return Array.from(porMedio.values()).sort((a, b) => b.monto - a.monto);
}

// Pestaña Financiero de Informes — ranking de clientes por ingreso
// emitido en el período. Prefiere cliente_id (cobros creados desde
// que esa FK existe) y cae a nombre de texto para los más viejos.
export async function mejoresClientes(empresaId: string, desde: string, hasta: string) {
  const { data } = await supabase
    .from("facturas")
    .select("cliente, cliente_id, monto")
    .eq("empresa_id", empresaId)
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta);

  type Fila = { cliente: string; cobros: number; ingreso: number };
  const porCliente = new Map<string, Fila>();
  for (const row of data ?? []) {
    const clave = row.cliente_id ?? row.cliente;
    let fila = porCliente.get(clave);
    if (!fila) {
      fila = { cliente: row.cliente, cobros: 0, ingreso: 0 };
      porCliente.set(clave, fila);
    }
    fila.cobros += 1;
    fila.ingreso += Number(row.monto ?? 0);
  }
  return Array.from(porCliente.values())
    .sort((a, b) => b.ingreso - a.ingreso)
    .slice(0, 10);
}

// Pestaña Ventas de Informes.
export async function kpisVentas(empresaId: string, desde: string, hasta: string) {
  const { data } = await supabase
    .from("presupuestos")
    .select("monto, estado, trabajo_id")
    .eq("empresa_id", empresaId)
    .gte("fecha", desde)
    .lte("fecha", hasta);
  const p = data ?? [];
  const total = p.length;
  const valorTotal = sum(p);
  const aprobadas = p.filter((x) => x.estado === "aprobado" || x.trabajo_id != null).length;
  return {
    total_cotizaciones: total,
    valor_total: valorTotal,
    tasa_conversion: total > 0 ? (aprobadas / total) * 100 : 0,
    ticket_promedio: total > 0 ? valorTotal / total : 0,
  };
}

// Últimos 12 meses (fijo) — cantidad de cotizaciones totales vs.
// aprobadas por mes; de acá también sale la tasa de conversión mensual
// (aprobadas/total), sin volver a consultar la tabla.
export async function cotizacionesPorMes(empresaId: string) {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("presupuestos")
    .select("fecha, estado, trabajo_id")
    .eq("empresa_id", empresaId)
    .gte("fecha", desde);

  const meses: { mes: string; total: number; aprobadas: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ mes: d.toISOString().slice(0, 7), total: 0, aprobadas: 0 });
  }
  const porMes = new Map(meses.map((m) => [m.mes, m]));

  for (const row of data ?? []) {
    const bucket = porMes.get(String(row.fecha).slice(0, 7));
    if (!bucket) continue;
    bucket.total += 1;
    if (row.estado === "aprobado" || row.trabajo_id != null) bucket.aprobadas += 1;
  }

  return meses;
}

// Agrupa los ítems de línea de las cotizaciones del período por
// descripción (el nombre del ítem de Catálogo al momento de
// agregarlo) — cantidad y valor total vendido de cada uno.
export async function topServiciosVendidos(empresaId: string, desde: string, hasta: string) {
  const { data: cotizaciones } = await supabase
    .from("presupuestos")
    .select("id")
    .eq("empresa_id", empresaId)
    .gte("fecha", desde)
    .lte("fecha", hasta);
  const ids = (cotizaciones ?? []).map((c) => c.id);
  if (ids.length === 0) return [];

  const { data: items } = await supabase
    .from("presupuesto_items")
    .select("descripcion, cantidad, precio_unitario")
    .eq("empresa_id", empresaId)
    .in("presupuesto_id", ids);

  type Fila = { servicio: string; cantidad: number; valor: number };
  const porServicio = new Map<string, Fila>();
  for (const it of items ?? []) {
    let fila = porServicio.get(it.descripcion);
    if (!fila) {
      fila = { servicio: it.descripcion, cantidad: 0, valor: 0 };
      porServicio.set(it.descripcion, fila);
    }
    fila.cantidad += Number(it.cantidad ?? 0);
    fila.valor += Number(it.cantidad ?? 0) * Number(it.precio_unitario ?? 0);
  }
  return Array.from(porServicio.values())
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);
}

type OrdenEmbed = { estado_os: string } | { estado_os: string }[] | null;
function normalizarOrden(orden: OrdenEmbed): { estado_os: string } | null {
  return (Array.isArray(orden) ? orden[0] : orden) ?? null;
}

// Mismo criterio "de agenda" que ya usa web/.../dashboard/agenda/page.tsx
// (estadoAgendaDe) — se repite acá en el servidor para no depender de
// que el frontend haga esta clasificación. Solo cuenta trabajos con OS
// eager-creada (mismo filtro que el panel de administración de OS).
function estadoOperacion(estadoTrabajo: string, orden: { estado_os: string } | null): "agendado" | "en_progreso" | "completado" | "cancelado" | null {
  if (!orden) return null;
  if (estadoTrabajo === "cancelado") return "cancelado";
  if (orden.estado_os === "en_proceso") return "en_progreso";
  if (estadoTrabajo === "completado" || orden.estado_os === "completada" || orden.estado_os === "firmada") return "completado";
  return "agendado";
}

// Pestaña Operaciones de Informes — KPIs y distribución por estado
// comparten la misma consulta (evita pedir lo mismo dos veces).
export async function kpisYDistribucionOperaciones(empresaId: string, desde: string, hasta: string) {
  const { data } = await supabase
    .from("trabajos")
    .select("estado, orden:ordenes_servicio(estado_os)")
    .eq("empresa_id", empresaId)
    .gte("fecha", desde)
    .lte("fecha", hasta);

  const clasificados = ((data ?? []) as unknown as { estado: string; orden: OrdenEmbed }[])
    .map((t) => estadoOperacion(t.estado, normalizarOrden(t.orden)))
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const total = clasificados.length;
  const completadas = clasificados.filter((e) => e === "completado").length;
  const enCurso = clasificados.filter((e) => e === "en_progreso").length;
  const agendadas = clasificados.filter((e) => e === "agendado").length;

  const distribucion = new Map<string, number>();
  for (const e of clasificados) distribucion.set(e, (distribucion.get(e) ?? 0) + 1);

  return {
    kpis: {
      total_os: total,
      completadas,
      pct_conclusion: total > 0 ? (completadas / total) * 100 : 0,
      en_curso: enCurso,
      agendadas,
    },
    distribucion: Array.from(distribucion.entries()).map(([estado, cantidad]) => ({ estado, cantidad })),
  };
}

// Últimos 12 meses (fijo) — OS totales vs. completadas por mes,
// agrupadas por la fecha del trabajo (mismo criterio que
// cotizacionesPorMes: se bucketiza por fecha de creación, no de cierre).
export async function osPorMes(empresaId: string) {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("trabajos")
    .select("fecha, estado, orden:ordenes_servicio(estado_os)")
    .eq("empresa_id", empresaId)
    .gte("fecha", desde);

  const meses: { mes: string; total: number; completadas: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ mes: d.toISOString().slice(0, 7), total: 0, completadas: 0 });
  }
  const porMes = new Map(meses.map((m) => [m.mes, m]));

  for (const row of (data ?? []) as unknown as { fecha: string; estado: string; orden: OrdenEmbed }[]) {
    const orden = normalizarOrden(row.orden);
    if (!orden) continue;
    const bucket = porMes.get(String(row.fecha).slice(0, 7));
    if (!bucket) continue;
    bucket.total += 1;
    if (row.estado === "completado" || orden.estado_os === "completada" || orden.estado_os === "firmada") bucket.completadas += 1;
  }

  return meses;
}

// Últimos 12 meses (fijo) — promedio de días entre la creación del
// trabajo y el cierre de su OS (ordenes_servicio.finalizada_en),
// agrupado por el mes en que se completó. "dias_promedio: null" en un
// mes sin ninguna OS cerrada (no es un 0 real).
export async function tiempoPromedioConclusion(empresaId: string) {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1).toISOString();

  const { data } = await supabase
    .from("ordenes_servicio")
    .select("finalizada_en, trabajo:trabajos(creado_en)")
    .eq("empresa_id", empresaId)
    .not("finalizada_en", "is", null)
    .gte("finalizada_en", desde);

  const meses: { mes: string; dias_promedio: number | null }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ mes: d.toISOString().slice(0, 7), dias_promedio: null });
  }
  const acumulado = new Map<string, { suma: number; cuenta: number }>();

  for (const row of (data ?? []) as unknown as { finalizada_en: string; trabajo: { creado_en: string } | { creado_en: string }[] | null }[]) {
    const trabajo = Array.isArray(row.trabajo) ? row.trabajo[0] ?? null : row.trabajo;
    if (!trabajo?.creado_en || !row.finalizada_en) continue;
    const mes = row.finalizada_en.slice(0, 7);
    const dias = (new Date(row.finalizada_en).getTime() - new Date(trabajo.creado_en).getTime()) / 86_400_000;
    const actual = acumulado.get(mes) ?? { suma: 0, cuenta: 0 };
    actual.suma += dias;
    actual.cuenta += 1;
    acumulado.set(mes, actual);
  }

  for (const m of meses) {
    const agg = acumulado.get(m.mes);
    if (agg && agg.cuenta > 0) m.dias_promedio = Math.round((agg.suma / agg.cuenta) * 10) / 10;
  }
  return meses;
}

type TipoOsEmbed = { nombre: string } | { nombre: string }[] | null;
function normalizarTipoOs(tipo: TipoOsEmbed): { nombre: string } | null {
  return (Array.isArray(tipo) ? tipo[0] : tipo) ?? null;
}

// Pestaña Servicios de Informes — KPIs + distribución por Tipo de OS
// comparten la misma consulta. Solo cuenta trabajos con OS
// eager-creada, mismo filtro que Operaciones.
export async function kpisYDistribucionServicios(empresaId: string, desde: string, hasta: string) {
  const { data } = await supabase
    .from("trabajos")
    .select("estado, tipo_os_id, cliente, orden:ordenes_servicio(estado_os), tipo:tipos_os(nombre)")
    .eq("empresa_id", empresaId)
    .gte("fecha", desde)
    .lte("fecha", hasta);

  type Fila = { estado: string; tipo_os_id: string | null; cliente: string; orden: OrdenEmbed; tipo: TipoOsEmbed };
  const filas = ((data ?? []) as unknown as Fila[])
    .map((t) => ({ ...t, orden: normalizarOrden(t.orden), tipo: normalizarTipoOs(t.tipo) }))
    .filter((t) => t.orden !== null);

  const total = filas.length;
  const completadas = filas.filter(
    (t) => t.estado === "completado" || t.orden?.estado_os === "completada" || t.orden?.estado_os === "firmada"
  ).length;
  const tiposUtilizados = new Set(filas.filter((t) => t.tipo_os_id).map((t) => t.tipo_os_id)).size;

  const porTipo = new Map<string, { nombre: string; cantidad: number }>();
  const porClienteTipo = new Map<string, { cliente: string; tipo: string; cantidad: number }>();
  for (const t of filas) {
    if (!t.tipo_os_id || !t.tipo) continue;
    const actual = porTipo.get(t.tipo_os_id) ?? { nombre: t.tipo.nombre, cantidad: 0 };
    actual.cantidad += 1;
    porTipo.set(t.tipo_os_id, actual);

    const claveCT = `${t.cliente}::${t.tipo_os_id}`;
    const filaCT = porClienteTipo.get(claveCT) ?? { cliente: t.cliente, tipo: t.tipo.nombre, cantidad: 0 };
    filaCT.cantidad += 1;
    porClienteTipo.set(claveCT, filaCT);
  }

  return {
    kpis: {
      total_os: total,
      completadas,
      tipos_utilizados: tiposUtilizados,
      tasa_promedio: total > 0 ? (completadas / total) * 100 : 0,
    },
    distribucion_tipo: Array.from(porTipo.values()).map((t) => ({ estado: t.nombre, cantidad: t.cantidad })),
    ranking_tipos: Array.from(porTipo.values())
      .map((t) => ({ nombre: t.nombre, valor: t.cantidad }))
      .sort((a, b) => b.valor - a.valor),
    top_clientes_por_tipo: Array.from(porClienteTipo.values()).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10),
  };
}

// Pestaña Clientes de Informes.
export async function kpisClientes(empresaId: string, desde: string, hasta: string) {
  const [{ data: todos }, { data: facturasPeriodo }] = await Promise.all([
    supabase.from("clientes").select("activo, creado_en").eq("empresa_id", empresaId),
    supabase.from("facturas").select("monto").eq("empresa_id", empresaId).gte("fecha_emision", desde).lte("fecha_emision", hasta),
  ]);
  const c = todos ?? [];
  const totalClientes = c.length;
  const activos = c.filter((x) => x.activo).length;
  const nuevos = c.filter((x) => x.creado_en >= desde && x.creado_en <= `${hasta}T23:59:59`).length;
  const ingresoTotal = sum(facturasPeriodo ?? []);

  return {
    total_clientes: totalClientes,
    clientes_activos: activos,
    nuevos_clientes: nuevos,
    ingreso_promedio: totalClientes > 0 ? ingresoTotal / totalClientes : 0,
  };
}

export async function distribucionClientes(empresaId: string) {
  const { data } = await supabase.from("clientes").select("activo").eq("empresa_id", empresaId);
  const activos = (data ?? []).filter((c) => c.activo).length;
  const inactivos = (data ?? []).length - activos;
  return [
    { estado: "Activo", cantidad: activos },
    { estado: "Inactivo", cantidad: inactivos },
  ].filter((d) => d.cantidad > 0);
}

// Últimos 12 meses (fijo) — nuevos clientes por mes y el total
// acumulado de la base a fin de cada mes (incluye clientes creados
// antes de la ventana de 12 meses en el acumulado inicial).
export async function clientesPorMes(empresaId: string) {
  const { data } = await supabase.from("clientes").select("creado_en").eq("empresa_id", empresaId).order("creado_en");
  const filas = data ?? [];

  const hoy = new Date();
  const inicioVentana = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
  const inicioVentanaStr = inicioVentana.toISOString().slice(0, 10);

  let acumuladoInicial = 0;
  const nuevosPorMes = new Map<string, number>();
  for (const f of filas) {
    const fecha = String(f.creado_en).slice(0, 10);
    if (fecha < inicioVentanaStr) {
      acumuladoInicial += 1;
    } else {
      const mes = fecha.slice(0, 7);
      nuevosPorMes.set(mes, (nuevosPorMes.get(mes) ?? 0) + 1);
    }
  }

  const meses: { mes: string; nuevos: number; total: number }[] = [];
  let acumulado = acumuladoInicial;
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const mes = d.toISOString().slice(0, 7);
    const nuevos = nuevosPorMes.get(mes) ?? 0;
    acumulado += nuevos;
    meses.push({ mes, nuevos, total: acumulado });
  }
  return meses;
}

// Retención mes a mes: de los clientes con actividad (trabajo o
// cobro) el mes anterior, qué % también tuvo actividad este mes.
// "null" cuando no hay base del mes anterior contra la cual medir.
export async function tasaRetencionPorMes(empresaId: string) {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 12, 1).toISOString().slice(0, 10);

  const [{ data: trabajos }, { data: facturas }] = await Promise.all([
    supabase.from("trabajos").select("cliente_id, cliente, fecha").eq("empresa_id", empresaId).gte("fecha", desde),
    supabase.from("facturas").select("cliente_id, cliente, fecha_emision").eq("empresa_id", empresaId).gte("fecha_emision", desde),
  ]);

  const porMes = new Map<string, Set<string>>();
  const marcar = (mes: string, clave: string) => {
    if (!porMes.has(mes)) porMes.set(mes, new Set());
    porMes.get(mes)!.add(clave);
  };
  for (const t of trabajos ?? []) marcar(String(t.fecha).slice(0, 7), t.cliente_id ?? t.cliente);
  for (const f of facturas ?? []) marcar(String(f.fecha_emision).slice(0, 7), f.cliente_id ?? f.cliente);

  const meses: { mes: string; valor: number | null }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const mesActual = d.toISOString().slice(0, 7);
    const mesAnterior = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 7);
    const actuales = porMes.get(mesActual);
    const anteriores = porMes.get(mesAnterior);
    if (!actuales?.size || !anteriores?.size) {
      meses.push({ mes: mesActual, valor: null });
      continue;
    }
    let retenidos = 0;
    for (const k of actuales) if (anteriores.has(k)) retenidos += 1;
    meses.push({ mes: mesActual, valor: Math.round((retenidos / anteriores.size) * 1000) / 10 });
  }
  return meses;
}

export async function clientesPorComuna(empresaId: string) {
  const { data } = await supabase.from("clientes").select("comuna").eq("empresa_id", empresaId).not("comuna", "is", null);
  const conteo = new Map<string, number>();
  for (const row of data ?? []) {
    const comuna = (row.comuna as string).trim();
    if (!comuna) continue;
    conteo.set(comuna, (conteo.get(comuna) ?? 0) + 1);
  }
  return Array.from(conteo.entries())
    .map(([nombre, valor]) => ({ nombre, valor }))
    .sort((a, b) => b.valor - a.valor);
}

// Pestaña única "Gastos" de Informes — misma forma para las 3
// dimensiones, agrupando por una u otra. "categoria"/"centro_costo"
// consideran todos los gastos del período; "os" mantiene el filtro que
// ya tenía la vieja pestaña "Gastos en OS" (solo gastos vinculados a
// una orden de servicio) — es una decisión de producto confirmada, no
// un descuido: no se generaliza a "Sin OS" para no cambiar los números
// que ya veía el usuario en esa dimensión.
export async function gastosAgrupados(empresaId: string, desde: string, hasta: string, dimension: "categoria" | "centro_costo" | "os") {
  const porGrupo = new Map<string, number>();
  const porMes = new Map<string, number>();
  let cantidadConGrupo = 0;

  if (dimension === "categoria") {
    type Fila = { monto: number; categoria: string; fecha: string };
    const { data } = await supabase
      .from("gastos")
      .select("monto, categoria, fecha")
      .eq("empresa_id", empresaId)
      .gte("fecha", desde)
      .lte("fecha", hasta);
    for (const row of (data ?? []) as unknown as Fila[]) {
      porGrupo.set(row.categoria, (porGrupo.get(row.categoria) ?? 0) + Number(row.monto ?? 0));
      porMes.set(row.fecha.slice(0, 7), (porMes.get(row.fecha.slice(0, 7)) ?? 0) + Number(row.monto ?? 0));
      cantidadConGrupo += 1;
    }
  } else if (dimension === "centro_costo") {
    type Fila = { monto: number; centro_costo_id: string | null; fecha: string; centro_costo: { nombre: string } | { nombre: string }[] | null };
    const { data } = await supabase
      .from("gastos")
      .select("monto, centro_costo_id, fecha, centro_costo:centros_costo(nombre)")
      .eq("empresa_id", empresaId)
      .gte("fecha", desde)
      .lte("fecha", hasta);
    for (const row of (data ?? []) as unknown as Fila[]) {
      if (!row.centro_costo_id) continue;
      const centro = Array.isArray(row.centro_costo) ? row.centro_costo[0] : row.centro_costo;
      const nombre = centro?.nombre ?? "—";
      porGrupo.set(nombre, (porGrupo.get(nombre) ?? 0) + Number(row.monto ?? 0));
      porMes.set(row.fecha.slice(0, 7), (porMes.get(row.fecha.slice(0, 7)) ?? 0) + Number(row.monto ?? 0));
      cantidadConGrupo += 1;
    }
  } else {
    type Fila = { monto: number; fecha: string; trabajo_id: string | null };
    const { data } = await supabase
      .from("gastos")
      .select("monto, fecha, trabajo_id")
      .eq("empresa_id", empresaId)
      .not("trabajo_id", "is", null)
      .gte("fecha", desde)
      .lte("fecha", hasta);
    const filas = (data ?? []) as unknown as Fila[];

    const trabajoIds = [...new Set(filas.map((f) => f.trabajo_id).filter((id): id is string => id != null))];
    const etiquetaPorTrabajo = new Map<string, string>();
    if (trabajoIds.length > 0) {
      const [{ data: trabajos }, { data: ordenes }] = await Promise.all([
        supabase.from("trabajos").select("id, cliente").in("id", trabajoIds),
        supabase.from("ordenes_servicio").select("trabajo_id, folio").in("trabajo_id", trabajoIds),
      ]);
      const folioPorTrabajo = new Map((ordenes ?? []).map((o) => [o.trabajo_id as string, o.folio as number | null]));
      for (const t of trabajos ?? []) {
        const folio = folioPorTrabajo.get(t.id);
        etiquetaPorTrabajo.set(t.id, folio != null ? `OS N° ${folio} — ${t.cliente}` : t.cliente);
      }
    }

    for (const row of filas) {
      const etiqueta = etiquetaPorTrabajo.get(row.trabajo_id!) ?? "—";
      porGrupo.set(etiqueta, (porGrupo.get(etiqueta) ?? 0) + Number(row.monto ?? 0));
      porMes.set(row.fecha.slice(0, 7), (porMes.get(row.fecha.slice(0, 7)) ?? 0) + Number(row.monto ?? 0));
      cantidadConGrupo += 1;
    }
  }

  const total = Array.from(porGrupo.values()).reduce((a, b) => a + b, 0);
  const ranking = Array.from(porGrupo.entries())
    .map(([nombre, valor]) => ({ nombre, valor }))
    .sort((a, b) => b.valor - a.valor);

  return {
    kpis: {
      total_gastos: total,
      grupos_con_gastos: porGrupo.size,
      promedio_por_grupo: porGrupo.size > 0 ? total / porGrupo.size : 0,
      mayor_grupo: ranking[0]?.nombre ?? null,
      cantidad_gastos: cantidadConGrupo,
    },
    distribucion: ranking.map((r) => ({ estado: r.nombre, cantidad: r.valor })),
    ranking,
    evolucion: Array.from(porMes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, monto]) => ({ mes, monto })),
  };
}

// Para el informe IA tipo "clientes" — agrupa por nombre de cliente
// (texto libre en ambas tablas, no hay FK en facturas) el monto
// facturado por estado y la cantidad de trabajos en el período.
export async function topClientes(empresaId: string, desde: string, hasta: string) {
  const [{ data: trabajos }, { data: facturas }] = await Promise.all([
    supabase
      .from("trabajos")
      .select("cliente")
      .eq("empresa_id", empresaId)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("facturas")
      .select("cliente, monto, estado")
      .eq("empresa_id", empresaId)
      .gte("fecha_emision", desde)
      .lte("fecha_emision", hasta),
  ]);

  type Fila = { cliente: string; cantidad_trabajos: number; monto_facturado: number; monto_vencido: number };
  const porCliente = new Map<string, Fila>();
  const obtener = (nombre: string) => {
    let fila = porCliente.get(nombre);
    if (!fila) {
      fila = { cliente: nombre, cantidad_trabajos: 0, monto_facturado: 0, monto_vencido: 0 };
      porCliente.set(nombre, fila);
    }
    return fila;
  };

  for (const t of trabajos ?? []) obtener(t.cliente).cantidad_trabajos += 1;
  for (const f of facturas ?? []) {
    const fila = obtener(f.cliente);
    fila.monto_facturado += Number(f.monto ?? 0);
    if (f.estado === "vencida") fila.monto_vencido += Number(f.monto ?? 0);
  }

  return Array.from(porCliente.values()).sort((a, b) => b.monto_facturado - a.monto_facturado);
}

// Para el informe IA tipo "colaboradores" — trabajos completados y
// calificación de satisfacción promedio por responsable en el período.
export async function desempenoColaboradores(empresaId: string, desde: string, hasta: string) {
  const [{ data: trabajos }, { data: usuarios }] = await Promise.all([
    supabase
      .from("trabajos")
      .select("responsable_id, estado, calificacion_satisfaccion")
      .eq("empresa_id", empresaId)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase.from("usuarios").select("id, nombre").eq("empresa_id", empresaId),
  ]);

  const nombreDe = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]));

  type Fila = { colaborador: string; total_trabajos: number; completados: number; calificaciones: number[] };
  const porColaborador = new Map<string, Fila>();

  for (const t of trabajos ?? []) {
    if (!t.responsable_id) continue;
    const nombre = nombreDe.get(t.responsable_id) ?? "—";
    let fila = porColaborador.get(t.responsable_id);
    if (!fila) {
      fila = { colaborador: nombre, total_trabajos: 0, completados: 0, calificaciones: [] };
      porColaborador.set(t.responsable_id, fila);
    }
    fila.total_trabajos += 1;
    if (t.estado === "completado") fila.completados += 1;
    if (t.calificacion_satisfaccion != null) fila.calificaciones.push(t.calificacion_satisfaccion);
  }

  return Array.from(porColaborador.values()).map(({ calificaciones, ...resto }) => ({
    ...resto,
    calificacion_promedio:
      calificaciones.length > 0 ? calificaciones.reduce((a, b) => a + b, 0) / calificaciones.length : null,
  }));
}
