import { supabase } from "./supabase";

// Ley 21.719 — principio de conservación limitada. No hay cron en este
// proyecto: la limpieza corre de forma perezosa desde /api/me (igual
// criterio que la revisión de cumpleaños y la limpieza de `idempotencia`).
// Como mucho una vez por hora por proceso, y sólo en ~1 de cada 20
// requests, para no pegarle a la base en cada navegación.
//
// Plazos (conservadores — pendiente de confirmación legal, ver
// docs/AUDITORIA_LEY21719.md hallazgo #5):
//   accesos_usuario ....... 12 meses
//   portal_codigos ........ 30 días
//   portal_accesos ........ 30 días después de expirar
//   *_2fa/codigo_pendiente  al vencer

const UNA_HORA = 60 * 60 * 1000;
const DIA = 24 * 60 * 60 * 1000;
let ultimaCorrida = 0;

export function limpiarDatosVencidosSiCorresponde(): void {
  if (Math.random() >= 0.05) return;
  const ahora = Date.now();
  if (ahora - ultimaCorrida < UNA_HORA) return;
  ultimaCorrida = ahora;
  void limpiar();
}

async function limpiar(): Promise<void> {
  const ahoraIso = new Date().toISOString();
  const hace12Meses = new Date(Date.now() - 365 * DIA).toISOString();
  const hace30Dias = new Date(Date.now() - 30 * DIA).toISOString();

  const tareas: { etiqueta: string; run: () => PromiseLike<{ error: { message: string } | null }> }[] = [
    {
      etiqueta: "accesos_usuario",
      run: () => supabase.from("accesos_usuario").delete().lt("creado_en", hace12Meses),
    },
    {
      etiqueta: "portal_codigos",
      run: () => supabase.from("portal_codigos").delete().lt("creado_en", hace30Dias),
    },
    {
      etiqueta: "portal_accesos",
      run: () => supabase.from("portal_accesos").delete().lt("expira_en", hace30Dias),
    },
    {
      etiqueta: "login_2fa_pendiente",
      run: () => supabase.from("login_2fa_pendiente").delete().lt("expira_en", ahoraIso),
    },
    {
      etiqueta: "mfa_codigo_pendiente",
      run: () => supabase.from("mfa_codigo_pendiente").delete().lt("expira_en", ahoraIso),
    },
  ];

  for (const t of tareas) {
    try {
      const { error } = await t.run();
      if (error) console.error(`retencion ${t.etiqueta}:`, error.message);
    } catch (err) {
      console.error(`retencion ${t.etiqueta}:`, err);
    }
  }
}
