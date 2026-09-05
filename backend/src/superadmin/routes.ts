import { Router } from "express";
import crypto from "node:crypto";
import type { Accion, EstadoEmpresa, Modulo, Plan, Rol, Rubro } from "@bitacora/shared";
import { ACCIONES, MODULOS, MODULOS_DELEGABLES_POR_EMPRESA, moduloActivadoPorDefecto, formatearRut, validarRut } from "@bitacora/shared";
import {
  invalidarCacheRoles,
  empresaPuedeUsarRol,
  rolesDeEmpresa,
  modulosPorRolDeEmpresa,
  fijarModulosDeRolEnEmpresa,
} from "../roles";
import { empresaTieneModulo } from "../permisos";
import { anonimizarUsuario, anonimizarCliente } from "../anonimizar";
import { validarValorAcceso } from "../accesosAutorizados";
import { supabase } from "../supabase";
import { env } from "../env";
import { ah } from "../asyncHandler";
import { cifrarJson, descifrarJson } from "../crypto";
import { medirUsoStorage } from "../storage";
import { TABLAS_POR_EMPRESA } from "../tenant";
import { cambiarPlanEmpresa } from "../planes";
import { enviarInvitacion } from "../email";
import { sembrarSugerenciasRubro } from "../seedRubro";
import { hashPassword, verificarPassword } from "./passwords";
import { generarSecretoTotp, otpauthUri, verificarCodigoTotp } from "../totp";
import {
  crearTokenSuperAdmin,
  crearTokenImpersonacion,
  verificarTokenImpersonacion,
  requiereSuperAdmin,
  registrarAuditoria,
  type RequestConSuperAdmin,
} from "./auth";

const ESTADOS_EMPRESA: EstadoEmpresa[] = ["activa", "suspendida", "dada_de_baja"];
const PLANES: Plan[] = ["trial", "basico", "pro"];
const RUBROS: Rubro[] = ["transporte", "servicio_tecnico", "cosmetologia", "otro"];

export const superadminRouter = Router();

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

superadminRouter.post(
  "/login",
  ah(async (req, res) => {
    const { correo, password, codigo } = req.body ?? {};
    if (typeof correo !== "string" || typeof password !== "string" || typeof codigo !== "string") {
      res.status(400).json({ error: "Falta correo, password o código" });
      return;
    }

    const { data: superAdmin } = await supabase
      .from("super_admins")
      .select("*")
      .eq("correo", correo.trim().toLowerCase())
      .maybeSingle();

    // Mismo mensaje genérico en todos los casos de fallo — no revela
    // si el correo existe, si la password está mal, o si falta el TOTP.
    const credencialesInvalidas = () => res.status(401).json({ error: "Credenciales inválidas" });

    if (!superAdmin || !superAdmin.activo) {
      credencialesInvalidas();
      return;
    }
    if (superAdmin.bloqueado_hasta && new Date(superAdmin.bloqueado_hasta).getTime() > Date.now()) {
      res.status(423).json({ error: "Cuenta bloqueada temporalmente por demasiados intentos fallidos" });
      return;
    }

    const totpSecreto = descifrarJson(superAdmin.totp_secreto, env.SUPERADMIN_ENCRYPTION_KEY, "SUPERADMIN_ENCRYPTION_KEY").secreto as string;
    const passwordOk = verificarPassword(password, superAdmin.password_hash);
    const codigoOk = passwordOk && verificarCodigoTotp(totpSecreto, codigo);

    if (!passwordOk || !codigoOk) {
      const intentos = superAdmin.intentos_fallidos + 1;
      await supabase
        .from("super_admins")
        .update({
          intentos_fallidos: intentos,
          bloqueado_hasta: intentos >= MAX_INTENTOS ? new Date(Date.now() + BLOQUEO_MS).toISOString() : null,
        })
        .eq("id", superAdmin.id);
      credencialesInvalidas();
      return;
    }

    await supabase
      .from("super_admins")
      .update({ intentos_fallidos: 0, bloqueado_hasta: null, ultimo_login_en: new Date().toISOString() })
      .eq("id", superAdmin.id);

    await registrarAuditoria(superAdmin.id, "login", { ip: req.ip ?? null });

    res.json({ token: crearTokenSuperAdmin(superAdmin.id), nombre: superAdmin.nombre });
  })
);

// ── Mi cuenta ────────────────────────────────────────────────────────
// Autogestión de las credenciales del propio super-admin. Hasta ahora
// la única vía era el script offline (crear-superadmin.ts) — esto da un
// camino desde el panel, sin acceso shell al servidor. Toda mutación
// exige reautenticarse en el momento (contraseña actual + código TOTP),
// igual que el login, para que un token filtrado no alcance para
// cambiar la contraseña o el segundo factor.

async function reautenticar(superAdminId: string, password: unknown, codigo: unknown): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (typeof password !== "string" || typeof codigo !== "string") {
    return { ok: false, status: 400, error: "Falta la contraseña actual o el código" };
  }
  const { data: sa } = await supabase.from("super_admins").select("password_hash, totp_secreto").eq("id", superAdminId).maybeSingle();
  if (!sa) return { ok: false, status: 401, error: "Sesión inválida — vuelve a entrar" };
  const totpSecreto = descifrarJson(sa.totp_secreto, env.SUPERADMIN_ENCRYPTION_KEY, "SUPERADMIN_ENCRYPTION_KEY").secreto as string;
  if (!verificarPassword(password, sa.password_hash) || !verificarCodigoTotp(totpSecreto, codigo)) {
    return { ok: false, status: 401, error: "Contraseña actual o código incorrecto" };
  }
  return { ok: true };
}

superadminRouter.get(
  "/me",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data } = await supabase.from("super_admins").select("correo, nombre, ultimo_login_en, creado_en").eq("id", req.superAdminId!).maybeSingle();
    if (!data) {
      res.status(404).json({ error: "No encontrado" });
      return;
    }
    res.json(data);
  })
);

superadminRouter.post(
  "/me/cambiar-password",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { password_actual, password_nueva, codigo } = req.body ?? {};
    if (typeof password_nueva !== "string" || password_nueva.length < 12) {
      res.status(400).json({ error: "La contraseña nueva debe tener al menos 12 caracteres" });
      return;
    }
    const auth = await reautenticar(req.superAdminId!, password_actual, codigo);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const { error } = await supabase
      .from("super_admins")
      .update({ password_hash: hashPassword(password_nueva), intentos_fallidos: 0, bloqueado_hasta: null })
      .eq("id", req.superAdminId!);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    await registrarAuditoria(req.superAdminId!, "cambiar_password_propia", { ip: req.ip ?? null });
    res.json({ ok: true });
  })
);

superadminRouter.post(
  "/me/regenerar-totp",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { password_actual, codigo } = req.body ?? {};
    const auth = await reautenticar(req.superAdminId!, password_actual, codigo);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const { data: sa } = await supabase.from("super_admins").select("correo").eq("id", req.superAdminId!).maybeSingle();
    if (!sa) {
      res.status(404).json({ error: "No encontrado" });
      return;
    }
    const secreto = generarSecretoTotp();
    const { error } = await supabase
      .from("super_admins")
      .update({ totp_secreto: cifrarJson({ secreto }, env.SUPERADMIN_ENCRYPTION_KEY, "SUPERADMIN_ENCRYPTION_KEY") })
      .eq("id", req.superAdminId!);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    await registrarAuditoria(req.superAdminId!, "regenerar_totp_propio", { ip: req.ip ?? null });
    // Se muestra una sola vez — igual que crear-superadmin.ts y que el
    // reset de 2FA de un usuario de empresa.
    res.json({ secreto, otpauthUri: otpauthUri(secreto, sa.correo, "Bitácora Super-Admin") });
  })
);

