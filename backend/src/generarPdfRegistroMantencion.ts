// ============================================================
// BITÁCORA — PDF de un registro de mantención de flota.
//
// pdfkit puro, mismo motor y estilo que generarPdfOS. Se genera una
// vez al crear el registro (los registros son inmutables) y se cachea
// en registros_mantencion_equipo.pdf_url.
// ============================================================
import PDFDocument from "pdfkit";
import type { RespuestaChecklistMantencion } from "@bitacora/shared";
import { PDF, regla, tituloSeccion } from "./pdfEstilo";

export type SeccionChecklistPdf = {
  nombre: string;
  items: { item: string; respuesta: RespuestaChecklistMantencion }[];
};

export type DatosRegistroMantencionPdf = {
  empresaNombre: string;
  empresaLogoUrl: string | null;
  colorPrimario: string | null;
  textoPie: string | null;
  tipo: "diario" | "programa";
  origen: "interno" | "externo";
  fecha: string;
  vehiculoPatente: string | null;
  vehiculoNombre: string;
  vehiculoDescripcion: string | null;
  realizadoPor: string | null; // nombre de la persona o del taller
  kilometraje: number | null;
  horasMotor: number | null;
  observaciones: string | null;
  secciones: SeccionChecklistPdf[];
  fotoUrls: string[];
  firmaUrl: string | null;
};

const RESPUESTA_TEXTO: Record<RespuestaChecklistMantencion, string> = {
  si: "Sí",
  no: "No",
  na: "N/A",
};

async function descargar(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

const numero = (n: number | null) => (n === null ? "—" : n.toLocaleString("es-CL"));

export async function generarPdfRegistroMantencion(datos: DatosRegistroMantencionPdf): Promise<Buffer> {
  const [logoBuffer, firmaBuffer, ...fotoBuffers] = await Promise.all([
    datos.empresaLogoUrl ? descargar(datos.empresaLogoUrl) : Promise.resolve(null),
    datos.firmaUrl ? descargar(datos.firmaUrl) : Promise.resolve(null),
    ...datos.fotoUrls.map(descargar),
  ]);
  const colorMarca = datos.colorPrimario ?? PDF.marca;
  const titulo = datos.tipo === "diario" ? "Chequeo diario de vehículo" : "Programa de mantención";

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const listo = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // --- Encabezado ---
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 50, 45, { width: 60, height: 60, fit: [60, 60] });
    } catch {
      /* logo corrupto — se omite */
    }
  }
  doc.fontSize(16).font("Helvetica-Bold").fillColor(colorMarca).text(datos.empresaNombre, logoBuffer ? 120 : 50, 50);
  doc.fontSize(18).font("Helvetica-Bold").fillColor(PDF.tinta).text(titulo, 260, 52, { width: 285, align: "right" });
  regla(doc, 108, colorMarca, 2);
  doc.y = 120;

  // --- Datos del registro ---
  doc.fontSize(10).font("Helvetica").fillColor(PDF.tinta);
  const fila = (etiqueta: string, valor: string) => {
    doc.font("Helvetica-Bold").text(etiqueta, 50, doc.y, { continued: true, width: 170 });
    doc.font("Helvetica").text(` ${valor}`);
  };
  fila("Fecha:", datos.fecha);
  fila("Vehículo:", [datos.vehiculoPatente, datos.vehiculoNombre].filter(Boolean).join(" · "));
  if (datos.vehiculoDescripcion) fila("Detalle:", datos.vehiculoDescripcion);
  fila("Origen:", datos.origen === "interno" ? "Interno" : "Taller / lubricentro externo");
  if (datos.realizadoPor) fila(datos.origen === "interno" ? "Realizado por:" : "Taller:", datos.realizadoPor);
  fila("Kilometraje:", numero(datos.kilometraje));
  fila("Horas motor:", numero(datos.horasMotor));
  doc.moveDown(1);

  // --- Checklist por sección ---
  for (const seccion of datos.secciones) {
    if (doc.y > 700) doc.addPage();
    tituloSeccion(doc, seccion.nombre, colorMarca, 50);
    doc.font("Helvetica").fontSize(10).fillColor(PDF.tinta);
    for (const it of seccion.items) {
      if (doc.y > 770) doc.addPage();
      const filaY = doc.y;
      doc.text(it.item, 50, filaY, { width: 420 });
      doc.font("Helvetica-Bold").text(RESPUESTA_TEXTO[it.respuesta], 470, filaY, { width: 75, align: "right" });
      doc.font("Helvetica");
      doc.moveDown(0.45);
    }
    doc.moveDown(0.6);
  }

  const conNovedad = datos.secciones.some((s) => s.items.some((i) => i.respuesta === "no"));
  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(conNovedad ? PDF.marca : PDF.tinta);
  doc.text(conNovedad ? "Estado: CON NOVEDADES" : "Estado: sin novedades", 50, doc.y, { width: 495 });
  doc.font("Helvetica").fillColor(PDF.tinta);
  doc.moveDown(1);

  if (datos.observaciones) {
    if (doc.y > 680) doc.addPage();
    tituloSeccion(doc, "Observaciones", colorMarca, 50);
    doc.font("Helvetica").text(datos.observaciones, { width: 495 });
    doc.moveDown(1);
  }

  // --- Fotos ---
  const fotosValidas = fotoBuffers.filter((f): f is Buffer => f !== null);
  if (fotosValidas.length > 0) {
    if (doc.y > 560) doc.addPage();
    tituloSeccion(doc, "Fotos de respaldo", colorMarca, 50);
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
        /* foto corrupta — se omite */
      }
      x += anchoFoto + 15;
    }
    doc.y += 120;
    doc.moveDown(1);
  }

  // --- Firma (solo 'programa') ---
  if (datos.tipo === "programa") {
    if (doc.y > 650) doc.addPage();
    tituloSeccion(doc, "Firma del responsable", colorMarca, 50);
    if (firmaBuffer) {
      try {
        doc.image(firmaBuffer, 50, doc.y, { width: 180, height: 80, fit: [180, 80] });
        doc.y += 85;
      } catch {
        doc.y += 10;
      }
    }
    doc.font("Helvetica").fontSize(9);
    if (datos.realizadoPor) doc.text(`Nombre: ${datos.realizadoPor}`);
  }

  if (datos.textoPie) {
    doc.moveDown(1.5);
    doc.font("Helvetica").fontSize(8).fillColor(PDF.faint).text(datos.textoPie, { width: 495 });
    doc.fillColor(PDF.tinta);
  }

  doc.end();
  return listo;
}
