// ============================================================
// BITÁCORA — PDF de un Cobro generado desde viajes (tarea 134,
// 24-sep-2026). Mismo motor y estilo que generarPdfCotizacion.ts
// (pdfkit en memoria, logo, color de marca, encabezado/pie de la
// plantilla "cobranza"), en A4 horizontal para que entren las 9
// columnas del detalle: N° guía, fecha, chofer, cliente, origen,
// destino, neto, IVA y total. La tabla repite su encabezado si pasa
// de página.
// ============================================================
import PDFDocument from "pdfkit";
import type { BloqueEncabezado, ViajeDetalleCobro } from "@bitacora/shared";
import { PDF, bloquesEncabezado } from "./pdfEstilo";

export type DatosCobroPdf = {
  empresaNombre: string;
  empresaLogoUrl: string | null;
  colorPrimario: string | null;
  textoEncabezado: BloqueEncabezado[] | null;
  textoPie: string | null;
  folio: number | null;
  fechaEmision: string;
  fechaVencimiento: string | null;
  clienteNombre: string;
  clienteRut: string | null;
  clienteDireccion: string | null;
  periodoDesde: string | null;
  periodoHasta: string | null;
  filas: ViajeDetalleCobro[];
  totales: { neto: number; iva: number; total: number };
};

const monto = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const fechaCl = (iso: string | null) => (iso ? iso.split("-").reverse().join("-") : "—");

