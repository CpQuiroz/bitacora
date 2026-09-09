// ============================================================
// BITÁCORA — PDF de una Orden de Servicio finalizada.
//
// pdfkit puro (sin Chromium/Puppeteer): genera el documento en
// memoria y lo devuelve como Buffer, listo para servir por HTTP
// o adjuntar a un correo (email.ts → enviarPdfOS).
//
// Nivel de detalle de informe de campo profesional: bloques en caja
// para datos del cliente / de la tarea / campos del tipo de trabajo,
// checklist con estado y hora, galería de fotos y bloque de firma.
// Todo el layout sale de helpers genéricos de pdfEstilo.ts.
// ============================================================
import PDFDocument from "pdfkit";
import { ANCHO, M_IZQ, PDF, abrirCaja, cajaGrilla, cajaLista, cerrarCaja, regla, tituloBarra, tituloSeccion } from "./pdfEstilo";

export type ItemOSPdf = {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
};

export type DatosOSPdf = {
  empresaNombre: string;
  empresaLogoUrl: string | null;
  colorPrimario: string | null;
  textoEncabezado: string | null;
  textoPie: string | null;
  folio: number | null;
  fecha: string;
  horaProgramada: string | null;
  clienteNombre: string;
  clienteRut: string | null;
  clienteTelefono: string | null;
  clienteCorreo: string | null;
  clienteDireccion: string | null;
  direccion: string | null; // ubicación del trabajo (fallback de dirección)
  colaboradorNombre: string;
  tipoTrabajoNombre: string | null;
  descripcion: string | null;
  camposPersonalizados: { etiqueta: string; valor: string }[];
  checklist: { item: string; hecho: boolean; hora: string | null }[];
  checkInAt: string | null;
  checkOutAt: string | null;
  observacionesCierre: string | null;
  informeIA: string | null;
  items: ItemOSPdf[];
  fotoUrls: string[];
  firmaUrl: string | null;
  firmanteNombre: string | null;
  firmanteDocumento: string | null;
};

const monto = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

