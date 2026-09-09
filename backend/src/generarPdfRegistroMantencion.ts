// ============================================================
// BITÁCORA — PDF de un registro de mantención de flota.
//
// pdfkit puro, mismo motor y estilo que generarPdfOS. Documento de una
// página tamaño carta, pensado para imprimirse y archivarse: cabecera,
// bloque de identificación en 2 columnas, checklist en 2 columnas por
// sección (los NO destacados), observaciones, fotos y línea de firma.
// Se genera una vez al crear el registro (inmutable) y se cachea.
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
  folio: string;
  tipo: "diario" | "programa";
  origen: "interno" | "externo";
  fecha: string; // YYYY-MM-DD
  generadoEn: string; // ISO
  vehiculoPatente: string | null;
  vehiculoNombre: string;
  vehiculoTipo: string | null;
  vehiculoDescripcion: string | null;
  realizadoPor: string | null; // nombre de la persona o del taller
  kilometraje: number | null;
  horasMotor: number | null;
  observaciones: string | null;
  secciones: SeccionChecklistPdf[];
  fotos: { url: string; item: string | null }[];
  firmaUrl: string | null;
};

const RESPUESTA_TEXTO: Record<RespuestaChecklistMantencion, string> = { si: "SÍ", no: "NO", na: "N/A" };

