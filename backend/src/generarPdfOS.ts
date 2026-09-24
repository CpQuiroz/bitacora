// ============================================================
// BITÁCORA — PDF de una Orden de Servicio finalizada.
//
// pdfkit puro (sin Chromium/Puppeteer): genera el documento en
// memoria y lo devuelve como Buffer, listo para servir por HTTP
// o adjuntar a un correo (email.ts → enviarPdfOS).
//
// Nivel de detalle de informe de campo profesional: bloques en caja
// para datos del cliente / de la tarea / campos del tipo de trabajo,
// checklist con estado y hora, galería de fotos, informe técnico (IA)
// debajo de las fotos y bloque de firma.
// Todo el layout sale de helpers genéricos de pdfEstilo.ts.
// ============================================================
import PDFDocument from "pdfkit";
import type { BloqueEncabezado, CategoriaFotoOS, SeccionPdfOS } from "@bitacora/shared";
import { ETIQUETA_CATEGORIA_FOTO_OS } from "@bitacora/shared";
import { ANCHO, M_DER, M_IZQ, PDF, abrirCaja, bloquesEncabezado, cajaGrilla, cajaLista, cerrarCaja, regla, tituloBarra, tituloSeccion } from "./pdfEstilo";

export type ItemOSPdf = {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
};

export type CampoCombinadoOSPdf =
  | { tipo: "texto"; etiqueta: string; valor: string }
  | { tipo: "foto"; etiqueta: string; fotos: string[] };

