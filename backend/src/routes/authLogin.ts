// ============================================================
// Login en dos pasos — reemplaza el signInWithPassword() directo que
// hacían web/mobile. Necesario porque Supabase entrega una sesión
// válida y usable apenas la contraseña es correcta, y no hay forma de
// interceptar eso desde el cliente para exigir un segundo factor. Acá
// el backend hace el signInWithPassword, y si el usuario tiene 2FA
// activo retiene los tokens (cifrados) hasta que se confirme el
// código — recién ahí se los entrega al cliente.
//
// Sin 2FA activo: mismo shape de respuesta que daba signInWithPassword
// directo (access_token/refresh_token), cero cambio de comportamiento.
//
// IMPORTANTE: signInWithPassword() se llama con un cliente PROPIO,
// nunca con el "supabase" compartido de src/supabase.ts. Ese cliente
// compartido lo usa el resto del backend para consultas con la
// service role key — si se le hace signInWithPassword(), su sesión
// interna queda pisada por la del usuario logueado, y las consultas
// .from(...) que siguieran en ese mismo cliente (en este archivo y en
// cualquier otro request que reuse el singleton) pasarían a correr
// bajo RLS como ese usuario en vez de con la service role. Se
// verificó en vivo: eso hace que cualquier select a "usuarios" con
// join a "empresas" truene con "stack depth limit exceeded" (RLS
// recursiva vía empresa_actual()).
import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@bitacora/shared";
import { supabase } from "../supabase";
import { env } from "../env";
import { ah } from "../asyncHandler";
import { verificarCodigoTotp } from "../totp";
import { cifrarJson, descifrarJson } from "../crypto";
import { enviarCodigoVerificacion } from "../email";
import { generarCodigo, hashCodigo } from "./mfa";

export const authLoginRouter = Router();

const TICKET_TTL_MIN = 10;

authLoginRouter.post(
  "/login",
  ah(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "Falta email o password" });
      return;
    }

    const clienteAuth = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: sesion, error: errorLogin } = await clienteAuth.auth.signInWithPassword({ email, password });
    if (errorLogin || !sesion.session) {
      res.status(401).json({ error: "Credenciales inválidas" });
      return;
    }

    // Mismas validaciones que requiereEmpresa (usuario activo, empresa
    // no suspendida/dada de baja) — para no entregar una sesión que de
    // todas formas rebotaría en el primer request real.
    const { data: usuario, error: errorUsuario } = await supabase
      .from("usuarios")
      .select("rol, activo, mfa_activado, mfa_metodo, empresa:empresas(estado)")
      .eq("id", sesion.user.id)
      .maybeSingle();

    if (errorUsuario) {
      res.status(500).json({ error: errorUsuario.message });
      return;
    }
    if (!usuario) {
      res.status(403).json({ error: "Completa el registro de tu empresa primero" });
      return;
    }
    if (!usuario.activo) {
      res.status(403).json({ error: "Tu cuenta fue desactivada — contacta a un administrador" });
      return;
    }
    const estadoEmpresa = (usuario as unknown as { empresa: { estado: string } | null }).empresa?.estado;
    if (estadoEmpresa === "suspendida") {
      res.status(403).json({ error: "Tu empresa fue suspendida — contacta al soporte" });
      return;
    }
    if (estadoEmpresa === "dada_de_baja") {
      res.status(403).json({ error: "Esta cuenta fue dada de baja" });
      return;
    }

    if (!usuario.mfa_activado || !usuario.mfa_metodo) {
      // Sin 2FA — mismo resultado que el signInWithPassword directo de
      // antes. Si el rol lo exige y no está configurado, requiereEmpresa
      // se encarga de bloquear todo salvo /api/usuarios/me en el
      // siguiente request — acá no hace falta duplicar esa lógica.
      res.json({ access_token: sesion.session.access_token, refresh_token: sesion.session.refresh_token });
      return;
    }

    const metodo = usuario.mfa_metodo as "totp" | "email";
    const { data: ticket, error: errorTicket } = await supabase
      .from("login_2fa_pendiente")
      .insert({
        usuario_id: sesion.user.id,
        metodo,
        access_token_cifrado: cifrarJson({ token: sesion.session.access_token }, env.USUARIOS_MFA_ENCRYPTION_KEY, "USUARIOS_MFA_ENCRYPTION_KEY"),
        refresh_token_cifrado: cifrarJson({ token: sesion.session.refresh_token }, env.USUARIOS_MFA_ENCRYPTION_KEY, "USUARIOS_MFA_ENCRYPTION_KEY"),
        expira_en: new Date(Date.now() + TICKET_TTL_MIN * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (errorTicket || !ticket) {
      res.status(500).json({ error: errorTicket?.message ?? "No se pudo iniciar la verificación" });
      return;
    }

    if (metodo === "email") {
      const correo = sesion.user.email;
      if (!correo) {
        res.status(400).json({ error: "No pudimos determinar tu correo de acceso" });
        return;
      }
      const codigo = generarCodigo();
      await supabase.from("mfa_codigo_pendiente").upsert({
        usuario_id: sesion.user.id,
        codigo_hash: hashCodigo(codigo),
        intentos: 0,
        expira_en: new Date(Date.now() + TICKET_TTL_MIN * 60 * 1000).toISOString(),
      });
      try {
        await enviarCodigoVerificacion(correo, codigo);
      } catch (err) {
        await supabase.from("login_2fa_pendiente").delete().eq("id", ticket.id);
        const mensaje = err instanceof Error ? err.message : String(err);
        res.status(mensaje.includes("no está configurado") ? 500 : 502).json({
          error: mensaje.includes("no está configurado")
            ? "El envío de correos no está configurado en este ambiente."
            : "No pudimos enviar el código. Intenta de nuevo en unos minutos.",
        });
        return;
      }
    }

    res.json({ requiere_codigo: true, metodo, ticket: ticket.id });
  })
);

