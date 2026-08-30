// ============================================================
// Autenticación de dos factores de usuarios normales — gestión (alta,
// confirmación, baja). Todo sobre req.userId (mismo patrón que
// /api/usuarios/me). El challenge de login en sí (POST /login/verificar)
// vive en authLogin.ts, no acá — este router asume que ya hay sesión.
// ============================================================
import { Router } from "express";
import crypto from "node:crypto";
import { supabase } from "../supabase";
import { env } from "../env";
import { ah } from "../asyncHandler";
import type { RequestConEmpresa } from "../empresa";
import { generarSecretoTotp, otpauthUri, verificarCodigoTotp } from "../totp";
import { cifrarJson, descifrarJson } from "../crypto";
import { enviarCodigoVerificacion } from "../email";

export const mfaRouter = Router();

const CODIGO_TTL_MIN = 10;

export function generarCodigo(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCodigo(codigo: string): string {
  return crypto.createHash("sha256").update(codigo).digest("hex");
}

mfaRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data } = await supabase.from("usuarios").select("mfa_activado, mfa_metodo").eq("id", req.userId!).maybeSingle();
    res.json({ activado: data?.mfa_activado ?? false, metodo: data?.mfa_metodo ?? null });
  })
);

mfaRouter.post(
  "/totp/iniciar",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: authUser } = await supabase.auth.admin.getUserById(req.userId!);
    const correo = authUser?.user?.email;
    if (!correo) {
      res.status(400).json({ error: "No pudimos determinar tu correo de acceso" });
      return;
    }

    const secreto = generarSecretoTotp();
    const secretoCifrado = cifrarJson({ secreto }, env.USUARIOS_MFA_ENCRYPTION_KEY, "USUARIOS_MFA_ENCRYPTION_KEY");
    // upsert: si ya había un intento de alta sin confirmar, lo pisa —
    // no queda un secreto viejo dando vueltas.
    const { error } = await supabase.from("mfa_totp_secretos").upsert({ usuario_id: req.userId!, secreto_cifrado: secretoCifrado });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ secreto, otpauthUri: otpauthUri(secreto, correo, "Bitácora") });
  })
);

mfaRouter.post(
  "/totp/confirmar",
  ah<RequestConEmpresa>(async (req, res) => {
    const { codigo } = req.body ?? {};
    if (typeof codigo !== "string") {
      res.status(400).json({ error: "Falta el código" });
      return;
    }

    const { data: fila } = await supabase.from("mfa_totp_secretos").select("secreto_cifrado").eq("usuario_id", req.userId!).maybeSingle();
    if (!fila) {
      res.status(400).json({ error: "Primero genera un código QR con /totp/iniciar" });
      return;
    }
    const { secreto } = descifrarJson(fila.secreto_cifrado, env.USUARIOS_MFA_ENCRYPTION_KEY, "USUARIOS_MFA_ENCRYPTION_KEY") as { secreto: string };
    if (!verificarCodigoTotp(secreto, codigo)) {
      res.status(400).json({ error: "Código incorrecto" });
      return;
    }

    await supabase.from("usuarios").update({ mfa_activado: true, mfa_metodo: "totp" }).eq("id", req.userId!);
    res.json({ activado: true, metodo: "totp" });
  })
);

mfaRouter.post(
  "/email/iniciar",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: authUser } = await supabase.auth.admin.getUserById(req.userId!);
    const correo = authUser?.user?.email;
    if (!correo) {
      res.status(400).json({ error: "No pudimos determinar tu correo de acceso" });
      return;
    }

    const codigo = generarCodigo();
    const expiraEn = new Date(Date.now() + CODIGO_TTL_MIN * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("mfa_codigo_pendiente")
      .upsert({ usuario_id: req.userId!, codigo_hash: hashCodigo(codigo), intentos: 0, expira_en: expiraEn });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    try {
      await enviarCodigoVerificacion(correo, codigo);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      res.status(mensaje.includes("no está configurado") ? 500 : 502).json({
        error: mensaje.includes("no está configurado")
          ? "El envío de correos no está configurado en este ambiente."
          : "No pudimos enviar el código. Intenta de nuevo en unos minutos.",
      });
      return;
    }

    res.json({ enviado: true });
  })
);

mfaRouter.post(
  "/email/confirmar",
  ah<RequestConEmpresa>(async (req, res) => {
    const { codigo } = req.body ?? {};
    if (typeof codigo !== "string") {
      res.status(400).json({ error: "Falta el código" });
      return;
    }

    const { data: pendiente } = await supabase.from("mfa_codigo_pendiente").select("*").eq("usuario_id", req.userId!).maybeSingle();
    if (!pendiente || new Date(pendiente.expira_en).getTime() < Date.now()) {
      res.status(400).json({ error: "El código venció — pide uno nuevo" });
      return;
    }
    if (pendiente.intentos >= 5) {
      res.status(429).json({ error: "Demasiados intentos — pide un código nuevo" });
      return;
    }
    if (hashCodigo(codigo) !== pendiente.codigo_hash) {
      await supabase.from("mfa_codigo_pendiente").update({ intentos: pendiente.intentos + 1 }).eq("usuario_id", req.userId!);
      res.status(400).json({ error: "Código incorrecto" });
      return;
    }

    await supabase.from("mfa_codigo_pendiente").delete().eq("usuario_id", req.userId!);
    await supabase.from("usuarios").update({ mfa_activado: true, mfa_metodo: "email" }).eq("id", req.userId!);
    res.json({ activado: true, metodo: "email" });
  })
);

mfaRouter.post(
  "/desactivar",
  ah<RequestConEmpresa>(async (req, res) => {
    await supabase.from("usuarios").update({ mfa_activado: false, mfa_metodo: null }).eq("id", req.userId!);
    await supabase.from("mfa_totp_secretos").delete().eq("usuario_id", req.userId!);
    res.json({ activado: false, metodo: null });
  })
);