// ── Dashboard global ─────────────────────────────────────────────────
// Vista agregada de todo el negocio (MRR aproximado, churn, uso,
// outliers de costo). El cálculo real vive en la función SQL
// superadmin_metricas_calcular() (migración 60). Acá solo se maneja el
// cache: se devuelve el snapshot guardado si tiene menos de 15 min, si
// no se recalcula y se re-guarda. Sin cron — el refresco lo dispara
// quien abra el panel.
const METRICAS_TTL_MS = 15 * 60 * 1000;

superadminRouter.get(
  "/metricas",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    await registrarAuditoria(req.superAdminId!, "ver_metricas_globales", { ip: req.ip ?? null });

    const { data: cache } = await supabase
      .from("superadmin_metricas_cache")
      .select("datos, generado_en")
      .eq("id", 1)
      .maybeSingle();

    if (cache && Date.now() - new Date(cache.generado_en).getTime() < METRICAS_TTL_MS) {
      res.json({ ...(cache.datos as Record<string, unknown>), generado_en: cache.generado_en, cacheado: true });
      return;
    }

    const { data: calculo, error } = await supabase.rpc("superadmin_metricas_calcular");
    if (error) {
      // Si falla el recálculo pero hay un snapshot viejo, servirlo igual
      // (mejor un dato de hace un rato que un 500).
      if (cache) {
        res.json({ ...(cache.datos as Record<string, unknown>), generado_en: cache.generado_en, cacheado: true, obsoleto: true });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    const generadoEn = new Date().toISOString();
    await supabase.from("superadmin_metricas_cache").upsert({ id: 1, datos: calculo, generado_en: generadoEn });
    res.json({ ...(calculo as Record<string, unknown>), generado_en: generadoEn, cacheado: false });
  })
);

superadminRouter.get(
  "/empresas",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const busqueda = typeof req.query.busqueda === "string" ? req.query.busqueda.trim() : "";

    let query = supabase
      .from("empresas")
      .select("id, nombre, plan, estado, creado_en")
      .order("creado_en", { ascending: false });
    if (busqueda) query = query.ilike("nombre", `%${busqueda}%`);

    const { data: empresas, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const { data: usuarios } = await supabase.from("usuarios").select("empresa_id");
    const cantidadPorEmpresa = new Map<string, number>();
    for (const u of usuarios ?? []) {
      cantidadPorEmpresa.set(u.empresa_id, (cantidadPorEmpresa.get(u.empresa_id) ?? 0) + 1);
    }

    await registrarAuditoria(req.superAdminId!, "ver_empresas", { ip: req.ip ?? null, detalle: busqueda || undefined });

    res.json((empresas ?? []).map((e) => ({ ...e, cantidad_usuarios: cantidadPorEmpresa.get(e.id) ?? 0 })));
  })
);

// Crea una empresa cliente nueva desde el panel — para onboarding
// manual (ej. un cliente que no pasa por el registro self-service).
// Invita al admin inicial por correo (mismo mecanismo que invitar
// colaboradores) y lo deja vinculado a la empresa recién creada.
superadminRouter.post(
  "/empresas",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { nombre, rubro, rut, giro, telefono_empresa, direccion_calle, admin_nombre, admin_correo } = req.body ?? {};

    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta el nombre de la empresa" });
      return;
    }
    if (typeof rubro !== "string" || !RUBROS.includes(rubro as Rubro)) {
      res.status(400).json({ error: `rubro debe ser uno de: ${RUBROS.join(", ")}` });
      return;
    }
    if (typeof admin_nombre !== "string" || !admin_nombre.trim()) {
      res.status(400).json({ error: "Falta el nombre del administrador inicial" });
      return;
    }
    if (typeof admin_correo !== "string" || !admin_correo.includes("@")) {
      res.status(400).json({ error: "Correo del administrador inicial inválido" });
      return;
    }
    let rutFormateado: string | null = null;
    if (rut !== undefined && rut !== null && rut !== "") {
      if (typeof rut !== "string" || !validarRut(rut)) {
        res.status(400).json({ error: "RUT inválido (verifica el dígito verificador)" });
        return;
      }
      rutFormateado = formatearRut(rut);
    }

    const pruebaTerminaEn = new Date();
    pruebaTerminaEn.setDate(pruebaTerminaEn.getDate() + 21);

    const { data: empresa, error: errorEmpresa } = await supabase
      .from("empresas")
      .insert({
        nombre: nombre.trim(),
        rubro: rubro as Rubro,
        rut: rutFormateado,
        giro: giro?.trim() || null,
        telefono_empresa: telefono_empresa?.trim() || null,
        direccion_calle: direccion_calle?.trim() || null,
        prueba_termina_en: pruebaTerminaEn.toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (errorEmpresa) {
      res.status(500).json({ error: errorEmpresa.message });
      return;
    }

    // generateLink crea el usuario y devuelve el link sin intentar mandar
    // nada — el envío va por nuestro Resend (enviarInvitacion), no por el
    // servicio de correo integrado de Supabase Auth (inviteUserByEmail),
    // que tiene un límite de envíos pensado solo para desarrollo.
    const { data: generado, error: errorGenerar } = await supabase.auth.admin.generateLink({
      type: "invite",
      email: admin_correo,
      options: { redirectTo: `${env.WEB_URL}/invitacion` },
    });
    if (errorGenerar || !generado.user) {
      await supabase.from("empresas").delete().eq("id", empresa.id);
      console.error("Error generando link de invitación:", errorGenerar);
      res.status(400).json({ error: "No se pudo invitar al administrador. Verifica que el correo sea válido e intenta de nuevo." });
      return;
    }

    try {
      await enviarInvitacion(admin_correo, empresa.nombre, admin_nombre.trim(), generado.properties.action_link);
    } catch (err) {
      await supabase.auth.admin.deleteUser(generado.user.id);
      await supabase.from("empresas").delete().eq("id", empresa.id);
      const mensaje = err instanceof Error ? err.message : String(err);
      console.error("Error enviando invitación:", mensaje);
      res.status(mensaje.includes("no está configurado") ? 500 : 502).json({
        error: mensaje.includes("no está configurado")
          ? "El envío de correos no está configurado en este ambiente."
          : "No pudimos enviar el correo de invitación al administrador. Puede ser un problema temporal del servicio de correo — intenta de nuevo en unos minutos.",
      });
      return;
    }

    const { data: usuario, error: errorUsuario } = await supabase
      .from("usuarios")
      .insert({ id: generado.user.id, empresa_id: empresa.id, nombre: admin_nombre.trim(), rol: "admin" })
      .select()
      .single();
    if (errorUsuario) {
      await supabase.auth.admin.deleteUser(generado.user.id);
      await supabase.from("empresas").delete().eq("id", empresa.id);
      res.status(500).json({ error: errorUsuario.message });
      return;
    }

    // Deja la empresa con las sugerencias de su rubro ya cargadas
    // (tipos de documento, categorías de gasto, tipos de OS) en vez de
    // arrancar completamente vacía. No bloquea ni falla la creación.
    await sembrarSugerenciasRubro(empresa.id, empresa.rubro as Rubro);

    await registrarAuditoria(req.superAdminId!, "crear_empresa", {
      empresaId: empresa.id,
      ip: req.ip ?? null,
      detalle: `${empresa.nombre} (admin: ${admin_correo})`,
    });

    res.status(201).json({ empresa, usuario });
  })
);

