// ============================================================
// BITÁCORA — PDF de una Cotización. Mismo patrón que generarPdfOS.ts
// (pdfkit puro, en memoria, Buffer listo para servir por HTTP o
// adjuntar a un correo) — logo, color de marca, encabezado/pie de la
// plantilla configurable con variables ya sustituidas.
// ============================================================
import PDFDocument from "pdfkit";
import { PDF, regla, tituloSeccion } from "./pdfEstilo";

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
  const colorMarca = datos.colorPrimario ?? PDF.marca;

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
    .fillColor(PDF.tinta)
    .text(`Cotización N° ${datos.numero ?? "—"}`, 300, 50, { align: "right" });
  regla(doc, 108, colorMarca, 2);
  doc.y = 120;

  if (datos.textoEncabezado) {
    doc.font("Helvetica").fontSize(9).fillColor(PDF.muted).text(datos.textoEncabezado, { width: 495 });
    doc.fillColor(PDF.tinta);
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
    tituloSeccion(doc, "Descripción", colorMarca, 50);
    doc.font("Helvetica").text(datos.descripcion, { width: 495 });
    doc.moveDown(1);
  }

  // --- Tabla de ítems ---
  if (datos.items.length > 0) {
    doc.moveDown(0.5);
    const top = doc.y;
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(colorMarca);
    doc.text("DESCRIPCIÓN", 50, top, { width: 245, characterSpacing: 1 });
    doc.text("CANT.", 300, top, { width: 60, align: "right", characterSpacing: 1 });
    doc.text("P. UNITARIO", 365, top, { width: 80, align: "right", characterSpacing: 1 });
    doc.text("TOTAL", 450, top, { width: 95, align: "right", characterSpacing: 1 });
    regla(doc, top + 15, PDF.regla);
    doc.y = top + 20;

    doc.font("Helvetica").fontSize(10).fillColor(PDF.tinta);
    for (const item of datos.items) {
      const totalItem = item.cantidad * item.precio_unitario;
      const filaY = doc.y;
      doc.text(item.descripcion, 50, filaY, { width: 245 });
      doc.text(String(item.cantidad), 300, filaY, { width: 60, align: "right" });
      doc.text(monto(item.precio_unitario), 365, filaY, { width: 80, align: "right" });
      doc.text(monto(totalItem), 450, filaY, { width: 95, align: "right" });
      doc.moveDown(0.6);
    }
    regla(doc, doc.y, PDF.regla);
    doc.moveDown(0.4);

    doc.font("Helvetica").fontSize(9).fillColor(PDF.muted).text(`Subtotal: ${monto(datos.subtotal)}`, 50, doc.y, { width: 495, align: "right" });
    doc.text(`IVA (19%): ${monto(datos.iva)}`, { width: 495, align: "right" });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(PDF.tinta).text(`Total: ${monto(datos.total)}`, { width: 495, align: "right" });
    doc.moveDown(1);
  }

  if (datos.textoPie) {
    doc.moveDown(1.5);
    doc.font("Helvetica").fontSize(8).fillColor(PDF.faint).text(datos.textoPie, { width: 495 });
    doc.fillColor(PDF.tinta);
  }

  doc.end();
  return listo;
}
