// ============================================================
// BITÁCORA — Correo transaccional vía Resend (fetch directo,
// mismo estilo que geocodificar.ts — sin agregar el SDK como
// dependencia nueva solo para un POST).
//
// Si RESEND_API_KEY/RESEND_FROM_EMAIL no están configurados, el
// envío se omite en silencio (log de advertencia) — no bloquea el
// resto del flujo (ej. marcar check-out sigue funcionando igual).
// ============================================================
import { env } from "./env";

function linkCalificacion(trabajoId: string, valor: number): string {
  return `${env.WEB_URL}/encuesta/${trabajoId}?valor=${valor}`;
}

export async function enviarEncuestaSatisfaccion(
  destinatario: string,
  trabajoId: string,
  clienteNombre: string
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    console.warn(
      "RESEND_API_KEY/RESEND_FROM_EMAIL no configurados — se omite el envío de la encuesta de satisfacción."
    );
    return;
  }

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

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: destinatario,
      subject: "¿Cómo fue tu servicio?",
      html,
    }),
  });

  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    console.error(`Resend respondió ${res.status} al mandar la encuesta: ${texto}`);
  }
}
