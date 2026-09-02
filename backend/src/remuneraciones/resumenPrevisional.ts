// ============================================================
// BITÁCORA — Resumen previsional del período (CSV).
//
// A diferencia del archivo Previred (formato estricto, 105 campos), este
// es un CSV legible con TODO lo que el contador necesita para completar
// o verificar Previred y el Libro de Remuneraciones de la DT. Es 100%
// datos propios de Bitácora — sin riesgo de formato mal armado.
// ============================================================
import { AFP_CHILE, type DatosLaborales, type Liquidacion } from "@bitacora/shared";

export type FilaResumen = {
  liquidacion: Liquidacion;
  datos: DatosLaborales;
  usuario: { nombre: string; rut: string | null };
};

const COLUMNAS = [
  "RUT",
  "Nombre",
  "Contrato",
  "Días trabajados",
  "AFP",
  "Cód. AFP",
  "Renta imponible AFP",
  "Cotización AFP 10%",
  "Comisión AFP",
  "Aporte SIS (empleador)",
  "Sistema salud",
  "Cód. institución salud",
  "Renta imponible salud",
  "Cotización salud 7%",
  "Adicional Isapre",
  "Renta imponible AFC",
  "AFC trabajador 0,6%",
  "AFC empleador",
  "Impuesto único",
  "Total haberes",
  "Total descuentos",
  "Líquido a pagar",
  "Costo empresa (mutual)",
];

function celda(v: unknown): string {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function generarResumenPrevisional(filas: FilaResumen[]): string {
  const lineas = [COLUMNAS.join(";")];
  for (const { liquidacion: L, datos: D, usuario: U } of filas) {
    lineas.push(
      [
        U.rut ?? "",
        U.nombre,
        D.tipo_contrato,
        L.dias_trabajados,
        AFP_CHILE.find((a) => a.afp === D.afp)?.nombre ?? "",
        AFP_CHILE.find((a) => a.afp === D.afp)?.codigoPrevired ?? "",
        L.base_imponible,
        L.cotizacion_afp,
        L.comision_afp,
        L.aporte_sis,
        D.sistema_salud,
        D.sistema_salud === "isapre" ? D.codigo_isapre ?? "" : "07",
        L.base_imponible,
        L.cotizacion_salud,
        L.salud_adicional,
        L.base_imponible,
        L.cotizacion_afc,
        L.aporte_afc_empleador,
        L.impuesto_unico,
        L.total_haberes,
        L.total_descuentos,
        L.liquido_pagar,
        L.aporte_mutual,
      ]
        .map(celda)
        .join(";")
    );
  }
  return "﻿" + lineas.join("\r\n") + "\r\n"; // BOM para Excel
}