authLoginRouter.post(
  "/login/verificar",
  ah(async (req, res) => {
    const { ticket, codigo } = req.body ?? {};
    if (typeof ticket !== "string" || typeof codigo !== "string") {
      res.status(400).json({ error: "Falta ticket o código" });
      return;
    }

    const { data: fila } = await supabase.from("login_2fa_pendiente").select("*").eq("id", ticket).maybeSingle();
    if (!fila || new Date(fila.expira_en).getTime() < Date.now()) {
      res.status(400).json({ error: "La verificación venció — vuelve a iniciar sesión" });
      return;
    }
    if (fila.intentos >= 5) {
      res.status(429).json({ error: "Demasiados intentos — vuelve a iniciar sesión" });
      return;
    }

    let codigoOk = false;
    if (fila.metodo === "totp") {
      const { data: secretoFila } = await supabase.from("mfa_totp_secretos").select("secreto_cifrado").eq("usuario_id", fila.usuario_id).maybeSingle();
      if (secretoFila) {
        const { secreto } = descifrarJson(secretoFila.secreto_cifrado, env.USUARIOS_MFA_ENCRYPTION_KEY, "USUARIOS_MFA_ENCRYPTION_KEY") as {
          secreto: string;
        };
        codigoOk = verificarCodigoTotp(secreto, codigo);
      }
    } else {
      const { data: pendiente } = await supabase.from("mfa_codigo_pendiente").select("codigo_hash, expira_en").eq("usuario_id", fila.usuario_id).maybeSingle();
      codigoOk = Boolean(pendiente) && new Date(pendiente!.expira_en).getTime() >= Date.now() && hashCodigo(codigo) === pendiente!.codigo_hash;
    }

    if (!codigoOk) {
      await supabase.from("login_2fa_pendiente").update({ intentos: fila.intentos + 1 }).eq("id", ticket);
      res.status(401).json({ error: "Código incorrecto" });
      return;
    }

    await supabase.from("login_2fa_pendiente").delete().eq("id", ticket);
    if (fila.metodo === "email") {
      await supabase.from("mfa_codigo_pendiente").delete().eq("usuario_id", fila.usuario_id);
    }

    const { token: accessToken } = descifrarJson(fila.access_token_cifrado, env.USUARIOS_MFA_ENCRYPTION_KEY, "USUARIOS_MFA_ENCRYPTION_KEY") as {
      token: string;
    };
    const { token: refreshToken } = descifrarJson(fila.refresh_token_cifrado, env.USUARIOS_MFA_ENCRYPTION_KEY, "USUARIOS_MFA_ENCRYPTION_KEY") as {
      token: string;
    };
    res.json({ access_token: accessToken, refresh_token: refreshToken });
  })
);
