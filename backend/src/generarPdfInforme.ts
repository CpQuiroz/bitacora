// ============================================================
// BITÁCORA — PDF de un informe con IA estructurado ya generado
// (guardado en informes_generados). Mismo patrón que
// generarPdfOS.ts: pdfkit puro, logo de la empresa, en memoria.
// ============================================================
import PDFDocument from "pdfkit";

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

export async function generarPdfInforme(datos: DatosInformePdf): Promise<Buffer> {
  const logoBuffer = datos.empresaLogoUrl ? await descargar(datos.empresaLogoUrl) : null;
  const colorMarca = datos.colorPrimario ?? "#4338ca";

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const listo = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 50, 45, { width: 50, height: 50, fit: [50, 50] });
    } catch {
      // logo corrupto o formato no soportado — se omite
    }
  }
  doc.fontSize(14).font("Helvetica-Bold").fillColor(colorMarca).text(datos.empresaNombre, logoBuffer ? 110 : 50, 50);
  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text(datos.nombre || TITULOS_TIPO[datos.tipo] || "Informe", logoBuffer ? 110 : 50, 70);
  doc.fontSize(10).font("Helvetica").fillColor("#666666").text(`Período: ${datos.desde} a ${datos.hasta}`, logoBuffer ? 110 : 50, 95);
  doc.moveTo(50, 120).lineTo(545, 120).strokeColor(colorMarca).lineWidth(2).stroke();
  doc.fillColor("#000000").strokeColor("#000000").lineWidth(1);
  doc.y = 132;

  if (datos.pregunta) {
    doc.font("Helvetica-Bold").fontSize(10).text("Pregunta");
    doc.font("Helvetica").text(datos.pregunta, { width: 495 });
    doc.moveDown(1);
  }

  doc.font("Helvetica-Bold").fontSize(12).fillColor(colorMarca).text("Resumen ejecutivo");
  doc.fillColor("#000000");
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).text(datos.resultado ?? "No se pudo generar el resumen con IA para este informe.", {
    width: 495,
  });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold").fontSize(12).fillColor(colorMarca).text("Datos utilizados");
  doc.fillColor("#000000");
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(8).text(JSON.stringify(datos.datosAgregados, null, 2), { width: 495 });

  doc.end();
  return listo;
}
