// ============================================================
// BITÁCORA — Libro de Remuneraciones Electrónico (Dirección del Trabajo).
//
// CSV con encabezado y columnas estandarizadas por la DT, una fila por
// trabajador. Obligación mensual desde 2021. Referencia: DT →
// "Formato y Estructura del Libro de Remuneraciones Electrónico".
//
// ⚠️ BORRADOR — la DT tiene su propio validador. El contador revisa el
// primer archivo contra ese validador antes de presentarlo. Las
// columnas de abajo son el subconjunto que Bitácora puede completar; el
// LRE completo tiene más columnas (semana corrida, participación,
// aguinaldos, viáticos, etc.) que quedan en 0 si no se usan.
// ============================================================
import type { DatosLaborales, Liquidacion } from "@bitacora/shared";

export type FilaLre = {
  liquidacion: Liquidacion;
  datos: DatosLaborales;
  usuario: { nombre: string; rut: string | null };
};

// Orden y nombres según el formato DT. Cada entrada: [encabezado, valor].
function fila(f: FilaLre): [string, string | number][] {
  const L = f.liquidacion;
  const D = f.datos;
  const totalImpTrib = L.base_imponible; // imponible y tributable
  return [
    ["Rut trabajador", f.usuario.rut ?? ""],
    ["Nombre trabajador", f.usuario.nombre],
    ["Fecha inicio contrato", D.fecha_ingreso ?? ""],
    ["Fecha término contrato", ""],
    ["Causal término de contrato", ""],
    ["Tipo de contrato", D.tipo_contrato],
    ["Region prestación de servicios", ""],
    ["Comuna prestación de servicios", ""],
    ["Tipo impuesto a la renta", "Impuesto único"],
    ["AFP", D.afp ?? ""],
    ["FONASA - ISAPRE", D.sistema_salud],
    ["Días trabajados en el mes", L.dias_trabajados],
    // Haberes
    ["Sueldo (Haber)", L.sueldo_base],
    ["Sobresueldo (Haber)", L.horas_extra],
    ["Comisiones (Haber)", 0],
    ["Gratificación (Haber)", L.gratificacion],
    ["Bonos u otras remuneraciones fijas mensuales (Haber)", L.otros_imponibles],
    ["Colación (Haber no imponible)", L.colacion],
    ["Movilización (Haber no imponible)", L.movilizacion],
    ["Asignación familiar legal (Haber no imponible)", L.asignacion_familiar],
    ["Otros haberes no imponibles (Haber no imponible)", L.otros_no_imponibles],
    // Descuentos legales
    ["Cotización obligatoria previsional (AFP) (Descuento Legal)", L.cotizacion_afp + L.comision_afp],
    ["Cotización obligatoria salud 7% (Descuento Legal)", L.cotizacion_salud],
    ["Cotización voluntaria salud - adicional Isapre (Descuento Legal)", L.salud_adicional],
    ["Cotización AFC - trabajador (Descuento Legal)", L.cotizacion_afc],
    ["Impuesto retenido por remuneraciones (Descuento Legal)", L.impuesto_unico],
    ["Otros descuentos (Otros Descuentos)", L.otros_descuentos],
    // Totales
    ["Total Haberes", L.total_haberes],
    ["Total Haberes Imponibles y Tributables", totalImpTrib],
    ["Total Haberes No Imponibles y No Tributables", L.colacion + L.movilizacion + L.otros_no_imponibles + L.asignacion_familiar],
    ["Total Descuentos", L.total_descuentos],
    ["Total descuentos por cotizaciones del trabajador", L.cotizacion_afp + L.comision_afp + L.cotizacion_salud + L.salud_adicional + L.cotizacion_afc],
    ["Impuesto a las Remuneraciones", L.impuesto_unico],
    ["Total Líquido", L.liquido_pagar],
    // Aportes del empleador
    ["Aporte AFC empleador", L.aporte_afc_empleador],
    ["Aporte SIS empleador", L.aporte_sis],
    ["Aporte mutualidad empleador", L.aporte_mutual],
  ];
}

function celda(v: unknown): string {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function generarLibroRemuneracionesDT(filas: FilaLre[]): string {
  if (filas.length === 0) return "";
  const encabezados = fila(filas[0]).map(([h]) => h);
  const lineas = [encabezados.join(";")];
  for (const f of filas) lineas.push(fila(f).map(([, v]) => celda(v)).join(";"));
  return "﻿" + lineas.join("\r\n") + "\r\n";
}
