// ============================================================
// BITÁCORA — Correo transaccional vía Resend (fetch directo,
// mismo estilo que geocodificar.ts — sin agregar el SDK como
// dependencia nueva solo para un POST).
//
// Si RESEND_API_KEY/RESEND_FROM_EMAIL no están configurados, o si
// Resend responde con error después de reintentar, ambas funciones
// lanzan — quien las llama decide qué hacer (avisar al usuario que
// disparó la acción, o notificar a gerencia si era un envío en
// segundo plano). Nunca fallan en silencio.
// ============================================================
import { env } from "./env";

function linkCalificacion(trabajoId: string, valor: number): string {
  return `${env.WEB_URL}/encuesta/${trabajoId}?valor=${valor}`;
}

// Exportado para que notificarCliente.ts pueda mandar correos con
// asunto/cuerpo/adjunto arbitrarios (mensaje personalizado o default)
// sin duplicar el reintento/manejo de error acá.
export async function enviarConReintento(body: Record<string, unknown>, contexto: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error("El envío de correo no está configurado (RESEND_API_KEY/RESEND_FROM_EMAIL)");
  }

  let ultimoError: string = "";
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      ultimoError = `Resend respondió ${res.status}: ${await res.text().catch(() => "")}`;
    } catch (err) {
      ultimoError = err instanceof Error ? err.message : String(err);
    }
    if (intento === 1) {
      console.warn(`Intento 1 de ${contexto} falló (${ultimoError}), reintentando…`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw new Error(`No se pudo mandar ${contexto} tras reintentar: ${ultimoError}`);
}

export async function enviarEncuestaSatisfaccion(destinatario: string, trabajoId: string, clienteNombre: string): Promise<void> {
  const botones = [1, 2, 3, 4, 5]
    .map(
      (valor) =>
        `<a href="${linkCalificacion(trabajoId, valor)}" style="display:inline-block;margin:0 4px;padding:10px 16px;background:#4338ca;color:#fff;text-decoration:none;border-radius:8px;font-family:sans-serif;font-weight:600;">${valor}</a>`
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2>¿Cómo fue tu servicio, ${clienteNombre}?</h2>
      <p>Califica del 1 (malo) al 5 (excelente):</p>
      <div>${botones}</div>
    </div>
  `;

  await enviarConReintento(
    { from: env.RESEND_FROM_EMAIL, to: destinatario, subject: "¿Cómo fue tu servicio?", html },
    "la encuesta de satisfacción"
  );
}

// Envía el PDF de una orden de servicio ya finalizada como adjunto.
export async function enviarPdfOS(destinatario: string, empresaNombre: string, folio: number, pdfBuffer: Buffer): Promise<void> {
  await enviarConReintento(
    {
      from: env.RESEND_FROM_EMAIL,
      to: destinatario,
      subject: `Orden de Servicio N° ${folio} — ${empresaNombre}`,
      html: `<div style="font-family:sans-serif;"><p>Adjuntamos la Orden de Servicio N° ${folio}.</p></div>`,
      attachments: [{ filename: `OS-${folio}.pdf`, content: pdfBuffer.toString("base64") }],
    },
    "el PDF de la orden de servicio"
  );
}

// Envía el PDF de una cotización directo al cliente.
export async function enviarCotizacionPdf(destinatario: string, empresaNombre: string, numero: number, pdfBuffer: Buffer): Promise<void> {
  await enviarConReintento(
    {
      from: env.RESEND_FROM_EMAIL,
      to: destinatario,
      subject: `Cotización N° ${numero} — ${empresaNombre}`,
      html: `<div style="font-family:sans-serif;"><p>Adjuntamos tu cotización N° ${numero}.</p></div>`,
      attachments: [{ filename: `Cotizacion-${numero}.pdf`, content: pdfBuffer.toString("base64") }],
    },
    "el PDF de la cotización"
  );
}
