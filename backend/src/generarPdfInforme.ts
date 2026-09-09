// ============================================================
// BITÁCORA — PDF de un informe con IA estructurado ya generado
// (guardado en informes_generados). Mismo patrón y estilo que
// generarPdfOS.ts: pdfkit puro, logo de la empresa, helpers de
// pdfEstilo.ts (secciones en caja, grillas de datos).
// ============================================================
import PDFDocument from "pdfkit";
import { ANCHO, M_IZQ, PDF, cajaGrilla, regla, tituloBarra, tituloSeccion } from "./pdfEstilo";

const TITULOS_TIPO: Record<string, string> = {
  financiero: "Informe financiero",
  operativo: "Informe operativo / OT",
  clientes: "Informe de clientes",
  colaboradores: "Informe de desempeño de colaboradores",
  personalizado: "Informe personalizado",
};

export type DatosInformePdf = {
  empresaNombre: string;
  empresaLogoUrl: string | null;
  colorPrimario: string | null;
  tipo: string;
  nombre?: string | null;
  desde: string;
  hasta: string;
  pregunta: string | null;
  resultado: string | null;
  datosAgregados: Record<string, unknown>;
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

function humanizar(clave: string): string {
  const s = clave.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function esPrimitivo(v: unknown): v is string | number | boolean {
  return v === null || ["string", "number", "boolean"].includes(typeof v);
}

function formatearPrimitivo(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("es-CL") : v.toLocaleString("es-CL", { maximumFractionDigits: 2 });
  return String(v);
}

// Renderiza un valor de `datosAgregados` (heterogéneo: objetos planos,
// objetos anidados, arrays de objetos, primitivos) como grillas y
// líneas. Profundidad acotada — no reproduce estructuras arbitrarias,
// solo las que produce agregarDatosInforme / agregarDatosSeccion.
function renderValor(doc: PDFKit.PDFDocument, valor: unknown, colorMarca: string, nivel: number): void {
  if (esPrimitivo(valor)) {
    doc.font("Helvetica").fontSize(9.5).fillColor(PDF.tinta).text(formatearPrimitivo(valor), M_IZQ, doc.y, { width: ANCHO });
    doc.moveDown(0.5);
    return;
  }

  if (Array.isArray(valor)) {
    if (valor.length === 0) {
      doc.font("Helvetica").fontSize(9).fillColor(PDF.faint).text("Sin registros en el período.", M_IZQ, doc.y, { width: ANCHO });
      doc.moveDown(0.5);
      return;
    }
    // Array de objetos → una grilla por fila (primeros 12).
    valor.slice(0, 12).forEach((fila) => {
      if (fila && typeof fila === "object" && !Array.isArray(fila)) {
        const pares = Object.entries(fila as Record<string, unknown>)
          .filter(([, v]) => esPrimitivo(v))
          .map(([k, v]) => ({ etiqueta: humanizar(k), valor: formatearPrimitivo(v) }));
        cajaGrilla(doc, null, pares, colorMarca, { columnas: 3 });
      } else {
        doc.font("Helvetica").fontSize(9).fillColor(PDF.tinta).text(`• ${formatearPrimitivo(fila)}`, M_IZQ, doc.y, { width: ANCHO });
        doc.moveDown(0.3);
      }
    });
    if (valor.length > 12) {
      doc.font("Helvetica-Oblique").fontSize(8).fillColor(PDF.faint).text(`… y ${valor.length - 12} más`, M_IZQ, doc.y, { width: ANCHO });
      doc.moveDown(0.5);
    }
    return;
  }

  // Objeto: separar primitivos (grilla) de sub-objetos (recursión).
  const entradas = Object.entries(valor as Record<string, unknown>);
  const primitivos = entradas.filter(([, v]) => esPrimitivo(v)).map(([k, v]) => ({ etiqueta: humanizar(k), valor: formatearPrimitivo(v) }));
  const compuestos = entradas.filter(([, v]) => !esPrimitivo(v));

  if (primitivos.length > 0) cajaGrilla(doc, null, primitivos, colorMarca, { columnas: 3 });

  if (nivel < 2) {
    for (const [k, v] of compuestos) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(PDF.muted).text(humanizar(k).toUpperCase(), M_IZQ, doc.y, { characterSpacing: 0.6, width: ANCHO });
      doc.moveDown(0.2);
      renderValor(doc, v, colorMarca, nivel + 1);
    }
  }
}

export async function generarPdfInforme(datos: DatosInformePdf): Promise<Buffer> {
  const logoBuffer = datos.empresaLogoUrl ? await descargar(datos.empresaLogoUrl) : null;
  const colorMarca = datos.colorPrimario ?? PDF.marca;

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const listo = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // --- Encabezado ---
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 50, 45, { width: 55, height: 55, fit: [55, 55] });
    } catch {
      /* logo corrupto — se omite */
    }
  }
  doc.fontSize(15).font("Helvetica-Bold").fillColor(colorMarca).text(datos.empresaNombre, logoBuffer ? 115 : 50, 50);
  doc
    .fontSize(19)
    .font("Helvetica-Bold")
    .fillColor(PDF.tinta)
    .text(datos.nombre || TITULOS_TIPO[datos.tipo] || "Informe", logoBuffer ? 115 : 50, 70, { width: 400 });
  doc.fontSize(9).font("Helvetica").fillColor(PDF.muted).text(`Período: ${datos.desde} a ${datos.hasta}`, logoBuffer ? 115 : 50, 96);
  regla(doc, 118, colorMarca, 2);
  doc.y = 132;

  if (datos.pregunta) {
    tituloSeccion(doc, "Pregunta", colorMarca, M_IZQ);
    doc.font("Helvetica").fontSize(10).fillColor(PDF.tinta).text(datos.pregunta, M_IZQ, doc.y, { width: ANCHO });
    doc.moveDown(1);
  }

  tituloSeccion(doc, "Resumen ejecutivo", colorMarca, M_IZQ);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(PDF.tinta)
    .text(datos.resultado ?? "No se pudo generar el resumen con IA para este informe.", M_IZQ, doc.y, { width: ANCHO });
  doc.moveDown(1.5);

  // --- Datos utilizados ---
  const secciones = Object.entries(datos.datosAgregados ?? {});
  if (secciones.length > 0) {
    tituloSeccion(doc, "Datos utilizados", colorMarca, M_IZQ);
    doc.moveDown(0.3);
    for (const [clave, valor] of secciones) {
      if (doc.y > 700) doc.addPage();
      tituloBarra(doc, humanizar(clave), colorMarca);
      renderValor(doc, valor, colorMarca, 0);
      doc.moveDown(0.6);
    }
  }

  doc.end();
  return listo;
}