// Edita los datos de identidad de una empresa — separado de
// estado/plan/módulos porque estos últimos son decisiones operativas
// del Super-Admin, mientras que nombre/RUT son datos que hoy solo la
// propia empresa puede corregir desde Configuración > Empresa; esto le
// da al Super-Admin una vía para arreglar un typo o un RUT mal
// ingresado sin depender del cliente.
superadminRouter.patch(
  "/empresas/:id",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { nombre, rut } = req.body ?? {};
    const cambios: { nombre?: string; rut?: string | null } = {};

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta el nombre de la empresa" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (rut !== undefined) {
      if (rut === null || rut === "") {
        cambios.rut = null;
      } else {
        if (typeof rut !== "string" || !validarRut(rut)) {
          res.status(400).json({ error: "RUT inválido (verifica el dígito verificador)" });
          return;
        }
        cambios.rut = formatearRut(rut);
      }
    }
    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data: actual } = await supabase.from("empresas").select("nombre, rut").eq("id", req.params.id).maybeSingle();
    if (!actual) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    const { data, error } = await supabase.from("empresas").update(cambios).eq("id", req.params.id).select("id, nombre, rut").single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await registrarAuditoria(req.superAdminId!, "editar_empresa", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${actual.nombre} → nombre: ${data.nombre}, rut: ${data.rut ?? "—"}`,
    });

    res.json(data);
  })
);

// Lista los usuarios de una empresa con su correo real (usuarios no
// tiene columna email — vive en auth.users, se resuelve por id). Para
// que el Super-Admin pueda ver a quién le está restableciendo la
// contraseña antes de hacerlo.
superadminRouter.get(
  "/empresas/:id/usuarios",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: usuarios, error } = await supabase
      .from("usuarios")
      .select("id, nombre, rol, activo, mfa_activado, mfa_metodo")
      .eq("empresa_id", req.params.id)
      .order("nombre");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const conCorreo = await Promise.all(
      (usuarios ?? []).map(async (u) => {
        const { data: authUser } = await supabase.auth.admin.getUserById(u.id);
        return { ...u, correo: authUser?.user?.email ?? null };
      })
    );
    res.json(conCorreo);
  })
);

// Invita un usuario nuevo a una empresa existente — mismo mecanismo que
// usa el admin de la empresa (routes/usuarios.ts POST /invitar) y que la
// creación de empresa acá arriba: generateLink crea el usuario en Auth,
// el correo con el link para definir contraseña se manda por Resend, y
// recién si eso funciona se vincula la fila en `usuarios`. No aplica el
// límite de usuarios por plan a propósito — es una acción deliberada de
// plataforma, igual que cambiar el plan o los módulos desde este panel.
superadminRouter.post(
  "/empresas/:id/usuarios",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { nombre, correo, rol } = req.body ?? {};
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta el nombre del usuario" });
      return;
    }
    if (typeof correo !== "string" || !correo.includes("@")) {
      res.status(400).json({ error: "Correo inválido" });
      return;
    }
    if (typeof rol !== "string" || !(await empresaPuedeUsarRol(rol, req.params.id))) {
      res.status(400).json({ error: "El rol indicado no está disponible para esta empresa" });
      return;
    }

    const { data: empresa } = await supabase.from("empresas").select("id, nombre").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    const { data: generado, error: errorGenerar } = await supabase.auth.admin.generateLink({
      type: "invite",
      email: correo,
      options: { redirectTo: `${env.WEB_URL}/invitacion` },
    });
    if (errorGenerar || !generado.user) {
      console.error("Error generando link de invitación:", errorGenerar);
      res.status(400).json({ error: "No se pudo invitar al usuario. Verifica que el correo sea válido y que no tenga ya una cuenta." });
      return;
    }

    try {
      await enviarInvitacion(correo, empresa.nombre, nombre.trim(), generado.properties.action_link);
    } catch (err) {
      await supabase.auth.admin.deleteUser(generado.user.id);
      const mensaje = err instanceof Error ? err.message : String(err);
      console.error("Error enviando invitación:", mensaje);
      res.status(mensaje.includes("no está configurado") ? 500 : 502).json({
        error: mensaje.includes("no está configurado")
          ? "El envío de correos no está configurado en este ambiente."
          : "No pudimos enviar el correo de invitación. Puede ser un problema temporal del servicio de correo — intenta de nuevo en unos minutos.",
      });
      return;
    }

    const { data: usuario, error: errorUsuario } = await supabase
      .from("usuarios")
      .insert({ id: generado.user.id, empresa_id: empresa.id, nombre: nombre.trim(), rol: rol as Rol })
      .select("id, nombre, rol, activo, mfa_activado, mfa_metodo")
      .single();
    if (errorUsuario) {
      await supabase.auth.admin.deleteUser(generado.user.id);
      res.status(500).json({ error: errorUsuario.message });
      return;
    }

    await registrarAuditoria(req.superAdminId!, "invitar_usuario_empresa", {
      empresaId: empresa.id,
      ip: req.ip ?? null,
      detalle: `${empresa.nombre}: ${nombre.trim()} <${correo}> (${rol})`,
    });

    res.status(201).json({ ...usuario, correo });
  })
);

// Genera una contraseña temporal y la aplica directo en Supabase Auth
// — se muestra una sola vez en la respuesta (no se guarda en ningún
// lado); el Super-Admin se la pasa a la empresa por el canal que use
// habitualmente para soporte. No hay envío de correo automático acá
// (mismo motivo que el resto del proyecto: RESEND_API_KEY no siempre
// está configurado).
superadminRouter.post(
  "/empresas/:id/usuarios/:usuarioId/restablecer-password",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, nombre, empresa_id")
      .eq("id", req.params.usuarioId)
      .eq("empresa_id", req.params.id)
      .maybeSingle();
    if (!usuario) {
      res.status(404).json({ error: "Usuario no encontrado en esta empresa" });
      return;
    }

    const passwordTemporal = crypto.randomBytes(9).toString("base64url");
    const { error } = await supabase.auth.admin.updateUserById(usuario.id, { password: passwordTemporal });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await registrarAuditoria(req.superAdminId!, "restablecer_password_usuario", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `Usuario: ${usuario.nombre} (${usuario.id})`,
    });

    res.json({ password: passwordTemporal });
  })
);

// Activa 2FA por TOTP a nombre del usuario — a diferencia del alta
// normal (mfa.ts, /totp/iniciar + /totp/confirmar), acá no hay forma
// de que el propio usuario confirme un código en el momento, así que
// el Super-Admin genera el secreto y lo entrega directo (una sola vez
// en la respuesta), igual que el reset de contraseña. Pensado para
// desbloquear una cuenta que quedó sin poder pasar su propio 2FA.
superadminRouter.post(
  "/empresas/:id/usuarios/:usuarioId/mfa/activar-totp",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, nombre, empresa_id")
      .eq("id", req.params.usuarioId)
      .eq("empresa_id", req.params.id)
      .maybeSingle();
    if (!usuario) {
      res.status(404).json({ error: "Usuario no encontrado en esta empresa" });
      return;
    }
    const { data: authUser } = await supabase.auth.admin.getUserById(usuario.id);
    const correo = authUser?.user?.email;
    if (!correo) {
      res.status(400).json({ error: "No pudimos determinar el correo de acceso de este usuario" });
      return;
    }

    const secreto = generarSecretoTotp();
    const secretoCifrado = cifrarJson({ secreto }, env.USUARIOS_MFA_ENCRYPTION_KEY, "USUARIOS_MFA_ENCRYPTION_KEY");
    const { error: errorSecreto } = await supabase.from("mfa_totp_secretos").upsert({ usuario_id: usuario.id, secreto_cifrado: secretoCifrado });
    if (errorSecreto) {
      res.status(500).json({ error: errorSecreto.message });
      return;
    }
    await supabase.from("usuarios").update({ mfa_activado: true, mfa_metodo: "totp" }).eq("id", usuario.id);

    await registrarAuditoria(req.superAdminId!, "activar_2fa_usuario", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `Usuario: ${usuario.nombre} (${usuario.id})`,
    });

    res.json({ secreto, otpauthUri: otpauthUri(secreto, correo, "Bitácora") });
  })
);

superadminRouter.post(
  "/empresas/:id/usuarios/:usuarioId/mfa/desactivar",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, nombre, empresa_id")
      .eq("id", req.params.usuarioId)
      .eq("empresa_id", req.params.id)
      .maybeSingle();
    if (!usuario) {
      res.status(404).json({ error: "Usuario no encontrado en esta empresa" });
      return;
    }

    await supabase.from("usuarios").update({ mfa_activado: false, mfa_metodo: null }).eq("id", usuario.id);
    await supabase.from("mfa_totp_secretos").delete().eq("usuario_id", usuario.id);

    await registrarAuditoria(req.superAdminId!, "desactivar_2fa_usuario", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `Usuario: ${usuario.nombre} (${usuario.id})`,
    });

    res.json({ activado: false });
  })
);

// ── Desactivar / reactivar / eliminar un usuario ─────────────────────
//
// Tres niveles, de menos a más destructivo:
//  - desactivar: usuarios.activo = false. El login sigue existiendo pero
//    toda llamada a la API responde 403 (ver empresa.ts). Reversible,
//    no toca ningún dato histórico. Es lo que se recomienda casi siempre.
//  - reactivar: lo vuelve a habilitar.
//  - eliminar: borra la fila de `usuarios` (y el login en Auth, para
//    liberar el correo). Solo se permite cuando el usuario NO tiene
//    registros que lo referencien con FK sin ON DELETE (trabajos/OS como
//    responsable, rutas planificadas, fotos subidas, informes generados)
//    — si los tiene, se responde 409 con el detalle y hay que usar
//    "desactivar". Los FK con `on delete set null` (viajes.chofer_id,
//    tareas.responsable_id, gastos.editado_por, etc.) y `on delete
//    cascade` (notificaciones, mfa, accesos_usuario…) se limpian solos.

async function esUltimoAdminActivo(empresaId: string, usuarioId: string): Promise<boolean> {
  const { data } = await supabase
    .from("usuarios")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("rol", "admin")
    .eq("activo", true);
  const ids = (data ?? []).map((u) => u.id);
  return ids.length <= 1 && ids.includes(usuarioId);
}

// Tablas con FK a usuarios(id) SIN on delete (NO ACTION) — un DELETE con
// filas acá reventaría con violación de FK. Ver la consulta de
// information_schema en docs si esto cambia con una migración futura.
const REFERENCIAS_BLOQUEANTES: { tabla: string; columna: string; etiqueta: string }[] = [
  { tabla: "trabajos", columna: "responsable_id", etiqueta: "trabajos/OS como responsable" },
  { tabla: "rutas_planificadas", columna: "responsable_id", etiqueta: "rutas planificadas" },
  { tabla: "analisis_fotos", columna: "subida_por", etiqueta: "fotos subidas" },
  { tabla: "informes_generados", columna: "usuario_id", etiqueta: "informes generados" },
];

async function referenciasBloqueantes(usuarioId: string): Promise<{ etiqueta: string; cantidad: number }[]> {
  const resultado: { etiqueta: string; cantidad: number }[] = [];
  for (const ref of REFERENCIAS_BLOQUEANTES) {
    const { count } = await supabase
      .from(ref.tabla)
      .select("*", { count: "exact", head: true })
      .eq(ref.columna, usuarioId);
    if (count && count > 0) resultado.push({ etiqueta: ref.etiqueta, cantidad: count });
  }
  return resultado;
}

async function buscarUsuarioDeEmpresa(empresaId: string, usuarioId: string) {
  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre, rol, activo, empresa_id")
    .eq("id", usuarioId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return data;
}

superadminRouter.post(
  "/empresas/:id/usuarios/:usuarioId/desactivar",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const usuario = await buscarUsuarioDeEmpresa(req.params.id, req.params.usuarioId);
    if (!usuario) {
      res.status(404).json({ error: "Usuario no encontrado en esta empresa" });
      return;
    }
    if (!usuario.activo) {
      res.json({ activo: false });
      return;
    }
    if (await esUltimoAdminActivo(req.params.id, usuario.id)) {
      res.status(409).json({ error: "Es el único administrador activo de la empresa. Deja otro admin antes de desactivarlo." });
      return;
    }

    const { error } = await supabase.from("usuarios").update({ activo: false }).eq("id", usuario.id).eq("empresa_id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    await registrarAuditoria(req.superAdminId!, "desactivar_usuario", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${usuario.nombre} (${usuario.rol}, ${usuario.id})`,
    });
    res.json({ activo: false });
  })
);

