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
    // En producción esto es un error real: quien llama hace rollback o
    // notifica. En desarrollo, para no bloquear pruebas locales sin Resend,
    // escribimos el correo (destinatario, asunto y cualquier enlace) en la
    // consola del backend y seguimos como si se hubiera enviado.
    if (process.env.NODE_ENV === "production") {
      throw new Error("El envío de correo no está configurado (RESEND_API_KEY/RESEND_FROM_EMAIL)");
    }
    const contenido = `${body.html ?? ""} ${body.text ?? ""}`;
    const enlaces = contenido.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
    console.warn(
      [
        "",
        "─".repeat(72),
        `CORREO NO ENVIADO (Resend sin configurar) — modo desarrollo`,
        `  contexto : ${contexto}`,
        `  para     : ${String(body.to ?? "")}`,
        `  asunto   : ${String(body.subject ?? "")}`,
        ...(enlaces.length ? ["  enlaces  :", ...enlaces.map((u) => `    ${u}`)] : []),
        "─".repeat(72),
        "",
      ].join("\n")
    );
    return;
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

// Invitación a un usuario nuevo (colaborador, o admin inicial de una
// empresa creada desde Super-Admin). Se manda con nuestro propio Resend
// en vez del servicio de correo integrado de Supabase Auth
// (inviteUserByEmail) — ese servicio tiene un límite muy bajo de envíos
// pensado solo para desarrollo ("Error sending invite email" apenas se
// supera), no apto para producción. El link se genera aparte con
// supabase.auth.admin.generateLink({ type: "invite" }), que crea el
// usuario y devuelve el link sin intentar mandar nada — acá solo se
// arma y envía el correo.
export async function enviarInvitacion(destinatario: string, empresaNombre: string, nombreInvitado: string, actionLink: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2>Te invitaron a ${empresaNombre} en Bitácora</h2>
      <p>Hola ${nombreInvitado}, ya te agregaron al equipo de ${empresaNombre}. Activa tu cuenta para empezar:</p>
      <p><a href="${actionLink}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#4338ca;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Activar mi cuenta</a></p>
    </div>
  `;

  await enviarConReintento(
    { from: env.RESEND_FROM_EMAIL, to: destinatario, subject: `Te invitaron a ${empresaNombre} en Bitácora`, html },
    "la invitación"
  );
}

// Código de verificación de 2FA por correo (activación o login) — 6
// dígitos, vigente 10 minutos (ver mfa_codigo_pendiente).
export async function enviarCodigoVerificacion(destinatario: string, codigo: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2>Tu código de verificación</h2>
      <p style="font-size:32px;font-weight:700;letter-spacing:4px;">${codigo}</p>
      <p>Vence en 10 minutos. Si no fuiste tú, ignora este correo.</p>
    </div>
  `;

  await enviarConReintento({ from: env.RESEND_FROM_EMAIL, to: destinatario, subject: `Tu código de verificación: ${codigo}`, html }, "el código de verificación");
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