async function descargar(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// A4 horizontal: 842 × 595 pt, márgenes de 40.
const MARGEN = 40;
const ANCHO_PAGINA = 842;
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2; // 762
const LIMITE_Y = 595 - MARGEN - 20;

const COLUMNAS: { titulo: string; ancho: number; derecha?: boolean }[] = [
  { titulo: "N° GUÍA", ancho: 70 },
  { titulo: "FECHA", ancho: 62 },
  { titulo: "CHOFER", ancho: 100 },
  { titulo: "CLIENTE", ancho: 110 },
  { titulo: "ORIGEN", ancho: 95 },
  { titulo: "DESTINO", ancho: 95 },
  { titulo: "NETO", ancho: 75, derecha: true },
  { titulo: "IVA", ancho: 65, derecha: true },
  { titulo: "TOTAL", ancho: 90, derecha: true },
];

function reglaH(doc: PDFKit.PDFDocument, y: number, color: string, grosor = 0.6) {
  doc.save().moveTo(MARGEN, y).lineTo(MARGEN + ANCHO_UTIL, y).lineWidth(grosor).strokeColor(color).stroke().restore();
}

function encabezadoTabla(doc: PDFKit.PDFDocument, colorMarca: string): void {
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(colorMarca);
  let x = MARGEN;
  for (const c of COLUMNAS) {
    doc.text(c.titulo, x, y, { width: c.ancho - 4, align: c.derecha ? "right" : "left", characterSpacing: 0.8, lineBreak: false });
    x += c.ancho;
  }
  reglaH(doc, y + 13, PDF.regla);
  doc.y = y + 18;
}

export async function generarPdfCobro(datos: DatosCobroPdf): Promise<Buffer> {
  const logoBuffer = datos.empresaLogoUrl ? await descargar(datos.empresaLogoUrl) : null;
  const colorMarca = datos.colorPrimario ?? PDF.marca;

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: MARGEN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const listo = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // --- Encabezado: logo + empresa + N° de cobro ---
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, MARGEN, 35, { fit: [55, 55] });
    } catch {
      // logo corrupto o formato no soportado — se omite, no bloquea el PDF
    }
  }
  doc.font("Helvetica-Bold").fontSize(15).fillColor(colorMarca).text(datos.empresaNombre, logoBuffer ? MARGEN + 65 : MARGEN, 42, { width: 420 });
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(PDF.tinta)
    .text(`Cobro N° ${datos.folio ?? "—"}`, MARGEN, 40, { width: ANCHO_UTIL, align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor(PDF.muted).text(`Emitido el ${fechaCl(datos.fechaEmision)}`, MARGEN, 64, { width: ANCHO_UTIL, align: "right" });
  reglaH(doc, 98, colorMarca, 2);
  doc.y = 108;

  if (datos.textoEncabezado && datos.textoEncabezado.length > 0) {
    bloquesEncabezado(doc, datos.textoEncabezado, MARGEN, ANCHO_UTIL);
    doc.fillColor(PDF.tinta);
    doc.moveDown(0.5);
  }

  // --- Cliente y período (dos columnas) ---
  const yDatos = doc.y;
  const fila = (etiqueta: string, valor: string, x: number, y: number) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(PDF.tinta).text(etiqueta, x, y, { continued: true });
    doc.font("Helvetica").text(` ${valor}`);
  };
  fila("Cliente:", datos.clienteNombre, MARGEN, yDatos);
  if (datos.clienteRut) fila("RUT:", datos.clienteRut, MARGEN, doc.y + 2);
  if (datos.clienteDireccion) fila("Dirección:", datos.clienteDireccion, MARGEN, doc.y + 2);
  const yFinIzq = doc.y;
  fila("Período:", `${fechaCl(datos.periodoDesde)} al ${fechaCl(datos.periodoHasta)}`, 470, yDatos);
  if (datos.fechaVencimiento) fila("Vencimiento:", fechaCl(datos.fechaVencimiento), 470, doc.y + 2);
  fila("Viajes:", String(datos.filas.length), 470, doc.y + 2);
  doc.y = Math.max(yFinIzq, doc.y) + 14;

  // --- Tabla de detalle ---
  encabezadoTabla(doc, colorMarca);
  doc.font("Helvetica").fontSize(8.5).fillColor(PDF.tinta);
  for (const f of datos.filas) {
    if (doc.y > LIMITE_Y) {
      doc.addPage({ size: "A4", layout: "landscape", margin: MARGEN });
      doc.y = MARGEN;
      encabezadoTabla(doc, colorMarca);
      doc.font("Helvetica").fontSize(8.5).fillColor(PDF.tinta);
    }
    const valores = [
      f.numero_guia,
      fechaCl(f.fecha),
      f.chofer ?? "—",
      f.cliente,
      f.origen,
      // Tarea 135: paradas intermedias y km bajo el destino.
      [f.destino, f.via.length ? `vía ${f.via.join(", ")}` : "", f.km != null ? `${f.km.toLocaleString("es-CL")} km` : ""].filter(Boolean).join("\n"),
      monto(f.neto),
      monto(f.iva),
      monto(f.total),
    ];
    const y = doc.y;
    let x = MARGEN;
    let alto = 0;
    COLUMNAS.forEach((c, i) => {
      const texto = valores[i]!;
      const h = doc.heightOfString(texto, { width: c.ancho - 4 });
      alto = Math.max(alto, h);
      doc.text(texto, x, y, { width: c.ancho - 4, align: c.derecha ? "right" : "left" });
      x += c.ancho;
    });
    doc.y = y + alto + 4;
    reglaH(doc, doc.y - 2, PDF.reglaSuave, 0.4);
  }

  // --- Totales ---
  if (doc.y > LIMITE_Y - 50) {
    doc.addPage({ size: "A4", layout: "landscape", margin: MARGEN });
    doc.y = MARGEN;
  }
  reglaH(doc, doc.y + 2, PDF.regla);
  doc.y += 8;
  const xTot = MARGEN + ANCHO_UTIL - 260;
  const filaTotal = (etiqueta: string, valor: string, negrita = false) => {
    const y = doc.y;
    doc.font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(negrita ? 11 : 9.5).fillColor(negrita ? PDF.tinta : PDF.muted);
    doc.text(etiqueta, xTot, y, { width: 150, align: "right" });
    doc.text(valor, xTot + 160, y, { width: 100, align: "right" });
    doc.y = y + (negrita ? 16 : 13);
  };
  filaTotal("Neto:", monto(datos.totales.neto));
  filaTotal("IVA (19%):", monto(datos.totales.iva));
  filaTotal("Total:", monto(datos.totales.total), true);

  if (datos.textoPie) {
    doc.moveDown(1.2);
    doc.font("Helvetica").fontSize(8).fillColor(PDF.faint).text(datos.textoPie, MARGEN, doc.y, { width: ANCHO_UTIL });
    doc.fillColor(PDF.tinta);
  }

  doc.end();
  return listo;
}