superadminRouter.post(
  "/empresas/:id/usuarios/:usuarioId/reactivar",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const usuario = await buscarUsuarioDeEmpresa(req.params.id, req.params.usuarioId);
    if (!usuario) {
      res.status(404).json({ error: "Usuario no encontrado en esta empresa" });
      return;
    }
    if (usuario.activo) {
      res.json({ activo: true });
      return;
    }

    const { error } = await supabase.from("usuarios").update({ activo: true }).eq("id", usuario.id).eq("empresa_id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    await registrarAuditoria(req.superAdminId!, "reactivar_usuario", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${usuario.nombre} (${usuario.rol}, ${usuario.id})`,
    });
    res.json({ activo: true });
  })
);

superadminRouter.delete(
  "/empresas/:id/usuarios/:usuarioId",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { confirmar } = req.body ?? {};
    const usuario = await buscarUsuarioDeEmpresa(req.params.id, req.params.usuarioId);
    if (!usuario) {
      res.status(404).json({ error: "Usuario no encontrado en esta empresa" });
      return;
    }
    if (typeof confirmar !== "string" || confirmar.trim() !== usuario.nombre) {
      res.status(400).json({ error: "Escribe el nombre exacto del usuario para confirmar" });
      return;
    }
    if (await esUltimoAdminActivo(req.params.id, usuario.id)) {
      res.status(409).json({ error: "Es el único administrador activo de la empresa. Deja otro admin antes de eliminarlo." });
      return;
    }

    const bloqueos = await referenciasBloqueantes(usuario.id);
    if (bloqueos.length > 0) {
      res.status(409).json({
        error:
          "No se puede eliminar definitivamente: el usuario tiene " +
          bloqueos.map((b) => `${b.cantidad} ${b.etiqueta}`).join(", ") +
          '. Usa "Desactivar" — le impide entrar y deja el historial intacto.',
        bloqueos,
      });
      return;
    }

    // Correo para dejarlo en la auditoría antes de que desaparezca de Auth.
    const { data: authUser } = await supabase.auth.admin.getUserById(usuario.id);
    const correo = authUser?.user?.email ?? "?";

    const { error } = await supabase.from("usuarios").delete().eq("id", usuario.id).eq("empresa_id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    // Libera el correo en Supabase Auth — mismo criterio que el rollback
    // de "invitar". Si falla, el usuario de negocio ya se borró igual.
    await supabase.auth.admin.deleteUser(usuario.id).catch((err) => {
      console.error("No se pudo borrar el usuario de Auth tras eliminar la fila de usuarios:", err);
    });

    await registrarAuditoria(req.superAdminId!, "eliminar_usuario", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${usuario.nombre} (${usuario.rol}, ${usuario.id}, ${correo})`,
    });
    res.status(204).end();
  })
);

// ── Anonimizar un titular individual (Ley 21.719, derecho de supresión) ──
// Reemplaza los datos identificatorios por un placeholder y elimina los
// datos accesorios, manteniendo la integridad referencial (los trabajos/
// OS donde figura siguen existiendo, sin nombre de persona). Irreversible.
// Exige escribir el nombre exacto para confirmar (igual que "eliminar").
superadminRouter.post(
  "/empresas/:id/usuarios/:usuarioId/anonimizar",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const usuario = await buscarUsuarioDeEmpresa(req.params.id, req.params.usuarioId);
    if (!usuario) {
      res.status(404).json({ error: "Usuario no encontrado en esta empresa" });
      return;
    }
    if (typeof req.body?.confirmar !== "string" || req.body.confirmar.trim() !== usuario.nombre) {
      res.status(400).json({ error: "Escribe el nombre exacto del usuario para confirmar" });
      return;
    }
    if (await esUltimoAdminActivo(req.params.id, usuario.id)) {
      res.status(409).json({ error: "Es el único administrador activo de la empresa. Deja otro admin antes de anonimizarlo." });
      return;
    }
    const r = await anonimizarUsuario(usuario.id);
    if (!r.ok) {
      res.status(500).json({ error: r.error });
      return;
    }
    await registrarAuditoria(req.superAdminId!, "anonimizar_usuario", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${usuario.nombre} (${usuario.rol}, ${usuario.id})`,
    });
    res.status(204).end();
  })
);