// timestamptz → "DD-MM-AAAA HH:MM" en hora de Chile (el backend corre en
// UTC en Render; los usuarios son chilenos).
function fechaHora(iso: string | null): string | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  try {
    return dt.toLocaleString("es-CL", {
      timeZone: "America/Santiago",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

async function descargar(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function generarPdfOS(datos: DatosOSPdf): Promise<Buffer> {
  const [logoBuffer, firmaBuffer, ...fotoBuffers] = await Promise.all([
    datos.empresaLogoUrl ? descargar(datos.empresaLogoUrl) : Promise.resolve(null),
    datos.firmaUrl ? descargar(datos.firmaUrl) : Promise.resolve(null),
    ...datos.fotoUrls.map(descargar),
  ]);
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
  doc.fontSize(16).font("Helvetica-Bold").fillColor(colorMarca).text(datos.empresaNombre, logoBuffer ? 120 : 50, 50);
  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .fillColor(PDF.tinta)
    .text(`Orden de Servicio N° ${datos.folio ?? "—"}`, 300, 50, { align: "right" });
  regla(doc, 108, colorMarca, 2);
  doc.y = 120;

  if (datos.textoEncabezado) {
    doc.font("Helvetica").fontSize(9).fillColor(PDF.muted).text(datos.textoEncabezado, M_IZQ, doc.y, { width: ANCHO });
    doc.fillColor(PDF.tinta);
    doc.moveDown(0.8);
  }

  // --- Informaciones del cliente ---
  cajaGrilla(
    doc,
    "Informaciones del cliente",
    [
      { etiqueta: "Cliente", valor: datos.clienteNombre },
      { etiqueta: "RUT", valor: datos.clienteRut },
      { etiqueta: "Teléfono", valor: datos.clienteTelefono },
      { etiqueta: "Correo", valor: datos.clienteCorreo },
      { etiqueta: "Dirección", valor: datos.clienteDireccion ?? datos.direccion },
    ],
    colorMarca
  );

  // --- Datos de la tarea ---
  cajaGrilla(
    doc,
    `Tarea${datos.folio != null ? ` N° ${datos.folio}` : ""}`,
    [
      { etiqueta: "Fecha", valor: datos.fecha },
      { etiqueta: "Hora programada", valor: datos.horaProgramada },
      { etiqueta: "Tipo de trabajo", valor: datos.tipoTrabajoNombre },
      { etiqueta: "Realizado por", valor: datos.colaboradorNombre },
      { etiqueta: "Ubicación", valor: datos.direccion },
      { etiqueta: "Check-in", valor: fechaHora(datos.checkInAt) },
      { etiqueta: "Check-out", valor: fechaHora(datos.checkOutAt) },
    ],
    colorMarca
  );

  if (datos.descripcion) {
    tituloSeccion(doc, "Descripción del servicio", colorMarca, M_IZQ);
    doc.font("Helvetica").fontSize(10).fillColor(PDF.tinta).text(datos.descripcion, M_IZQ, doc.y, { width: ANCHO });
    doc.moveDown(1);
  }

  // --- Campos del tipo de trabajo (numerados, en grilla) ---
  if (datos.camposPersonalizados.length > 0) {
    cajaGrilla(doc, "Campos del tipo de trabajo", datos.camposPersonalizados, colorMarca, { numerada: true });
  }

  if (datos.observacionesCierre) {
    tituloSeccion(doc, "Observaciones de cierre", colorMarca, M_IZQ);
    doc.font("Helvetica").fontSize(10).fillColor(PDF.tinta).text(datos.observacionesCierre, M_IZQ, doc.y, { width: ANCHO });
    doc.moveDown(1);
  }
  if (datos.informeIA) {
    tituloSeccion(doc, "Informe técnico", colorMarca, M_IZQ);
    doc.font("Helvetica").fontSize(10).fillColor(PDF.tinta).text(datos.informeIA, M_IZQ, doc.y, { width: ANCHO });
    doc.moveDown(1);
  }

  // --- Tabla de ítems ---
  if (datos.items.length > 0) {
    if (doc.y > 680) doc.addPage();
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
    let total = 0;
    for (const item of datos.items) {
      const totalItem = item.cantidad * item.precio_unitario;
      total += totalItem;
      const filaY = doc.y;
      doc.text(item.descripcion, 50, filaY, { width: 245 });
      doc.text(String(item.cantidad), 300, filaY, { width: 60, align: "right" });
      doc.text(monto(item.precio_unitario), 365, filaY, { width: 80, align: "right" });
      doc.text(monto(totalItem), 450, filaY, { width: 95, align: "right" });
      doc.moveDown(0.6);
    }
    regla(doc, doc.y, PDF.regla);
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(11).text(`Total: ${monto(total)}`, 50, doc.y, { width: 495, align: "right" });
    doc.font("Helvetica").fontSize(10);
    doc.moveDown(1);
  }

  // --- Checklist ---
  if (datos.checklist.length > 0) {
    cajaLista(
      doc,
      "Checklist de la visita",
      datos.checklist.map((c) => ({
        texto: c.item,
        estado: c.hecho ? "ok" : "pendiente",
        nota: c.hora ? fechaHora(c.hora) ?? c.hora : null,
      })),
      colorMarca
    );
  }

  // --- Fotos ---
  const fotosValidas = fotoBuffers.filter((f): f is Buffer => f !== null);
  if (fotosValidas.length > 0) {
    if (doc.y > 620) doc.addPage();
    tituloBarra(doc, `Fotos (${fotosValidas.length})`, colorMarca);
    let x = 50;
    const anchoFoto = 155;
    for (const foto of fotosValidas) {
      if (x + anchoFoto > 545) {
        x = 50;
        doc.moveDown(0.5);
      }
      if (doc.y > 680) doc.addPage();
      try {
        doc.image(foto, x, doc.y, { width: anchoFoto, height: 110, fit: [anchoFoto, 110] });
      } catch {
        // foto corrupta o formato no soportado — se omite
      }
      x += anchoFoto + 15;
    }
    doc.y += 120;
    doc.moveDown(1);
  }

  // --- Firma del cliente ---
  bloqueFirma(doc, colorMarca, {
    titulo: "Firma de conformidad del cliente",
    imagen: firmaBuffer,
    nombre: datos.firmanteNombre,
    documento: datos.firmanteDocumento,
  });
  // Fase 2 (ver docs/pdf-os-fase2.md): acá va el segundo bloque, "Firma
  // del técnico", cuando ordenes_servicio tenga firma_tecnico_url.

  if (datos.textoPie) {
    doc.moveDown(1);
    doc.font("Helvetica").fontSize(8).fillColor(PDF.faint).text(datos.textoPie, M_IZQ, doc.y, { width: ANCHO });
    doc.fillColor(PDF.tinta);
  }

  doc.end();
  return listo;
}

// Bloque de firma en caja: título + imagen (o línea) + nombre + documento.
// Genérico — un bloque por firmante.
function bloqueFirma(
  doc: PDFKit.PDFDocument,
  colorMarca: string,
  f: { titulo: string; imagen: Buffer | null; nombre: string | null; documento: string | null }
): void {
  const ALTO_CONTENIDO = 96;
  const caja = abrirCaja(doc, f.titulo, colorMarca, ALTO_CONTENIDO);
  const y0 = doc.y;
  if (f.imagen) {
    try {
      doc.image(f.imagen, caja.x, y0, { width: 170, height: 60, fit: [170, 60] });
    } catch {
      /* firma corrupta — se omite */
    }
  }
  doc
    .moveTo(caja.x, y0 + 66)
    .lineTo(caja.x + 210, y0 + 66)
    .strokeColor(PDF.regla)
    .lineWidth(1)
    .stroke();
  doc.strokeColor(PDF.tinta);
  doc.font("Helvetica").fontSize(8.5).fillColor(PDF.tinta);
  doc.text(`Nombre: ${f.nombre || "—"}`, caja.x, y0 + 72, { width: caja.ancho });
  doc.text(`RUT / Documento: ${f.documento || "—"}`, caja.x, y0 + 83, { width: caja.ancho });
  cerrarCaja(doc, caja.yFin);
}
