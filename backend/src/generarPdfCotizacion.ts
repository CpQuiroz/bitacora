// ============================================================
// BITÁCORA — PDF de una Cotización. Mismo patrón que generarPdfOS.ts
// (pdfkit puro, en memoria, Buffer listo para servir por HTTP o
// adjuntar a un correo) — logo, color de marca, encabezado/pie de la
// plantilla configurable con variables ya sustituidas.
// ============================================================
import PDFDocument from "pdfkit";

export type ItemCotizacionPdf = {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
};

export type DatosCotizacionPdf = {
  empresaNombre: string;
  empresaLogoUrl: string | null;
  colorPrimario: string | null;
  textoEncabezado: string | null;
  textoPie: string | null;
  numero: number | null;
  fecha: string;
  fechaVencimiento: string | null;
  clienteNombre: string;
  clienteDireccion: string | null;
  descripcion: string | null;
  items: ItemCotizacionPdf[];
  subtotal: number;
  iva: number;
  total: number;
  estado: string;
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

export async function generarPdfCotizacion(datos: DatosCotizacionPdf): Promise<Buffer> {
  const logoBuffer = datos.empresaLogoUrl ? await descargar(datos.empresaLogoUrl) : null;
  const colorMarca = datos.colorPrimario ?? "#4338ca";

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const listo = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // --- Encabezado: logo + datos de la empresa + número ---
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
    .fillColor("#000000")
    .text(`Cotización N° ${datos.numero ?? "—"}`, 300, 50, { align: "right" });
  doc.moveTo(50, 108).lineTo(545, 108).strokeColor(colorMarca).lineWidth(2).stroke();
  doc.strokeColor("#000000").lineWidth(1);
  doc.y = 120;

  if (datos.textoEncabezado) {
    doc.font("Helvetica").fontSize(9).fillColor("#555555").text(datos.textoEncabezado, { width: 495 });
    doc.fillColor("#000000");
    doc.moveDown(0.8);
  }

  // --- Datos de la cotización ---
  doc.fontSize(10).font("Helvetica");
  const filaDatos = (etiqueta: string, valor: string) => {
    doc.font("Helvetica-Bold").text(etiqueta, 50, doc.y, { continued: true, width: 150 });
    doc.font("Helvetica").text(` ${valor}`);
  };
  filaDatos("Fecha:", datos.fecha);
  if (datos.fechaVencimiento) filaDatos("Válida hasta:", datos.fechaVencimiento);
  filaDatos("Cliente:", datos.clienteNombre);
  if (datos.clienteDireccion) filaDatos("Dirección:", datos.clienteDireccion);
  doc.moveDown(1);

  if (datos.descripcion) {
    doc.font("Helvetica-Bold").text("Descripción:");
    doc.font("Helvetica").text(datos.descripcion, { width: 495 });
    doc.moveDown(1);
  }

  // --- Tabla de ítems ---
  if (datos.items.length > 0) {
    doc.moveDown(0.5);
    const top = doc.y;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(colorMarca);
    doc.text("Descripción", 50, top, { width: 245 });
    doc.text("Cant.", 300, top, { width: 60, align: "right" });
    doc.text("P. unitario", 365, top, { width: 80, align: "right" });
    doc.text("Total", 450, top, { width: 95, align: "right" });
    doc.moveTo(50, top + 15).lineTo(545, top + 15).strokeColor("#cccccc").stroke();
    doc.y = top + 20;

    doc.font("Helvetica").fontSize(10).fillColor("#000000");
    for (const item of datos.items) {
      const totalItem = item.cantidad * item.precio_unitario;
      const filaY = doc.y;
      doc.text(item.descripcion, 50, filaY, { width: 245 });
      doc.text(String(item.cantidad), 300, filaY, { width: 60, align: "right" });
      doc.text(monto(item.precio_unitario), 365, filaY, { width: 80, align: "right" });
      doc.text(monto(totalItem), 450, filaY, { width: 95, align: "right" });
      doc.moveDown(0.6);
    }
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
    doc.moveDown(0.4);

    doc.font("Helvetica").fontSize(9).text(`Subtotal: ${monto(datos.subtotal)}`, 50, doc.y, { width: 495, align: "right" });
    doc.text(`IVA (19%): ${monto(datos.iva)}`, { width: 495, align: "right" });
    doc.font("Helvetica-Bold").fontSize(11).text(`Total: ${monto(datos.total)}`, { width: 495, align: "right" });
    doc.moveDown(1);
  }

  if (datos.textoPie) {
    doc.moveDown(1.5);
    doc.font("Helvetica").fontSize(8).fillColor("#555555").text(datos.textoPie, { width: 495 });
    doc.fillColor("#000000");
  }

  doc.end();
  return listo;
}