superadminRouter.post(
  "/empresas/:id/clientes/:clienteId/anonimizar",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, nombre")
      .eq("id", req.params.clienteId)
      .eq("empresa_id", req.params.id)
      .maybeSingle();
    if (!cliente) {
      res.status(404).json({ error: "Cliente no encontrado en esta empresa" });
      return;
    }
    if (typeof req.body?.confirmar !== "string" || req.body.confirmar.trim() !== cliente.nombre) {
      res.status(400).json({ error: "Escribe el nombre exacto del cliente para confirmar" });
      return;
    }
    const r = await anonimizarCliente(cliente.id);
    if (!r.ok) {
      res.status(500).json({ error: r.error });
      return;
    }
    await registrarAuditoria(req.superAdminId!, "anonimizar_cliente", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${cliente.nombre} (${cliente.id})`,
    });
    res.status(204).end();
  })
);

// ── Impersonar un usuario ────────────────────────────────────────────
// "Entrar como" un usuario para debuggear un problema reportado, sin
// conocer ni resetear su contraseña. Sensible (Ley 21.719): exige una
// justificación de texto de ≥ 20 caracteres reales, genera una sesión
// corta (30 min, ver crearTokenImpersonacion) y deja tanto el inicio
// como el fin en super_admin_auditoria con la justificación completa.
// El backend limita qué se puede hacer impersonando (requiereEmpresa,
// código IMPERSONACION_SOLO_LECTURA) y el frontend muestra un banner
// persistente.
const MIN_JUSTIFICACION = 20;

superadminRouter.post(
  "/empresas/:id/usuarios/:usuarioId/impersonar",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const justificacion = typeof req.body?.justificacion === "string" ? req.body.justificacion.trim() : "";
    if (justificacion.length < MIN_JUSTIFICACION) {
      res.status(400).json({ error: `La justificación es obligatoria y debe tener al menos ${MIN_JUSTIFICACION} caracteres.` });
      return;
    }
    // Evita "aaaaaaaaaaaaaaaaaaaa" o "                    " como relleno.
    if (new Set(justificacion.replace(/\s/g, "")).size < 5) {
      res.status(400).json({ error: "La justificación no parece real — describí el problema que estás debuggeando." });
      return;
    }

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, nombre, rol, activo, empresa_id")
      .eq("id", req.params.usuarioId)
      .eq("empresa_id", req.params.id)
      .maybeSingle();
    if (!usuario) {
      res.status(404).json({ error: "Usuario no encontrado en esta empresa" });
      return;
    }
    if (!usuario.activo) {
      res.status(400).json({ error: "Ese usuario está desactivado — no se puede impersonar." });
      return;
    }

    const { token, expiraEn } = crearTokenImpersonacion(req.superAdminId!, usuario.id);

    await registrarAuditoria(req.superAdminId!, "iniciar_impersonacion", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `Usuario: ${usuario.nombre} (${usuario.id}, ${usuario.rol}) — hasta ${expiraEn} — Justificación: ${justificacion}`,
    });

    res.json({ token, expira_en: expiraEn, usuario_nombre: usuario.nombre });
  })
);

// Fin de la impersonación — se autentica con el propio token de
// impersonación (no con la sesión de super-admin, que el frontend
// mantiene aparte). Idempotente: si el token ya venció, igual responde
// ok para que el frontend limpie su estado.
superadminRouter.post(
  "/impersonar/finalizar",
  ah(async (req, res) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
    const imp = verificarTokenImpersonacion(token);
    if (imp) {
      const { data: usuario } = await supabase.from("usuarios").select("nombre").eq("id", imp.usuarioId).maybeSingle();
      await registrarAuditoria(imp.superAdminId, "finalizar_impersonacion", {
        ip: req.ip ?? null,
        detalle: `Usuario: ${usuario?.nombre ?? "?"} (${imp.usuarioId})`,
      });
    }
    res.json({ ok: true });
  })
);

superadminRouter.get(
  "/empresas/:id/salud",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const empresaId = req.params.id;
    const { data: empresa } = await supabase.from("empresas").select("id, nombre, estado, plan, rut, dada_de_baja_en").eq("id", empresaId).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const inicioMesIso = inicioMes.toISOString();

    const [{ data: ultimoAcceso }, { data: accesosDelMes }, { count: osDelMes }, usoStorage, { data: usoIaDelMes }, { data: erroresRecientes }] =
      await Promise.all([
        supabase
          .from("accesos_usuario")
          .select("creado_en")
          .eq("empresa_id", empresaId)
          .order("creado_en", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("accesos_usuario").select("usuario_id").eq("empresa_id", empresaId).gte("creado_en", inicioMesIso),
        supabase
          .from("ordenes_servicio")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .gte("creado_en", inicioMesIso),
        medirUsoStorage(empresaId).catch(() => ({ bytesTotal: 0, incluyeAvatares: false as const })),
        supabase.from("ia_uso").select("feature, tokens_entrada, tokens_salida").eq("empresa_id", empresaId).gte("creado_en", inicioMesIso),
        supabase
          .from("errores_backend")
          .select("ruta, mensaje, creado_en")
          .eq("empresa_id", empresaId)
          .order("creado_en", { ascending: false })
          .limit(10),
      ]);

    const usuariosActivosMes = new Set((accesosDelMes ?? []).map((a) => a.usuario_id)).size;

    const porFeature: Record<string, { tokens_entrada: number; tokens_salida: number }> = {};
    let tokensEntradaTotal = 0;
    let tokensSalidaTotal = 0;
    for (const fila of usoIaDelMes ?? []) {
      tokensEntradaTotal += fila.tokens_entrada;
      tokensSalidaTotal += fila.tokens_salida;
      const actual = porFeature[fila.feature] ?? { tokens_entrada: 0, tokens_salida: 0 };
      actual.tokens_entrada += fila.tokens_entrada;
      actual.tokens_salida += fila.tokens_salida;
      porFeature[fila.feature] = actual;
    }

    await registrarAuditoria(req.superAdminId!, "ver_salud_empresa", { empresaId, ip: req.ip ?? null });

    res.json({
      empresa,
      ultima_actividad: ultimoAcceso?.creado_en ?? null,
      usuarios_activos_mes: usuariosActivosMes,
      os_creadas_mes: osDelMes ?? 0,
      almacenamiento_bytes: usoStorage.bytesTotal,
      consumo_ia_mes: { tokens_entrada: tokensEntradaTotal, tokens_salida: tokensSalidaTotal, por_feature: porFeature },
      errores_recientes: erroresRecientes ?? [],
      almacenamiento_incluye_avatares: usoStorage.incluyeAvatares,
    });
  })
);

superadminRouter.patch(
  "/empresas/:id/estado",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { estado } = req.body ?? {};
    if (typeof estado !== "string" || !ESTADOS_EMPRESA.includes(estado as EstadoEmpresa)) {
      res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_EMPRESA.join(", ")}` });
      return;
    }

    const { data: actual } = await supabase.from("empresas").select("nombre, estado").eq("id", req.params.id).maybeSingle();
    if (!actual) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    // Ley 21.719 — registra cuándo se dio de baja, para el ejercicio de
    // retención. Se limpia si vuelve a activarse.
    const cambiosEstado: { estado: EstadoEmpresa; dada_de_baja_en?: string | null } = { estado: estado as EstadoEmpresa };
    if (estado === "dada_de_baja" && actual.estado !== "dada_de_baja") cambiosEstado.dada_de_baja_en = new Date().toISOString();
    else if (estado !== "dada_de_baja") cambiosEstado.dada_de_baja_en = null;

    const { data, error } = await supabase
      .from("empresas")
      .update(cambiosEstado)
      .eq("id", req.params.id)
      .select("id, estado")
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await registrarAuditoria(req.superAdminId!, "cambiar_estado_empresa", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${actual.nombre}: ${actual.estado} → ${estado}`,
    });

    res.json(data);
  })
);

superadminRouter.patch(
  "/empresas/:id/plan",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { plan } = req.body ?? {};
    if (typeof plan !== "string" || !PLANES.includes(plan as Plan)) {
      res.status(400).json({ error: `plan debe ser uno de: ${PLANES.join(", ")}` });
      return;
    }

    const { data: actual } = await supabase.from("empresas").select("nombre, plan").eq("id", req.params.id).maybeSingle();
    if (!actual) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    // Misma función que usa la autogestión de la empresa (Configuración >
    // Plan) — sincroniza empresa_modulos y queda en empresa_plan_historial,
    // para que ningún camino pueda desincronizarse del otro.
    await cambiarPlanEmpresa(req.params.id, plan as Plan, { tipo: "super_admin", superAdminId: req.superAdminId! });

    await registrarAuditoria(req.superAdminId!, "cambiar_plan_empresa", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${actual.nombre}: ${actual.plan} → ${plan}`,
    });

    res.json({ id: req.params.id, plan });
  })
);

