// ============================================================
// BITÁCORA — PDF de una liquidación de sueldo (módulo Remuneraciones).
// pdfkit puro, mismo patrón que generarPdfOS.ts / generarPdfCotizacion.ts.
// ============================================================
import PDFDocument from "pdfkit";
import type { Liquidacion } from "@bitacora/shared";

export type DatosLiquidacionPdf = {
  empresaNombre: string;
  empresaRut?: string | null;
  empresaLogoUrl: string | null;
  colorPrimario: string | null;
  colaboradorNombre: string;
  colaboradorRut?: string | null;
  cargo?: string | null;
  tipoContrato: string;
  fechaIngreso?: string | null;
  afp?: string | null;
  sistemaSalud: string;
  periodo: string; // 'YYYY-MM'
  liquidacion: Liquidacion;
};

const monto = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

async function descargar(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function nombrePeriodo(p: string): string {
  const [a, m] = p.split("-");
  return `${MESES[Number(m) - 1] ?? m} ${a}`;
}

export async function generarPdfLiquidacion(datos: DatosLiquidacionPdf): Promise<Buffer> {
  const logoBuffer = datos.empresaLogoUrl ? await descargar(datos.empresaLogoUrl) : null;
  const colorMarca = datos.colorPrimario ?? "#4338ca";
  const L = datos.liquidacion;

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const listo = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // --- Encabezado ---
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 50, 45, { width: 60, height: 60, fit: [60, 60] });
    } catch {
      /* logo inválido — se omite */
    }
  }
  doc.fontSize(15).font("Helvetica-Bold").fillColor(colorMarca).text(datos.empresaNombre, logoBuffer ? 120 : 50, 50);
  if (datos.empresaRut) doc.fontSize(9).font("Helvetica").fillColor("#555").text(`RUT ${datos.empresaRut}`, logoBuffer ? 120 : 50);
  doc.fontSize(16).font("Helvetica-Bold").fillColor("#000").text("Liquidación de sueldo", 300, 50, { align: "right" });
  doc.fontSize(11).font("Helvetica").fillColor("#555").text(nombrePeriodo(datos.periodo), 300, 72, { align: "right" });
  doc.moveTo(50, 112).lineTo(545, 112).strokeColor(colorMarca).lineWidth(2).stroke();
  doc.strokeColor("#000").lineWidth(1);
  doc.fillColor("#000").y = 124;

  // --- Datos del trabajador ---
  doc.fontSize(9).font("Helvetica");
  const fila = (et: string, val: string) => {
    doc.font("Helvetica-Bold").text(et, 50, doc.y, { continued: true, width: 130 });
    doc.font("Helvetica").text(` ${val}`);
  };
  fila("Trabajador:", datos.colaboradorNombre + (datos.colaboradorRut ? `  (RUT ${datos.colaboradorRut})` : ""));
  fila("Contrato:", datos.tipoContrato.replace("_", " ") + (datos.fechaIngreso ? `  · ingreso ${datos.fechaIngreso}` : ""));
  fila("Previsión:", `${(datos.afp ?? "sin AFP").toUpperCase()}  ·  ${datos.sistemaSalud === "isapre" ? "Isapre" : "Fonasa"}`);
  fila("Días trabajados:", String(L.dias_trabajados));
  doc.moveDown(1);

  // --- Dos columnas: haberes / descuentos ---
  const izq = 50;
  const der = 305;
  const yTablas = doc.y;

  const seccion = (x: number, titulo: string) => {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(colorMarca).text(titulo, x, doc.y, { width: 240 });
    doc.fillColor("#000").fontSize(9).font("Helvetica");
    doc.moveDown(0.3);
  };
  const linea = (x: number, et: string, val: number) => {
    if (!val) return;
    const y = doc.y;
    doc.font("Helvetica").text(et, x, y, { width: 165 });
    doc.text(monto(val), x + 165, y, { width: 75, align: "right" });
    doc.moveDown(0.15);
  };
  const total = (x: number, et: string, val: number) => {
    doc.moveTo(x, doc.y + 2).lineTo(x + 240, doc.y + 2).strokeColor("#999").stroke();
    doc.moveDown(0.25);
    const y = doc.y;
    doc.font("Helvetica-Bold").text(et, x, y, { width: 165 });
    doc.text(monto(val), x + 165, y, { width: 75, align: "right" });
  };

  // Haberes
  doc.y = yTablas;
  seccion(izq, "HABERES");
  linea(izq, "Sueldo base", L.sueldo_base);
  linea(izq, "Gratificación (Art. 50)", L.gratificacion);
  linea(izq, "Horas extra", L.horas_extra);
  linea(izq, "Bonos / comisiones", L.otros_imponibles);
  linea(izq, "Colación", L.colacion);
  linea(izq, "Movilización", L.movilizacion);
  linea(izq, "Asignación familiar", L.asignacion_familiar);
  linea(izq, "Otros no imponibles", L.otros_no_imponibles);
  total(izq, "Total haberes", L.total_haberes);
  const yFinHaberes = doc.y;

  // Descuentos
  doc.y = yTablas;
  seccion(der, "DESCUENTOS");
  linea(der, "AFP (10%)", L.cotizacion_afp);
  linea(der, "Comisión AFP", L.comision_afp);
  linea(der, "Salud (7%)", L.cotizacion_salud);
  linea(der, "Adicional Isapre", L.salud_adicional);
  linea(der, "Seguro cesantía (0,6%)", L.cotizacion_afc);
  linea(der, "Impuesto único", L.impuesto_unico);
  linea(der, "Otros descuentos", L.otros_descuentos);
  total(der, "Total descuentos", L.total_descuentos);
  const yFinDescuentos = doc.y;

  // --- Líquido a pagar ---
  doc.y = Math.max(yFinHaberes, yFinDescuentos) + 24;
  doc.rect(50, doc.y, 495, 34).fill(colorMarca);
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(13);
  doc.text("LÍQUIDO A PAGAR", 62, doc.y + 10, { continued: true });
  doc.text(monto(L.liquido_pagar), 0, doc.y + 10, { align: "right", width: 483 });
  doc.fillColor("#000").font("Helvetica").fontSize(8);
  doc.y += 46;

  // --- Bases + costo empresa (informativo) ---
  doc.fillColor("#666").fontSize(8).font("Helvetica");
  doc.text(
    `Base imponible: ${monto(L.base_imponible)}   ·   Base tributable: ${monto(L.base_tributable)}`,
    50
  );
  doc.text(
    `Costo empleador (informativo) — AFC: ${monto(L.aporte_afc_empleador)}   SIS: ${monto(L.aporte_sis)}   Mutual: ${monto(L.aporte_mutual)}`,
    50
  );
  doc.moveDown(1.5);
  doc.fontSize(8).fillColor("#999").text(
    "Documento generado por Bitácora. Cálculo según legislación laboral chilena vigente al período. " +
      "No constituye asesoría contable ni reemplaza la presentación ante Previred / Dirección del Trabajo.",
    50,
    doc.y,
    { width: 495 }
  );

  // --- Firmas ---
  doc.moveDown(3);
  const yFirmas = doc.y;
  doc.strokeColor("#000").moveTo(70, yFirmas).lineTo(240, yFirmas).stroke();
  doc.moveTo(320, yFirmas).lineTo(490, yFirmas).stroke();
  doc.fillColor("#000").fontSize(8).font("Helvetica");
  doc.text("Empleador", 70, yFirmas + 4, { width: 170, align: "center" });
  doc.text("Trabajador (recibí conforme)", 320, yFirmas + 4, { width: 170, align: "center" });

  doc.end();
  return listo;
}
