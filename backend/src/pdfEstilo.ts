// Paleta y helpers de tipografía / layout para los PDF — alineados con
// el refresco "Faena" (1a) del web/móvil. pdfkit usa las fuentes base
// (Helvetica); el "look 1a" viene del color, las reglas finas, los
// encabezados de sección en mayúsculas espaciadas y las cajas con fondo
// gris claro para los bloques de datos.
//
// Todos los helpers son genéricos: sirven para el PDF de OS, de
// cotización, de informe y de liquidación. Nada específico de un
// documento vive acá.

export const PDF = {
  marca: "#14314f", // azul tinta (fallback si la empresa no fijó color)
  tinta: "#101720", // texto principal
  muted: "#5c6672", // texto secundario
  faint: "#8b939d", // texto terciario / pies / etiquetas
  regla: "#d3d8dd", // líneas / bordes de caja
  reglaSuave: "#eceef1",
  cajaFondo: "#f4f6f8", // fondo de las cajas de datos
  ok: "#14663c", // estado "sin novedades" / respuesta SÍ / ítem hecho
  okSoft: "#e7f2eb",
  danger: "#a02020", // estado "con novedades" / respuesta NO
  dangerSoft: "#fbeaea",
};

type Doc = PDFKit.PDFDocument;

// Márgenes del cuerpo (A4, margin 50).
export const M_IZQ = 50;
export const M_DER = 545;
export const ANCHO = M_DER - M_IZQ; // 495

export type FilaDato = { etiqueta: string; valor: string | number | null | undefined };

/** Título de sección "a secas": mayúsculas, espaciado, en el color de
 *  marca. Para secciones de prosa (descripción, observaciones). */
export function tituloSeccion(doc: Doc, texto: string, colorMarca: string, x?: number) {
  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor(colorMarca)
    .text(texto.toUpperCase(), x ?? doc.x, doc.y, { characterSpacing: 1.2 });
  doc.fillColor(PDF.tinta).font("Helvetica").fontSize(10);
  doc.moveDown(0.35);
}

/** Barra de título de sección: rectángulo gris fino con el título en el
 *  color de marca. Para encabezar una galería/tabla sin encajonar todo
 *  el contenido (ej. "Fotos"). Avanza el cursor debajo de la barra. */
export function tituloBarra(doc: Doc, texto: string, colorMarca: string, x = M_IZQ, ancho = ANCHO) {
  const y = doc.y;
  doc.save();
  doc.rect(x, y, ancho, 18).fill(PDF.reglaSuave);
  doc.restore();
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(colorMarca)
    .text(texto.toUpperCase(), x + 8, y + 5.5, { characterSpacing: 1, width: ancho - 16, lineBreak: false });
  doc.fillColor(PDF.tinta).font("Helvetica").fontSize(10);
  doc.y = y + 18 + 6;
  doc.x = x;
}

/** Regla horizontal fina de margen a margen. */
export function regla(doc: Doc, y?: number, color = PDF.regla, ancho = 1) {
  const yy = y ?? doc.y;
  doc.moveTo(M_IZQ, yy).lineTo(M_DER, yy).strokeColor(color).lineWidth(ancho).stroke();
  doc.strokeColor(PDF.tinta).lineWidth(1);
}

const ALTO_FILA_GRILLA = 30;

function filasConValor(filas: FilaDato[]): { etiqueta: string; valor: string }[] {
  return filas
    .map((f) => ({ etiqueta: f.etiqueta, valor: f.valor == null ? "" : String(f.valor).trim() }))
    .filter((f) => f.valor !== "" && f.valor !== "—");
}

/** Altura que ocupará una grilla de `n` valores en `columnas` columnas. */
export function altoDeGrilla(n: number, columnas = 2): number {
  return Math.ceil(Math.max(n, 1) / columnas) * ALTO_FILA_GRILLA;
}

/** Grilla etiqueta/valor en 2–3 columnas (etiqueta chica arriba, valor
 *  en negrita debajo). `numerada` antepone "N." a cada etiqueta. Filtra
 *  los valores vacíos. NO dibuja caja — usar dentro de `abrirCaja` o
 *  suelta. Avanza el cursor al final de la grilla. */
