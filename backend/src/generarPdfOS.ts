// ============================================================
// BITÁCORA — PDF de una Orden de Servicio finalizada.
//
// pdfkit puro (sin Chromium/Puppeteer): genera el documento en
// memoria y lo devuelve como Buffer, listo para servir por HTTP
// o adjuntar a un correo (email.ts → enviarPdfOS).
// ============================================================
import PDFDocument from "pdfkit";

export type ItemOSPdf = {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
};

export type DatosOSPdf = {
  empresaNombre: string;
  empresaLogoUrl: string | null;
  colorPrimario: string | null;
  folio: number | null;
  fecha: string;
  horaProgramada: string | null;
  clienteNombre: string;
  direccion: string | null;
  colaboradorNombre: string;
  descripcion: string | null;
  observacionesCierre: string | null;
  items: ItemOSPdf[];
  fotoUrls: string[];
  firmaUrl: string | null;
  firmanteNombre: string | null;
  firmanteDocumento: string | null;
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

export async function generarPdfOS(datos: DatosOSPdf): Promise<Buffer> {
  const [logoBuffer, firmaBuffer, ...fotoBuffers] = await Promise.all([
    datos.empresaLogoUrl ? descargar(datos.empresaLogoUrl) : Promise.resolve(null),
    datos.firmaUrl ? descargar(datos.firmaUrl) : Promise.resolve(null),
    ...datos.fotoUrls.map(descargar),
  ]);
  const colorMarca = datos.colorPrimario ?? "#4338ca";

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
    .fillColor("#000000")
    .text(`Orden de Servicio N° ${datos.folio ?? "—"}`, 300, 50, { align: "right" });
  doc.moveTo(50, 108).lineTo(545, 108).strokeColor(colorMarca).lineWidth(2).stroke();
  doc.strokeColor("#000000").lineWidth(1);
  doc.y = 120;

  // --- Datos de la OS ---
  doc.fontSize(10).font("Helvetica");
  const filaDatos = (etiqueta: string, valor: string) => {
    doc.font("Helvetica-Bold").text(etiqueta, 50, doc.y, { continued: true, width: 150 });
    doc.font("Helvetica").text(` ${valor}`);
  };
  filaDatos("Fecha:", datos.fecha + (datos.horaProgramada ? ` ${datos.horaProgramada}` : ""));
  filaDatos("Cliente:", datos.clienteNombre);
  if (datos.direccion) filaDatos("Dirección:", datos.direccion);
  filaDatos("Colaborador:", datos.colaboradorNombre);
  doc.moveDown(1);

  if (datos.descripcion) {
    doc.font("Helvetica-Bold").text("Descripción del servicio:");
    doc.font("Helvetica").text(datos.descripcion, { width: 495 });
    doc.moveDown(1);
  }
  if (datos.observacionesCierre) {
    doc.font("Helvetica-Bold").text("Observaciones de cierre:");
    doc.font("Helvetica").text(datos.observacionesCierre, { width: 495 });
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
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").text(`Total: ${monto(total)}`, 50, doc.y, { width: 495, align: "right" });
    doc.moveDown(1);
  }

  // --- Fotos ---
  const fotosValidas = fotoBuffers.filter((f): f is Buffer => f !== null);
  if (fotosValidas.length > 0) {
    doc.font("Helvetica-Bold").fontSize(10).text("Fotos");
    doc.moveDown(0.3);
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

  // --- Firma ---
  if (doc.y > 650) doc.addPage();
  doc.font("Helvetica-Bold").fontSize(10).text("Firma de conformidad", 50, doc.y);
  doc.moveDown(0.3);
  if (firmaBuffer) {
    try {
      doc.image(firmaBuffer, 50, doc.y, { width: 180, height: 80, fit: [180, 80] });
      doc.y += 85;
    } catch {
      doc.y += 10;
    }
  }
  doc.font("Helvetica").fontSize(9);
  if (datos.firmanteNombre) doc.text(`Nombre: ${datos.firmanteNombre}`);
  if (datos.firmanteDocumento) doc.text(`RUT/Documento: ${datos.firmanteDocumento}`);

  doc.end();
  return listo;
}
