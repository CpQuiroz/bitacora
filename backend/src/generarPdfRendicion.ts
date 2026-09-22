// ============================================================
// BITÁCORA — PDF de una Rendición (fondo por rendir / caja chica).
// Mismo patrón que generarPdfCotizacion.ts: pdfkit puro, en memoria, se
// genera al vuelo (no se guarda un pdf_url como en Liquidaciones/
// Cotizaciones) porque una rendición sigue cambiando — gastos que se
// agregan/editan/quitan — hasta que se envía o aprueba; cachear un PDF
// fijo obligaría a invalidarlo en 5 endpoints distintos sin necesidad
// real (el volumen no lo justifica).
// ============================================================
import PDFDocument from "pdfkit";
import { ANCHO, M_IZQ, PDF, regla, tituloSeccion } from "./pdfEstilo";

export type ItemGastoRendicionPdf = {
  fecha: string;
  categoria: string;
  descripcion: string | null;
  proveedor: string | null;
  monto: number;
  tieneComprobante: boolean;
};

export type DatosRendicionPdf = {
  empresaNombre: string;
  empresaLogoUrl: string | null;
  colorPrimario: string | null;
  folioTexto: string;
  colaboradorNombre: string;
  periodoTexto: string; // "Diario" | "Semanal", ya traducido
  fechaInicio: string;
  fechaTermino: string;
  metodoEntregaTexto: string; // "Efectivo" | "Transferencia", ya traducido
  montoEntregado: number;
  items: ItemGastoRendicionPdf[];
  totalGastado: number;
  saldo: number;
  estadoTexto: string; // ya traducido
  aprobadorNombre: string | null;
  fechaAprobacion: string | null;
  motivoRechazo: string | null;
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

export async function generarPdfRendicion(datos: DatosRendicionPdf): Promise<Buffer> {
  const logoBuffer = datos.empresaLogoUrl ? await descargar(datos.empresaLogoUrl) : null;
  const colorMarca = datos.colorPrimario ?? PDF.marca;

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const listo = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // --- Encabezado: logo + datos de la empresa + folio ---
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 50, 45, { width: 60, height: 60, fit: [60, 60] });
    } catch {
      // logo corrupto o formato no soportado por pdfkit — se omite, no bloquea el PDF
    }
  }
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor(colorMarca)
    .text(datos.empresaNombre, logoBuffer ? 120 : 50, 50);
  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .fillColor(PDF.tinta)
    .text(`Rendición ${datos.folioTexto}`, 300, 50, { align: "right" });
  regla(doc, 108, colorMarca, 2);
  doc.y = 120;

  // --- Datos de la rendición ---
  doc.fontSize(10).font("Helvetica");
  const filaDatos = (etiqueta: string, valor: string) => {
    doc.font("Helvetica-Bold").text(etiqueta, 50, doc.y, { continued: true, width: 150 });
    doc.font("Helvetica").text(` ${valor}`);
  };
  filaDatos("Colaborador:", datos.colaboradorNombre);
  filaDatos("Período:", `${datos.periodoTexto} · ${datos.fechaInicio} a ${datos.fechaTermino}`);
  filaDatos("Método de entrega:", datos.metodoEntregaTexto);
  filaDatos("Monto entregado:", monto(datos.montoEntregado));
  filaDatos("Estado:", datos.estadoTexto);
  if (datos.aprobadorNombre && datos.fechaAprobacion) {
    filaDatos("Aprobada por:", `${datos.aprobadorNombre} · ${datos.fechaAprobacion}`);
  }
  doc.moveDown(1);

  if (datos.motivoRechazo) {
    doc.rect(50, doc.y, ANCHO, 40).fill(PDF.dangerSoft);
    doc
      .fillColor(PDF.danger)
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .text("MOTIVO DEL ÚLTIMO RECHAZO", 60, doc.y + 8, { characterSpacing: 1 });
    doc.font("Helvetica").fontSize(9.5).text(datos.motivoRechazo, 60, doc.y + 2, { width: ANCHO - 20 });
    doc.fillColor(PDF.tinta);
    doc.y += 50;
    doc.moveDown(0.5);
  }

  // --- Tabla de gastos ---
  tituloSeccion(doc, "Gastos incluidos", colorMarca, 50);
  doc.moveDown(0.3);

  if (datos.items.length === 0) {
    doc.font("Helvetica").fontSize(9.5).fillColor(PDF.faint).text("Todavía no se agregó ningún gasto.", 50, doc.y);
    doc.fillColor(PDF.tinta);
  } else {
    const top = doc.y;
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(colorMarca);
    doc.text("FECHA", 50, top, { width: 55, characterSpacing: 1 });
    doc.text("CATEGORÍA", 108, top, { width: 100, characterSpacing: 1 });
    doc.text("DESCRIPCIÓN", 211, top, { width: 145, characterSpacing: 1 });
    doc.text("COMPR.", 359, top, { width: 45, align: "center", characterSpacing: 1 });
    doc.text("MONTO", 450, top, { width: 95, align: "right", characterSpacing: 1 });
    regla(doc, top + 15, PDF.regla);
    doc.y = top + 20;

    doc.font("Helvetica").fontSize(9).fillColor(PDF.tinta);
    for (const item of datos.items) {
      const filaY = doc.y;
      doc.text(item.fecha, 50, filaY, { width: 55 });
      doc.text(item.categoria, 108, filaY, { width: 100 });
      doc.text([item.descripcion, item.proveedor].filter(Boolean).join(" · ") || "—", 211, filaY, { width: 145 });
      doc
        .fillColor(item.tieneComprobante ? PDF.ok : PDF.danger)
        .text(item.tieneComprobante ? "Sí" : "No", 359, filaY, { width: 45, align: "center" });
      doc.fillColor(PDF.tinta).text(monto(item.monto), 450, filaY, { width: 95, align: "right" });
      doc.moveDown(0.6);
    }
    regla(doc, doc.y, PDF.regla);
    doc.moveDown(0.4);

    doc.font("Helvetica").fontSize(9).fillColor(PDF.muted).text(`Gastado: ${monto(datos.totalGastado)}`, 50, doc.y, { width: 495, align: "right" });
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(datos.saldo < 0 ? PDF.danger : PDF.tinta)
      .text(`Saldo: ${monto(datos.saldo)}`, { width: 495, align: "right" });
    doc.moveDown(1);
  }

  doc.end();
  return listo;
}