export function grillaDatos(
  doc: Doc,
  filas: FilaDato[],
  { x = M_IZQ, ancho = ANCHO, columnas = 2, numerada = false }: { x?: number; ancho?: number; columnas?: number; numerada?: boolean } = {}
): void {
  const vis = filasConValor(filas);
  if (vis.length === 0) return;
  const colW = ancho / columnas;
  const y0 = doc.y;
  vis.forEach((f, i) => {
    const cx = x + (i % columnas) * colW;
    const cy = y0 + Math.floor(i / columnas) * ALTO_FILA_GRILLA;
    const etq = numerada ? `${i + 1}.  ${f.etiqueta}` : f.etiqueta;
    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor(PDF.faint)
      .text(etq.toUpperCase(), cx, cy, { width: colW - 10, characterSpacing: 0.3, lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(PDF.tinta)
      .text(f.valor, cx, cy + 9, { width: colW - 10, lineBreak: false, ellipsis: true });
  });
  doc.y = y0 + altoDeGrilla(vis.length, columnas);
  doc.fillColor(PDF.tinta).font("Helvetica").fontSize(10);
}

/** Abre una "caja" (fondo gris + borde + barra de título opcional). El
 *  caller pasa la altura del contenido (usar altoDeGrilla / medir). Deja
 *  el cursor en el inicio del área de contenido y devuelve su x/ancho y
 *  la y final de la caja. Hace salto de página si no entra. */
export function abrirCaja(
  doc: Doc,
  titulo: string | null,
  colorMarca: string,
  altoContenido: number,
  { x = M_IZQ, ancho = ANCHO }: { x?: number; ancho?: number } = {}
): { x: number; ancho: number; yFin: number } {
  const BARRA = titulo ? 20 : 0;
  const PAD = 10;
  const alto = BARRA + PAD + altoContenido + PAD;
  const limiteInferior = doc.page.height - doc.page.margins.bottom;
  if (doc.y + alto > limiteInferior) doc.addPage();
  const y = doc.y;

  doc.save();
  doc.roundedRect(x, y, ancho, alto, 3).fillAndStroke(PDF.cajaFondo, PDF.regla);
  doc.restore();

  if (titulo) {
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(colorMarca)
      .text(titulo.toUpperCase(), x + PAD, y + 6.5, { characterSpacing: 1, width: ancho - PAD * 2, lineBreak: false });
  }

  doc.fillColor(PDF.tinta).font("Helvetica").fontSize(10);
  doc.x = x + PAD;
  doc.y = y + BARRA + PAD;
  return { x: x + PAD, ancho: ancho - PAD * 2, yFin: y + alto };
}

/** Cierra la caja: mueve el cursor justo debajo y deja un respiro. */
export function cerrarCaja(doc: Doc, yFin: number): void {
  doc.x = M_IZQ;
  doc.y = yFin;
  doc.moveDown(0.8);
}

/** Atajo: caja con una grilla de datos adentro. */
export function cajaGrilla(
  doc: Doc,
  titulo: string | null,
  filas: FilaDato[],
  colorMarca: string,
  { columnas = 2, numerada = false }: { columnas?: number; numerada?: boolean } = {}
): void {
  const vis = filasConValor(filas);
  if (vis.length === 0) return;
  const caja = abrirCaja(doc, titulo, colorMarca, altoDeGrilla(vis.length, columnas));
  grillaDatos(doc, vis, { x: caja.x, ancho: caja.ancho, columnas, numerada });
  cerrarCaja(doc, caja.yFin);
}

export type LineaLista = { texto: string; estado?: "ok" | "pendiente" | null; nota?: string | null };

/** Atajo: caja con una lista (checklist, ítems marcados/pendientes).
 *  Cada línea con su símbolo de estado y una nota opcional a la derecha. */
export function cajaLista(doc: Doc, titulo: string | null, lineas: LineaLista[], colorMarca: string): void {
  if (lineas.length === 0) return;
  const ALTO_LINEA = 15;
  const caja = abrirCaja(doc, titulo, colorMarca, lineas.length * ALTO_LINEA + 2);
  const y0 = doc.y;
  lineas.forEach((l, i) => {
    const cy = y0 + i * ALTO_LINEA;
    // Helvetica (fuente base PDF, WinAnsi) NO tiene el glifo ✓ — se usa
    // [X] / [ ], que sí existen.
    const simbolo = l.estado === "ok" ? "[X]" : l.estado === "pendiente" ? "[  ]" : "-";
    const color = l.estado === "ok" ? PDF.ok : l.estado === "pendiente" ? PDF.faint : PDF.tinta;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(color).text(simbolo, caja.x, cy, { width: 24, lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(PDF.tinta)
      .text(l.texto, caja.x + 26, cy, { width: caja.ancho - 26 - (l.nota ? 90 : 0), lineBreak: false, ellipsis: true });
    if (l.nota) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(PDF.muted)
        .text(l.nota, caja.x + caja.ancho - 88, cy + 0.5, { width: 88, align: "right", lineBreak: false });
    }
  });
  cerrarCaja(doc, caja.yFin);
}