// No incluye el contenido de los archivos de Storage (fotos/PDFs) —
// solo las keys ya guardadas en cada fila. Nunca se renderiza en el
// panel: sale directo como descarga, así el Super-Admin no navega
// datos operativos ajenos, solo genera el archivo de portabilidad.
superadminRouter.get(
  "/empresas/:id/exportar",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const empresaId = req.params.id;
    const { data: empresa } = await supabase.from("empresas").select("*").eq("id", empresaId).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    const resultados = await Promise.all(
      TABLAS_POR_EMPRESA.map(async (tabla) => {
        const { data } = await supabase.from(tabla).select("*").eq("empresa_id", empresaId);
        return [tabla, data ?? []] as const;
      })
    );
    const datosPorTabla = Object.fromEntries(resultados);

    await registrarAuditoria(req.superAdminId!, "exportar_datos_empresa", {
      empresaId,
      ip: req.ip ?? null,
      detalle: empresa.nombre,
    });

    const nombreArchivo = `${empresa.nombre.replace(/[^a-zA-Z0-9_-]/g, "_")}-export-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
    res.json({
      generado_en: new Date().toISOString(),
      empresa,
      nota: "No incluye el contenido de fotos/PDFs de Storage, solo las referencias (keys) ya guardadas en cada fila.",
      datos: datosPorTabla,
    });
  })
);

// Irreversible a propósito — mismo patrón que la autobaja del propio
// admin (miEmpresa.ts DELETE /): exige el nombre exacto de la empresa,
// no un checkbox. El cascade real lo hacen los "on delete cascade" ya
// definidos en cada una de las 43 tablas de tenant.
superadminRouter.delete(
  "/empresas/:id",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { confirmar } = req.body ?? {};
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }
    if (typeof confirmar !== "string" || confirmar !== empresa.nombre) {
      res.status(400).json({ error: "Escribe el nombre exacto de la empresa para confirmar" });
      return;
    }

    // Se loguea el nombre como texto ANTES de borrar — el FK de
    // super_admin_auditoria.empresa_id es "on delete set null", así que
    // sin esto el registro sobreviviría sin ninguna referencia legible.
    await registrarAuditoria(req.superAdminId!, "eliminar_empresa", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: empresa.nombre,
    });

    const { error } = await supabase.from("empresas").delete().eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).end();
  })
);

superadminRouter.get(
  "/empresas/:id/modulos",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: empresa } = await supabase.from("empresas").select("id").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }
    const { data } = await supabase.from("empresa_modulos").select("modulo, activado").eq("empresa_id", req.params.id);
    const filas = new Map((data ?? []).map((f) => [f.modulo, f.activado]));
    res.json(MODULOS.map((m) => ({ modulo: m, activado: filas.has(m) ? filas.get(m)! : moduloActivadoPorDefecto(m) })));
  })
);

superadminRouter.patch(
  "/empresas/:id/modulos",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { modulo, activado } = req.body ?? {};
    if (typeof modulo !== "string" || !MODULOS.includes(modulo as Modulo) || typeof activado !== "boolean") {
      res.status(400).json({ error: "Falta modulo (válido) o activado (boolean)" });
      return;
    }
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    const { error } = await supabase
      .from("empresa_modulos")
      .upsert(
        { empresa_id: req.params.id, modulo, activado, actualizado_en: new Date().toISOString() },
        { onConflict: "empresa_id,modulo" }
      );
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await registrarAuditoria(req.superAdminId!, "cambiar_modulo_empresa", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${empresa.nombre}: ${modulo} → ${activado ? "activado" : "desactivado"}`,
    });

    res.json({ modulo, activado });
  })
);

// ── Perfiles y permisos por empresa (rol × módulo) ───────────────────
// Lo mismo que el Admin de cada empresa hace en /dashboard/configuracion/
// perfiles, pero desde el Super-Admin y para cualquier empresa (soporte).
// Guarda overrides en empresa_rol_modulos (migración 75). Límites: solo
// módulos delegables (todo menos configuración y gestión_control) y el
// rol admin no se togglea — esos casos son de la plantilla global
// (/superadmin/roles).
superadminRouter.get(
  "/empresas/:id/roles-modulos",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: empresa } = await supabase.from("empresas").select("id").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }
    const [roles, contratados] = await Promise.all([
      modulosPorRolDeEmpresa(req.params.id),
      Promise.all(
        MODULOS_DELEGABLES_POR_EMPRESA.map(async (m) => [m, await empresaTieneModulo(req.params.id, m)] as const)
      ),
    ]);
    const mapaContratado = new Map(contratados);
    res.json({
      roles: roles
        .filter((r) => r.slug !== "admin")
        .sort((a, b) => a.orden - b.orden)
        .map((r) => ({
          slug: r.slug,
          nombre: r.nombre,
          es_sistema: r.es_sistema,
          modulos: MODULOS_DELEGABLES_POR_EMPRESA.filter((m) => r.modulos.includes(m)),
        })),
      catalogo: MODULOS_DELEGABLES_POR_EMPRESA.map((m) => ({ modulo: m, contratado: mapaContratado.get(m) ?? false })),
    });
  })
);

superadminRouter.put(
  "/empresas/:id/roles-modulos/:slug",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { id, slug } = req.params;
    if (slug === "admin") {
      res.status(400).json({ error: "El rol Admin tiene acceso total y no se edita." });
      return;
    }
    const modulos = req.body?.modulos;
    if (!Array.isArray(modulos) || modulos.some((m) => typeof m !== "string")) {
      res.status(400).json({ error: "Falta la lista de módulos" });
      return;
    }
    const invalido = modulos.find((m) => !(MODULOS_DELEGABLES_POR_EMPRESA as string[]).includes(m));
    if (invalido) {
      res.status(400).json({ error: `El módulo "${invalido}" no se puede delegar desde acá.` });
      return;
    }
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }
    const disponibles = await modulosPorRolDeEmpresa(id);
    if (!disponibles.some((r) => r.slug === slug)) {
      res.status(404).json({ error: "Ese rol no está disponible para esa empresa." });
      return;
    }

    await fijarModulosDeRolEnEmpresa(id, slug, modulos);
    await registrarAuditoria(req.superAdminId!, "cambiar_perfil_empresa", {
      empresaId: id,
      ip: req.ip ?? null,
      detalle: `${empresa.nombre}: rol ${slug} → [${modulos.join(", ") || "sin módulos delegables"}]`,
    });
    res.json({ ok: true });
  })
);

