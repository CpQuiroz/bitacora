// Paleta y helpers de tipografía para los PDF — alineados con el
// refresco "Faena" (1a) del web/móvil. pdfkit usa las fuentes base
// (Helvetica); el "look 1a" viene del color, las reglas finas y los
// encabezados de sección en mayúsculas espaciadas.

export const PDF = {
  marca: "#14314f", // azul tinta (fallback si la empresa no fijó color)
  tinta: "#101720", // texto principal
  muted: "#5c6672", // texto secundario
  faint: "#8b939d", // texto terciario / pies
  regla: "#d3d8dd", // líneas
  reglaSuave: "#eceef1",
};

type Doc = PDFKit.PDFDocument;

/** Título de sección: mayúsculas, espaciado, en el color de marca. */
export function tituloSeccion(doc: Doc, texto: string, colorMarca: string, x?: number) {
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor(colorMarca)
    .text(texto.toUpperCase(), x ?? doc.x, doc.y, { characterSpacing: 1.2 });
  doc.fillColor(PDF.tinta).font("Helvetica").fontSize(10);
  doc.moveDown(0.35);
}

/** Regla horizontal fina de margen a margen. */
export function regla(doc: Doc, y?: number, color = PDF.regla, ancho = 1) {
  const yy = y ?? doc.y;
  doc.moveTo(50, yy).lineTo(545, yy).strokeColor(color).lineWidth(ancho).stroke();
  doc.strokeColor(PDF.tinta).lineWidth(1);
}