async function descargar(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

const numero = (n: number | null, sufijo = "") => (n === null ? "—" : `${n.toLocaleString("es-CL")}${sufijo}`);

function fechaCL(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}
function fechaHoraCL(iso: string): string {
  const dt = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(dt.getDate())}-${p(dt.getMonth() + 1)}-${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export async function generarPdfRegistroMantencion(datos: DatosRegistroMantencionPdf): Promise<Buffer> {
  const [logoBuffer, firmaBuffer, ...fotoBuffers] = await Promise.all([
    datos.empresaLogoUrl ? descargar(datos.empresaLogoUrl) : Promise.resolve(null),
    datos.firmaUrl ? descargar(datos.firmaUrl) : Promise.resolve(null),
    ...datos.fotos.map((f) => descargar(f.url)),
  ]);
  const colorMarca = datos.colorPrimario ?? PDF.marca;
  const titulo = "Registro de mantención";
  const subtitulo = datos.tipo === "diario" ? "Chequeo diario" : "Programa de mantención";

  const doc = new PDFDocument({ size: "LETTER", margin: 46 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const listo = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const L = 46;
  const R = 566; // LETTER = 612pt, margen 46
  const MID = 306;

  // ---- Cabecera ----
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, L, 40, { width: 54, height: 54, fit: [54, 54] });
    } catch {
      /* logo corrupto */
    }
  }
  doc.font("Helvetica-Bold").fontSize(15).fillColor(colorMarca).text(datos.empresaNombre, logoBuffer ? L + 66 : L, 46);
  doc.font("Helvetica-Bold").fontSize(16).fillColor(PDF.tinta).text(titulo, MID, 44, { width: R - MID, align: "right" });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(PDF.muted)
    .text(`Folio N° ${datos.folio}   ·   ${fechaCL(datos.fecha)}   ·   ${subtitulo}`, MID, 64, { width: R - MID, align: "right" });
  regla(doc, 100, colorMarca, 2);
  doc.y = 112;

  // ---- Bloque de identificación (2 columnas) ----
  tituloSeccion(doc, "Identificación", colorMarca, L);
  const filasId: [string, string][] = [
    ["Patente", datos.vehiculoPatente ?? "—"],
    ["Marca / modelo", datos.vehiculoDescripcion ?? datos.vehiculoNombre],
    ["Tipo de vehículo", datos.vehiculoTipo ?? "—"],
    ["Kilometraje", numero(datos.kilometraje, " km")],
    ["Horas motor", numero(datos.horasMotor, " h")],
    ["Tipo de registro", subtitulo],
    ["Origen", datos.origen === "interno" ? "Interno" : "Taller / lubricentro externo"],
    [datos.origen === "interno" ? "Realizado por" : "Taller", datos.realizadoPor ?? "—"],
  ];
  doc.fontSize(10).fillColor(PDF.tinta);
  const colY = doc.y;
  filasId.forEach(([etiqueta, valor], i) => {
    const x = i % 2 === 0 ? L : MID + 6;
    const y = colY + Math.floor(i / 2) * 30;
    doc.font("Helvetica").fontSize(7.5).fillColor(PDF.faint).text(etiqueta.toUpperCase(), x, y, { characterSpacing: 0.5, width: 240 });
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(PDF.tinta).text(valor, x, y + 10, { width: 240 });
  });
  doc.y = colY + Math.ceil(filasId.length / 2) * 30 + 10;

  // ---- Checklist en 2 columnas por sección ----
  const conNovedad = datos.secciones.some((s) => s.items.some((i) => i.respuesta === "no"));
  tituloSeccion(doc, "Checklist", colorMarca, L);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(conNovedad ? PDF.danger : PDF.ok);
  doc.text(conNovedad ? "CON NOVEDADES" : "SIN NOVEDADES", MID, doc.y - 12, { width: R - MID, align: "right" });
  doc.fillColor(PDF.tinta);

  let colIzq = doc.y + 4;
  let colDer = doc.y + 4;
  const colW = (R - L) / 2 - 8;

  const dibujarSeccion = (sec: SeccionChecklistPdf, x: number, y: number): number => {
    let cursor = y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(colorMarca).text(sec.nombre.toUpperCase(), x, cursor, { width: colW, characterSpacing: 0.4 });
    cursor += 14;
    for (const it of sec.items) {
      const esNo = it.respuesta === "no";
      if (esNo) {
        doc.rect(x - 2, cursor - 1.5, colW + 4, 13).fill(PDF.dangerSoft);
        doc.fillColor(PDF.danger);
      } else {
        doc.fillColor(PDF.tinta);
      }
      doc.font("Helvetica").fontSize(8.5).text(it.item, x, cursor, { width: colW - 34 });
      doc.font("Helvetica-Bold").fontSize(8.5).text(RESPUESTA_TEXTO[it.respuesta], x + colW - 30, cursor, { width: 30, align: "right" });
      doc.fillColor(PDF.tinta);
      cursor += 13;
    }
    return cursor + 8;
  };

  datos.secciones.forEach((sec, i) => {
    if (i % 2 === 0) {
      colIzq = dibujarSeccion(sec, L, colIzq);
    } else {
      colDer = dibujarSeccion(sec, MID + 6, colDer);
    }
  });
  doc.y = Math.max(colIzq, colDer) + 4;

  // ---- Observaciones ----
  if (datos.observaciones) {
    if (doc.y > 640) doc.addPage();
    tituloSeccion(doc, "Observaciones", colorMarca, L);
    doc.font("Helvetica").fontSize(10).fillColor(PDF.tinta).text(datos.observaciones, L, doc.y, { width: R - L });
    doc.moveDown(0.8);
  }

  // ---- Fotos ----
  const fotosValidas = fotoBuffers
    .map((buf, i) => ({ buf, item: datos.fotos[i]?.item ?? null }))
    .filter((f): f is { buf: Buffer; item: string | null } => f.buf !== null);
  if (fotosValidas.length > 0) {
    if (doc.y > 560) doc.addPage();
    tituloSeccion(doc, "Fotos de respaldo", colorMarca, L);
    let x = L;
    const w = 158;
    let filaY = doc.y;
    for (const foto of fotosValidas.slice(0, 6)) {
      if (x + w > R) {
        x = L;
        filaY += 108;
      }
      if (filaY > 690) {
        doc.addPage();
        filaY = doc.y;
      }
      try {
        doc.image(foto.buf, x, filaY, { width: w, height: 88, fit: [w, 88] });
      } catch {
        /* foto corrupta */
      }
      doc.font("Helvetica").fontSize(7).fillColor(PDF.muted).text(foto.item ?? "General", x, filaY + 90, { width: w });
      doc.fillColor(PDF.tinta);
      x += w + 8;
    }
    doc.y = filaY + 108;
  }

  // ---- Firma ----
  if (doc.y > 660) doc.addPage();
  doc.moveDown(0.5);
  tituloSeccion(doc, "Firma del responsable", colorMarca, L);
  if (datos.tipo === "programa" && firmaBuffer) {
    try {
      doc.image(firmaBuffer, L, doc.y, { width: 170, height: 66, fit: [170, 66] });
      doc.y += 70;
    } catch {
      doc.y += 8;
    }
  }
  doc.moveTo(L, doc.y + 18).lineTo(L + 240, doc.y + 18).strokeColor(PDF.regla).lineWidth(1).stroke();
  doc.font("Helvetica").fontSize(8.5).fillColor(PDF.tinta).text(datos.realizadoPor ?? "", L, doc.y + 22, { width: 240 });

  // ---- Pie ----
  doc.font("Helvetica").fontSize(7.5).fillColor(PDF.faint);
  doc.text(`Generado por Bitácora · ${fechaHoraCL(datos.generadoEn)}`, L, 748, { width: R - L, align: "center" });
  if (datos.textoPie) doc.text(datos.textoPie, L, 736, { width: R - L, align: "center" });

  doc.end();
  return listo;
}