// ── Feature flags (beta por empresa) ─────────────────────────────────
// Eje separado de los módulos contratados: acá se prende una feature en
// prueba para 1-2 empresas antes de que exista en el plan. El nombre del
// flag es texto libre (sin catálogo fijo). El backend expone los flags
// activos de la empresa del usuario logueado en GET /api/me.
const FLAG_REGEX = /^[a-z0-9][a-z0-9_-]{1,49}$/;

superadminRouter.get(
  "/empresas/:id/feature-flags",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data, error } = await supabase
      .from("empresa_feature_flags")
      .select("flag, activado, activado_en")
      .eq("empresa_id", req.params.id)
      .order("activado_en", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

superadminRouter.post(
  "/empresas/:id/feature-flags",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const flag = typeof req.body?.flag === "string" ? req.body.flag.trim().toLowerCase() : "";
    if (!FLAG_REGEX.test(flag)) {
      res.status(400).json({ error: "El nombre del flag debe ser 2–50 caracteres: minúsculas, números, guion y guion bajo." });
      return;
    }
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    const { error } = await supabase.from("empresa_feature_flags").upsert(
      { empresa_id: req.params.id, flag, activado: true, activado_en: new Date().toISOString(), activado_por: req.superAdminId! },
      { onConflict: "empresa_id,flag" }
    );
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await registrarAuditoria(req.superAdminId!, "activar_feature_flag", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${empresa.nombre}: ${flag}`,
    });

    res.json({ flag, activado: true });
  })
);

superadminRouter.post(
  "/empresas/:id/feature-flags/desactivar",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const flag = typeof req.body?.flag === "string" ? req.body.flag.trim().toLowerCase() : "";
    if (!flag) {
      res.status(400).json({ error: "Falta el flag" });
      return;
    }
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    // Soft: activado = false, conserva quién/cuándo lo activó. Volver a
    // prender es el mismo POST de arriba (upsert lo pone en true).
    const { error } = await supabase
      .from("empresa_feature_flags")
      .update({ activado: false })
      .eq("empresa_id", req.params.id)
      .eq("flag", flag);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await registrarAuditoria(req.superAdminId!, "desactivar_feature_flag", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${empresa.nombre}: ${flag}`,
    });

    res.json({ flag, activado: false });
  })
);

// ── Correos y dominios autorizados por empresa (migración 72) ────────
// Un correo/dominio de esta lista puede entrar a la empresa aunque no
// haya sido invitado — el backend le crea la fila en `usuarios` con el
// rol indicado la primera vez que entra (ver accesosAutorizados.ts).
superadminRouter.get(
  "/empresas/:id/accesos",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: empresa } = await supabase.from("empresas").select("id").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }
    const [{ data: accesos }, roles] = await Promise.all([
      supabase
        .from("empresa_accesos_autorizados")
        .select("id, tipo, valor, rol, creado_en")
        .eq("empresa_id", req.params.id)
        .order("creado_en", { ascending: false }),
      rolesDeEmpresa(req.params.id),
    ]);
    res.json({ accesos: accesos ?? [], roles: roles.map((r) => ({ slug: r.slug, nombre: r.nombre })) });
  })
);

superadminRouter.post(
  "/empresas/:id/accesos",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }
    const v = validarValorAcceso(req.body?.tipo, req.body?.valor);
    if (!v.ok) {
      res.status(400).json({ error: v.error });
      return;
    }
    const rol = typeof req.body?.rol === "string" && req.body.rol ? req.body.rol : "colaborador";
    if (!(await empresaPuedeUsarRol(rol, req.params.id))) {
      res.status(400).json({ error: "El rol indicado no está disponible para esta empresa" });
      return;
    }

    const { error } = await supabase.from("empresa_accesos_autorizados").insert({
      empresa_id: req.params.id,
      tipo: v.tipo,
      valor: v.valor,
      rol,
      creado_por: req.superAdminId!,
    });
    if (error) {
      res.status(error.code === "23505" ? 409 : 500).json({
        error: error.code === "23505" ? "Ese correo o dominio ya está en la lista" : error.message,
      });
      return;
    }
    await registrarAuditoria(req.superAdminId!, "autorizar_acceso_empresa", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${empresa.nombre}: ${v.tipo} ${v.valor} (${rol})`,
    });
    res.status(201).json({ ok: true });
  })
);

superadminRouter.delete(
  "/empresas/:id/accesos/:accesoId",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: acceso } = await supabase
      .from("empresa_accesos_autorizados")
      .select("id, tipo, valor")
      .eq("id", req.params.accesoId)
      .eq("empresa_id", req.params.id)
      .maybeSingle();
    if (!acceso) {
      res.status(404).json({ error: "Autorización no encontrada" });
      return;
    }
    const { error } = await supabase.from("empresa_accesos_autorizados").delete().eq("id", acceso.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    await registrarAuditoria(req.superAdminId!, "revocar_acceso_empresa", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${acceso.tipo} ${acceso.valor}`,
    });
    res.json({ ok: true });
  })
);

// Suscripción B2B (cobro recurrente a esta empresa) — solo lectura +
// extender el trial acá; cambiar el estado de facturación en sí lo hace
// exclusivamente el webhook de Flow (backend/src/routes/flowWebhook.ts),
// nunca a mano, para que el estado real de Flow y el de Bitácora no se
// desincronicen.
superadminRouter.get(
  "/empresas/:id/suscripcion",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: empresa } = await supabase.from("empresas").select("id, prueba_termina_en").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }
    const { data: suscripcion } = await supabase.from("suscripciones").select("*").eq("empresa_id", req.params.id).maybeSingle();
    const { data: cobros } = await supabase
      .from("suscripcion_cobros")
      .select("*")
      .eq("empresa_id", req.params.id)
      .order("creado_en", { ascending: false })
      .limit(24);
    res.json({ prueba_termina_en: empresa.prueba_termina_en, suscripcion: suscripcion ?? null, cobros: cobros ?? [] });
  })
);