export type DatosOSPdf = {
  empresaNombre: string;
  empresaLogoUrl: string | null;
  colorPrimario: string | null;
  textoEncabezado: BloqueEncabezado[] | null;
  textoPie: string | null;
  folio: number | null;
  // Referencia del cliente (migración 119, pedido 21-sep-2026) — el
  // número de orden de compra que emitió el cliente, para que pueda
  // conciliarlo con su propio sistema. Nunca se oculta (a diferencia de
  // costo/precio_mayorista/precio_minorista): el cliente ya conoce su
  // propio número, el sentido de imprimirlo es justamente ese.
  ordenCompraCliente: string | null;
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
  // Campos del tipo de trabajo (texto y foto intercalados, en el mismo
  // orden en que la empresa los definió en Configuración > Tipos de
  // OS/Trabajo) — pedido 22-sep-2026, según un informe de referencia de
  // Hidroservi/2Workers: antes el texto se juntaba en una sola grilla y
  // las fotos se imprimían todas después, sin una numeración continua
  // real. Ahora es una sola lista numerada N) Etiqueta / valor-o-foto(s),
  // en el orden exacto del formulario.
  camposCombinados: CampoCombinadoOSPdf[];
  // Qué secciones muestra el PDF (migración 106, Configuración >
  // Plantillas > Orden de servicio). Siempre completo (armarDatosPdf en
  // trabajos.ts ya rellena las claves ausentes con `true`).
  seccionesVisibles: Record<SeccionPdfOS, boolean>;
  checklist: { item: string; hecho: boolean; hora: string | null }[];
  checkInAt: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInSinUbicacion: boolean;
  checkOutAt: string | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutSinUbicacion: boolean;
  observacionesCierre: string | null;
  informeIA: string | null;
  items: ItemOSPdf[];
  fotos: { url: string; categoria: CategoriaFotoOS | null; descripcion: string | null }[];
  firmaUrl: string | null;
  firmanteNombre: string | null;
  firmanteDocumento: string | null;
  firmaTecnicoUrl: string | null;
  tecnicoFirmanteNombre: string | null;
  tecnicoFirmanteDocumento: string | null;
  // Fase 3.4b (23-sep-2026) — reemplaza el bloque de firma del cliente
  // cuando no había nadie que firmara.
  clienteNoDisponible: boolean;
  clienteNoDisponibleMotivo: string | null;
  clienteNoDisponibleFotoUrl: string | null;
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
  // Fotos de los campos tipo "foto" del formulario — aplanadas para
  // descargarlas todas junto con el resto, después se reagrupan por
  // campo (mismo índice, preservando el orden de datos.camposCombinados).
  const camposFotoUrls = datos.camposCombinados.filter((c) => c.tipo === "foto").flatMap((c) => c.fotos);

  const [logoBuffer, firmaBuffer, firmaTecnicoBuffer, clienteNoDisponibleFotoBuffer, ...resto] = await Promise.all([
    datos.empresaLogoUrl ? descargar(datos.empresaLogoUrl) : Promise.resolve(null),
    datos.firmaUrl ? descargar(datos.firmaUrl) : Promise.resolve(null),
    datos.firmaTecnicoUrl ? descargar(datos.firmaTecnicoUrl) : Promise.resolve(null),
    datos.clienteNoDisponibleFotoUrl ? descargar(datos.clienteNoDisponibleFotoUrl) : Promise.resolve(null),
    ...datos.fotos.map((f) => descargar(f.url)),
    ...camposFotoUrls.map((url) => descargar(url)),
  ]);
  const fotoBuffers = resto.slice(0, datos.fotos.length);
  const camposFotoBuffers = resto.slice(datos.fotos.length);
  const colorMarca = datos.colorPrimario ?? PDF.marca;

  // Fotos agrupadas por categoría, en el orden equipo → antes → durante
  // → después → generales.
  const ORDEN_CAT: (CategoriaFotoOS | null)[] = ["equipo", "antes", "durante", "despues", null];
  const fotosPorCategoria = fotoBuffers
    .map((buf, i) => ({ buf, categoria: datos.fotos[i]?.categoria ?? null, descripcion: datos.fotos[i]?.descripcion ?? null }))
    .filter((f): f is { buf: Buffer; categoria: CategoriaFotoOS | null; descripcion: string | null } => f.buf !== null);

  // Reagrupa camposFotoBuffers (plano) de vuelta dentro de
  // datos.camposCombinados, preservando el orden original texto+foto.
  let iFoto = 0;
  const camposCombinadosConBuffers = datos.camposCombinados.map((c) => {
    if (c.tipo !== "foto") return c;
    const buffers = c.fotos.map(() => camposFotoBuffers[iFoto++]).filter((b): b is Buffer => b !== null);
    return { ...c, buffers };
  });

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
  doc.fontSize(15).font("Helvetica-Bold").fillColor(colorMarca).text(datos.empresaNombre, logoBuffer ? 120 : 50, 52, { width: 250 });
  doc
    .fontSize(17)
    .font("Helvetica-Bold")
    .fillColor(PDF.tinta)
    .text(`Orden de Servicio N° ${datos.folio ?? "—"}`, 250, 54, { width: M_DER - 250, align: "right", lineBreak: false });
  regla(doc, 108, colorMarca, 2);
  doc.y = 120;

  if (datos.textoEncabezado && datos.textoEncabezado.length > 0) {
    bloquesEncabezado(doc, datos.textoEncabezado, M_IZQ, ANCHO);
    doc.fillColor(PDF.tinta);
    doc.moveDown(0.6);
  }

  // --- Informaciones del cliente ---
  if (datos.seccionesVisibles.cliente) {
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
  }

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
      { etiqueta: "Orden de compra", valor: datos.ordenCompraCliente },
      { etiqueta: "Check-in", valor: fechaHora(datos.checkInAt) },
      { etiqueta: "Check-out", valor: fechaHora(datos.checkOutAt) },
    ],
    colorMarca
  );

  if (datos.seccionesVisibles.descripcion && datos.descripcion) {
    tituloSeccion(doc, "Descripción del servicio", colorMarca, M_IZQ);
    doc.font("Helvetica").fontSize(10).fillColor(PDF.tinta).text(datos.descripcion, M_IZQ, doc.y, { width: ANCHO });
    doc.moveDown(1);
  }

  // --- Campos del tipo de trabajo: una sola lista numerada N) Etiqueta
  // con el valor o la(s) foto(s) debajo, en el orden exacto en que la
  // empresa armó el formulario (mismo criterio que el informe de
  // referencia de Hidroservi/2Workers, 22-sep-2026) — texto y foto ya
  // no van en bloques separados, se intercalan tal cual se definieron.
  // Los campos de texto sin valor ("—") se omiten (no consumen número,
  // igual que antes); los de foto siempre se muestran (avisan si falta
  // la foto en vez de desaparecer).
  if (datos.seccionesVisibles.campos && camposCombinadosConBuffers.length > 0) {
    let n = 1;
    for (const c of camposCombinadosConBuffers) {
      if (c.tipo === "texto" && (c.valor === "—" || c.valor.trim() === "")) continue;

      if (doc.y > 660) doc.addPage();
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(colorMarca)
        .text(`${n}) ${c.etiqueta}`, M_IZQ, doc.y, { width: ANCHO });
      doc.moveDown(0.25);
      n++;

      if (c.tipo === "texto") {
        doc.font("Helvetica").fontSize(9.5).fillColor(PDF.tinta).text(c.valor, M_IZQ, doc.y, { width: ANCHO });
        doc.moveDown(0.7);
        continue;
      }

      // tipo "foto": grilla de imágenes (mismo ancho/alto que la
      // galería de Fotos más abajo), o el aviso si todavía no hay foto.
      if (c.buffers.length === 0) {
        doc.font("Helvetica").fontSize(9).fillColor(PDF.faint).text("Sin foto todavía.", M_IZQ, doc.y, { width: ANCHO });
        doc.fillColor(PDF.tinta);
        doc.moveDown(0.8);
        continue;
      }
      let x = M_IZQ;
      let filaY = doc.y;
      const anchoFoto = 155;
      for (const buf of c.buffers) {
        if (x + anchoFoto > 545) {
          x = M_IZQ;
          filaY += 120;
        }
        if (filaY > 640) {
          doc.addPage();
          filaY = doc.y;
          x = M_IZQ;
        }
        try {
          doc.image(buf, x, filaY, { width: anchoFoto, height: 110, fit: [anchoFoto, 110] });
        } catch {
          // foto corrupta o formato no soportado — se omite
        }
        x += anchoFoto + 15;
      }
      doc.y = filaY + 120;
      doc.moveDown(0.4);
    }
  }

  if (datos.seccionesVisibles.observaciones && datos.observacionesCierre) {
    tituloSeccion(doc, "Comentarios del técnico", colorMarca, M_IZQ);
    doc.font("Helvetica").fontSize(10).fillColor(PDF.tinta).text(datos.observacionesCierre, M_IZQ, doc.y, { width: ANCHO });
    doc.moveDown(1);
  }

  // --- Tabla de ítems ---
  if (datos.seccionesVisibles.items && datos.items.length > 0) {
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
  if (datos.seccionesVisibles.checklist && datos.checklist.length > 0) {
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

  // --- Fotos, agrupadas por categoría ---
  if (datos.seccionesVisibles.fotos && fotosPorCategoria.length > 0) {
    if (doc.y > 600) doc.addPage();
    tituloBarra(doc, `Fotos (${fotosPorCategoria.length})`, colorMarca);
    doc.moveDown(0.3);
    for (const cat of ORDEN_CAT) {
      const delGrupo = fotosPorCategoria.filter((f) => f.categoria === cat);
      if (delGrupo.length === 0) continue;
      if (doc.y > 660) doc.addPage();
      doc
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor(PDF.muted)
        .text((cat ? ETIQUETA_CATEGORIA_FOTO_OS[cat] : "Otras fotos").toUpperCase(), M_IZQ, doc.y, { characterSpacing: 0.6, width: ANCHO });
      doc.moveDown(0.3);
      let x = 50;
      let filaY = doc.y;
      const anchoFoto = 155;
      // 110 la foto + 24 para hasta 2 líneas de descripción (Fase 3.1,
      // 23-sep-2026, pedido explícito) — antes 120 (solo 10px de aire,
      // sin descripción). Sin descripción esas 24px quedan en blanco,
      // no se recorta el layout de las OS de antes de esta fase.
      const altoFila = 138;
      for (const { buf, descripcion } of delGrupo) {
        if (x + anchoFoto > 545) {
          x = 50;
          filaY += altoFila;
        }
        if (filaY > 640) {
          doc.addPage();
          filaY = doc.y;
          x = 50;
        }
        try {
          doc.image(buf, x, filaY, { width: anchoFoto, height: 110, fit: [anchoFoto, 110] });
        } catch {
          // foto corrupta o formato no soportado — se omite
        }
        if (descripcion) {
          doc
            .font("Helvetica")
            .fontSize(7)
            .fillColor(PDF.muted)
            .text(descripcion, x, filaY + 113, { width: anchoFoto, height: 22, ellipsis: true });
          doc.fillColor(PDF.tinta);
        }
        x += anchoFoto + 15;
      }
      doc.y = filaY + altoFila;
      doc.moveDown(0.4);
    }
    doc.moveDown(0.5);
  }

  // --- Informe técnico (IA) — va DEBAJO de las imágenes (pedido
  // 23-sep-2026): el informe se genera a partir del análisis de las
  // fotos, así que se lee después de verlas. Antes iba justo después de
  // "Observaciones de cierre", arriba de ítems/checklist/fotos. El salto
  // previo evita que el título quede solo al pie de una página.
  if (datos.seccionesVisibles.informe_ia && datos.informeIA) {
    if (doc.y > 700) doc.addPage();
    tituloSeccion(doc, "Informe técnico", colorMarca, M_IZQ);
    doc.font("Helvetica").fontSize(10).fillColor(PDF.tinta).text(datos.informeIA, M_IZQ, doc.y, { width: ANCHO });
    doc.moveDown(1);
  }

  // --- Ejecutor: firma dibujada (OS de antes de la Fase 3.2, back-
  // compat) o acreditación por sesión (OS nuevas — ya no se pide
  // firma al colaborador, queda acreditado por su cuenta + check-in/
  // check-out con hora y GPS si hubo). Cuál de las dos se imprime
  // depende solo de si HAY una firma_tecnico_url guardada — nunca un
  // flag de versión aparte, así una OS vieja sigue viéndose igual.
  if (datos.seccionesVisibles.firma_tecnico) {
    if (datos.firmaTecnicoUrl || datos.tecnicoFirmanteNombre) {
      bloqueFirma(doc, colorMarca, {
        titulo: "Firma del técnico responsable",
        imagen: firmaTecnicoBuffer,
        nombre: datos.tecnicoFirmanteNombre ?? datos.colaboradorNombre,
        documento: datos.tecnicoFirmanteDocumento,
      });
    } else {
      bloqueEjecutor(doc, colorMarca, datos);
    }
  }
  // --- Cliente: "no disponible" (nadie firmó, motivo + evidencia) o
  // firma de conformidad normal. El RUT ya no se pide al firmar (Fase
  // 3.2) — sale de la ficha del cliente asociado a la OS
  // (datos.clienteRut), con el dato tipeado viejo como respaldo si el
  // cliente no tiene RUT cargado.
  if (datos.seccionesVisibles.firma_cliente) {
    if (datos.clienteNoDisponible) {
      bloqueClienteNoDisponible(doc, colorMarca, datos, clienteNoDisponibleFotoBuffer);
    } else {
      bloqueFirma(doc, colorMarca, {
        titulo: "Firma de conformidad del cliente o encargado",
        imagen: firmaBuffer,
        nombre: datos.firmanteNombre,
        documento: datos.clienteRut ?? datos.firmanteDocumento,
      });
    }
  }

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

// "Hora · lat, lng" o "Hora · sin ubicación" (GPS denegado/sin señal,
// Fase 3.4b) o solo "Hora" si ni siquiera eso quedó registrado (OS de
// antes del check-in geolocalizado, migración 64).
function textoUbicacion(at: string | null, lat: number | null, lng: number | null, sinUbicacion: boolean): string {
  const hora = fechaHora(at) ?? "—";
  if (lat != null && lng != null) return `${hora} · ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  if (sinUbicacion) return `${hora} · sin ubicación`;
  return hora;
}

// Reemplaza a bloqueFirma para el técnico en OS nuevas (Fase 3.2,
// 23-sep-2026) — ya no se pide firma dibujada: el ejecutor queda
// acreditado por su propia sesión + los horarios/GPS de check-in y
// check-out, que de todas formas ya se registraban.
function bloqueEjecutor(doc: PDFKit.PDFDocument, colorMarca: string, datos: DatosOSPdf): void {
  const ALTO_CONTENIDO = 60;
  const caja = abrirCaja(doc, "Ejecutado por", colorMarca, ALTO_CONTENIDO);
  const y0 = doc.y;
  doc.font("Helvetica").fontSize(8.5).fillColor(PDF.tinta);
  doc.text(`Nombre: ${datos.colaboradorNombre || "—"}`, caja.x, y0, { width: caja.ancho });
  doc.text(`Llegada: ${textoUbicacion(datos.checkInAt, datos.checkInLat, datos.checkInLng, datos.checkInSinUbicacion)}`, caja.x, y0 + 15, {
    width: caja.ancho,
  });
  doc.text(`Salida: ${textoUbicacion(datos.checkOutAt, datos.checkOutLat, datos.checkOutLng, datos.checkOutSinUbicacion)}`, caja.x, y0 + 30, {
    width: caja.ancho,
  });
  doc.font("Helvetica").fontSize(7).fillColor(PDF.faint);
  doc.text("Acreditado por su cuenta en el sistema — sin firma dibujada.", caja.x, y0 + 46, { width: caja.ancho });
  doc.fillColor(PDF.tinta);
  cerrarCaja(doc, caja.yFin);
}

// Reemplaza a bloqueFirma para el cliente cuando no había nadie que
// firmara (Fase 3.4b) — motivo + foto de evidencia, en vez de firma.
function bloqueClienteNoDisponible(doc: PDFKit.PDFDocument, colorMarca: string, datos: DatosOSPdf, foto: Buffer | null): void {
  const ALTO_CONTENIDO = 76;
  const caja = abrirCaja(doc, "Cliente no disponible", colorMarca, ALTO_CONTENIDO);
  const y0 = doc.y;
  const anchoTexto = foto ? caja.ancho - 112 : caja.ancho;
  const xTexto = foto ? caja.x + 112 : caja.x;
  if (foto) {
    try {
      doc.image(foto, caja.x, y0, { width: 100, height: 76, fit: [100, 76] });
    } catch {
      /* foto corrupta — se omite */
    }
  }
  doc.font("Helvetica").fontSize(8.5).fillColor(PDF.tinta);
  doc.text(`Motivo: ${datos.clienteNoDisponibleMotivo || "—"}`, xTexto, y0, { width: anchoTexto });
  cerrarCaja(doc, caja.yFin);
}