superadminRouter.patch(
  "/empresas/:id/prueba",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { prueba_termina_en } = req.body ?? {};
    if (typeof prueba_termina_en !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(prueba_termina_en)) {
      res.status(400).json({ error: "prueba_termina_en debe ser una fecha YYYY-MM-DD" });
      return;
    }
    const { data: empresa } = await supabase.from("empresas").select("nombre, prueba_termina_en").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }
    const { error } = await supabase.from("empresas").update({ prueba_termina_en }).eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    await registrarAuditoria(req.superAdminId!, "extender_prueba_empresa", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${empresa.nombre}: ${empresa.prueba_termina_en ?? "—"} → ${prueba_termina_en}`,
    });
    res.json({ prueba_termina_en });
  })
);

// ── Roles editables (tabla `roles`, migración 71) ────────────────────
// El Super-Admin edita qué módulos y qué acciones sensibles tiene cada
// rol, crea roles nuevos, y puede restringir un rol a empresas puntuales
// (rol_empresas). Los 4 roles de sistema no se borran ni se renombra su
// slug; `admin` además no se edita (acceso total siempre).
const SLUG_ROL_REGEX = /^[a-z][a-z0-9_]{1,30}$/;
const ROLES_SISTEMA_SLUGS = ["admin", "supervisor", "contador", "colaborador"];

function sanearListaModulos(valor: unknown): Modulo[] | null {
  if (!Array.isArray(valor)) return null;
  const set = new Set<string>();
  for (const v of valor) {
    if (typeof v !== "string" || !MODULOS.includes(v as Modulo)) return null;
    set.add(v);
  }
  return [...set] as Modulo[];
}

function sanearListaAcciones(valor: unknown): Accion[] | null {
  if (!Array.isArray(valor)) return null;
  const set = new Set<string>();
  for (const v of valor) {
    if (typeof v !== "string" || !ACCIONES.includes(v as Accion)) return null;
    set.add(v);
  }
  return [...set] as Accion[];
}

superadminRouter.get(
  "/roles",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (_req, res) => {
    const [{ data: roles }, { data: restr }, { data: empresas }, { data: usuarios }] = await Promise.all([
      supabase.from("roles").select("*").order("orden"),
      supabase.from("rol_empresas").select("rol_slug, empresa_id"),
      supabase.from("empresas").select("id, nombre").order("nombre"),
      supabase.from("usuarios").select("rol"),
    ]);

    const porRol = new Map<string, string[]>();
    for (const f of restr ?? []) {
      if (!porRol.has(f.rol_slug)) porRol.set(f.rol_slug, []);
      porRol.get(f.rol_slug)!.push(f.empresa_id);
    }
    const conteo = new Map<string, number>();
    for (const u of usuarios ?? []) conteo.set(u.rol, (conteo.get(u.rol) ?? 0) + 1);

    res.json({
      roles: (roles ?? []).map((r) => ({
        ...r,
        empresas: porRol.get(r.slug) ?? [],
        usuarios: conteo.get(r.slug) ?? 0,
      })),
      empresas: empresas ?? [],
      catalogo: { modulos: [...MODULOS], acciones: [...ACCIONES] },
    });
  })
);

superadminRouter.post(
  "/roles",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { slug, nombre } = req.body ?? {};
    const slugLimpio = typeof slug === "string" ? slug.trim().toLowerCase() : "";
    if (!SLUG_ROL_REGEX.test(slugLimpio)) {
      res.status(400).json({ error: "El identificador debe ser 2–31 caracteres: minúsculas, números y guion bajo, empezando por letra." });
      return;
    }
    if (ROLES_SISTEMA_SLUGS.includes(slugLimpio)) {
      res.status(400).json({ error: "Ese identificador está reservado para un rol de sistema." });
      return;
    }
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta el nombre del rol" });
      return;
    }
    const modulos = sanearListaModulos(req.body?.modulos ?? []);
    const acciones = sanearListaAcciones(req.body?.acciones ?? []);
    if (!modulos || !acciones) {
      res.status(400).json({ error: "Lista de módulos o acciones inválida" });
      return;
    }

    const { data: existe } = await supabase.from("roles").select("slug").eq("slug", slugLimpio).maybeSingle();
    if (existe) {
      res.status(409).json({ error: "Ya existe un rol con ese identificador" });
      return;
    }

    const { error } = await supabase.from("roles").insert({
      slug: slugLimpio,
      nombre: nombre.trim(),
      modulos,
      acciones,
      requiere_2fa: Boolean(req.body?.requiere_2fa),
      es_sistema: false,
      orden: 100,
    });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    invalidarCacheRoles();
    await registrarAuditoria(req.superAdminId!, "crear_rol", { ip: req.ip ?? null, detalle: `${slugLimpio} (${nombre.trim()})` });
    res.status(201).json({ slug: slugLimpio });
  })
);

superadminRouter.patch(
  "/roles/:slug",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: rol } = await supabase.from("roles").select("*").eq("slug", req.params.slug).maybeSingle();
    if (!rol) {
      res.status(404).json({ error: "Rol no encontrado" });
      return;
    }
    if (rol.slug === "admin") {
      res.status(400).json({ error: "El rol Admin tiene acceso total y no es editable." });
      return;
    }

    const cambios: Record<string, unknown> = { actualizado_en: new Date().toISOString() };
    if (req.body?.nombre !== undefined) {
      if (typeof req.body.nombre !== "string" || !req.body.nombre.trim()) {
        res.status(400).json({ error: "Nombre inválido" });
        return;
      }
      cambios.nombre = req.body.nombre.trim();
    }
    if (req.body?.modulos !== undefined) {
      const modulos = sanearListaModulos(req.body.modulos);
      if (!modulos) {
        res.status(400).json({ error: "Lista de módulos inválida" });
        return;
      }
      cambios.modulos = modulos;
    }
    if (req.body?.acciones !== undefined) {
      const acciones = sanearListaAcciones(req.body.acciones);
      if (!acciones) {
        res.status(400).json({ error: "Lista de acciones inválida" });
        return;
      }
      cambios.acciones = acciones;
    }
    if (req.body?.requiere_2fa !== undefined) cambios.requiere_2fa = Boolean(req.body.requiere_2fa);

    const { error } = await supabase.from("roles").update(cambios as never).eq("slug", rol.slug);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    invalidarCacheRoles();
    await registrarAuditoria(req.superAdminId!, "editar_rol", { ip: req.ip ?? null, detalle: rol.slug });
    res.json({ slug: rol.slug });
  })
);

superadminRouter.delete(
  "/roles/:slug",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: rol } = await supabase.from("roles").select("slug, es_sistema, nombre").eq("slug", req.params.slug).maybeSingle();
    if (!rol) {
      res.status(404).json({ error: "Rol no encontrado" });
      return;
    }
    if (rol.es_sistema) {
      res.status(400).json({ error: "Los roles de sistema no se pueden borrar." });
      return;
    }
    const { count } = await supabase.from("usuarios").select("id", { count: "exact", head: true }).eq("rol", rol.slug as never);
    if ((count ?? 0) > 0) {
      res.status(409).json({ error: `Hay ${count} usuario(s) con este rol. Reasígnalos antes de borrarlo.` });
      return;
    }
    const { error } = await supabase.from("roles").delete().eq("slug", rol.slug);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    invalidarCacheRoles();
    await registrarAuditoria(req.superAdminId!, "borrar_rol", { ip: req.ip ?? null, detalle: `${rol.slug} (${rol.nombre})` });
    res.json({ ok: true });
  })
);

// Restringe un rol a empresas puntuales. Lista vacía = disponible para
// todas las empresas (borra todas las filas de rol_empresas del slug).
superadminRouter.put(
  "/roles/:slug/empresas",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: rol } = await supabase.from("roles").select("slug").eq("slug", req.params.slug).maybeSingle();
    if (!rol) {
      res.status(404).json({ error: "Rol no encontrado" });
      return;
    }
    const ids = req.body?.empresa_ids;
    if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) {
      res.status(400).json({ error: "empresa_ids debe ser una lista de IDs" });
      return;
    }
    const unicos = [...new Set(ids as string[])];
    if (unicos.length > 0) {
      const { data: existentes } = await supabase.from("empresas").select("id").in("id", unicos);
      if ((existentes ?? []).length !== unicos.length) {
        res.status(400).json({ error: "Alguna empresa indicada no existe" });
        return;
      }
    }

    const { error: errBorrar } = await supabase.from("rol_empresas").delete().eq("rol_slug", rol.slug);
    if (errBorrar) {
      res.status(500).json({ error: errBorrar.message });
      return;
    }
    if (unicos.length > 0) {
      const { error: errInsertar } = await supabase
        .from("rol_empresas")
        .insert(unicos.map((empresa_id) => ({ rol_slug: rol.slug, empresa_id })));
      if (errInsertar) {
        res.status(500).json({ error: errInsertar.message });
        return;
      }
    }
    invalidarCacheRoles();
    await registrarAuditoria(req.superAdminId!, "restringir_rol_empresas", {
      ip: req.ip ?? null,
      detalle: `${rol.slug}: ${unicos.length === 0 ? "todas las empresas" : `${unicos.length} empresa(s)`}`,
    });
    res.json({ empresa_ids: unicos });
  })
);
