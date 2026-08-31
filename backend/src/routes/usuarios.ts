import { Router } from "express";
import multer from "multer";
import type { Rol, Usuario } from "@bitacora/shared";
import { supabase } from "../supabase";
import { subirFotoPerfil } from "../storage";
import { env } from "../env";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";
import { equipoAsignadoAColaborador } from "./equipos";
import { enviarInvitacion } from "../email";
import { limitarInvitacion } from "../rateLimiters";
import { verificarLimiteUsuarios } from "../limites";

export const usuariosRouter = Router();

const ROLES: Rol[] = ["admin", "supervisor", "contador", "colaborador"];
// Sin lista curada — un huso IANA cualquiera sirve, se valida solo el formato.
const HUSO_REGEX = /^[A-Za-z]+(?:[/_][A-Za-z_]+)+$|^GMT[+-]\d{1,2}$/;

const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(new Error("Formato de imagen no soportado (usa jpeg, png o webp)"));
      return;
    }
    cb(null, true);
  },
});

usuariosRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("nombre");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

// Invita a un nuevo miembro del equipo (chofer, técnico, contador...)
// por correo. Solo el admin de la empresa puede invitar — el correo
// con el link para definir la contraseña se manda vía Resend (ver
// enviarInvitacion en email.ts).
usuariosRouter.post(
  "/invitar",
  limitarInvitacion,
  requiereModulo("gestion_control"),
  ah<RequestConEmpresa>(async (req, res) => {

    const { email, nombre, rol } = req.body ?? {};
    if (typeof email !== "string" || !email.includes("@")) {
      res.status(400).json({ error: "Correo inválido" });
      return;
    }
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    if (!ROLES.includes(rol)) {
      res.status(400).json({ error: `rol debe ser uno de: ${ROLES.join(", ")}` });
      return;
    }
    await verificarLimiteUsuarios(req.empresaId!);

    // generateLink crea el usuario y devuelve el link de invitación sin
    // intentar mandar nada — el envío en sí va por nuestro Resend (ver
    // enviarInvitacion), no por el servicio de correo integrado de
    // Supabase Auth (inviteUserByEmail), que tiene un límite de envíos
    // pensado solo para desarrollo y no es apto para producción.
    const { data: generado, error: errorGenerar } = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${env.WEB_URL}/invitacion` },
    });
    if (errorGenerar || !generado.user) {
      console.error("Error generando link de invitación:", errorGenerar);
      res.status(400).json({ error: "No se pudo invitar al usuario. Verifica que el correo sea válido e intenta de nuevo." });
      return;
    }

    const { data: empresaFila } = await supabase.from("empresas").select("nombre").eq("id", req.empresaId!).maybeSingle();
    try {
      await enviarInvitacion(email, empresaFila?.nombre ?? "Bitácora", nombre.trim(), generado.properties.action_link);
    } catch (err) {
      await supabase.auth.admin.deleteUser(generado.user.id);
      const mensaje = err instanceof Error ? err.message : String(err);
      console.error("Error enviando invitación:", mensaje);
      res.status(mensaje.includes("no está configurado") ? 500 : 502).json({
        error: mensaje.includes("no está configurado")
          ? "El envío de correos no está configurado en este ambiente."
          : "No pudimos enviar la invitación. Puede ser un problema temporal del servicio de correo — intenta de nuevo en unos minutos o contacta a soporte.",
      });
      return;
    }

    const { data: usuario, error: errorUsuario } = await supabase
      .from("usuarios")
      .insert({
        id: generado.user.id,
        empresa_id: req.empresaId!,
        nombre: nombre.trim(),
        rol,
      })
      .select()
      .single();

    if (errorUsuario) {
      // limpiar el auth user huérfano si falla la vinculación a la empresa
      await supabase.auth.admin.deleteUser(generado.user.id);
      res.status(500).json({ error: errorUsuario.message });
      return;
    }

    res.status(201).json(usuario);
  })
);

// Gestión y Control: cambiar el rol o activar/desactivar a un miembro
// del equipo. Cada campo que cambia deja una fila en auditoria_usuarios
// con quién lo hizo y el valor anterior/nuevo.
usuariosRouter.patch(
  "/:id",
  requiereModulo("gestion_control"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (req.params.id === req.userId) {
      res.status(400).json({ error: "No puedes cambiar tu propio rol o estado" });
      return;
    }

    const { rol, activo, fecha_vencimiento_licencia } = req.body ?? {};
    const { data: actual, error: errorActual } = await supabase
      .from("usuarios")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (errorActual) {
      res.status(500).json({ error: errorActual.message });
      return;
    }
    if (!actual) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    const cambios: Partial<Usuario> = {};
    const cambiosAuditoria: { campo: "rol" | "activo"; anterior: string | null; nuevo: string | null }[] = [];

    if (rol !== undefined) {
      if (!ROLES.includes(rol)) {
        res.status(400).json({ error: `rol debe ser uno de: ${ROLES.join(", ")}` });
        return;
      }
      if (rol !== actual.rol) {
        cambios.rol = rol;
        cambiosAuditoria.push({ campo: "rol", anterior: actual.rol, nuevo: rol });
      }
    }
    if (activo !== undefined) {
      const activoBool = Boolean(activo);
      if (activoBool !== actual.activo) {
        cambios.activo = activoBool;
        cambiosAuditoria.push({ campo: "activo", anterior: String(actual.activo), nuevo: String(activoBool) });
      }
    }
    if (fecha_vencimiento_licencia !== undefined) {
      cambios.fecha_vencimiento_licencia = fecha_vencimiento_licencia || null;
    }

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("usuarios")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (cambiosAuditoria.length > 0) {
      await supabase.from("auditoria_usuarios").insert(
        cambiosAuditoria.map((c) => ({
          empresa_id: req.empresaId!,
          usuario_afectado_id: req.params.id,
          realizado_por_id: req.userId!,
          campo: c.campo,
          valor_anterior: c.anterior,
          valor_nuevo: c.nuevo,
        }))
      );
    }

    res.json(data);
  })
);

// Zona/área de cobertura — dato operativo de Flota, no de Gestión y
// Control (rol/activo), por eso vive en su propio endpoint gateado por
// "flota" — Supervisor administra Flota pero no tiene gestion_control.
usuariosRouter.patch(
  "/:id/zona",
  requiereModulo("flota"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { zona } = req.body ?? {};
    const { data, error } = await supabase
      .from("usuarios")
      .update({ zona: zona?.trim() || null })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select()
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }
    res.json(data);
  })
);

// Historial de cambios de rol/estado — Gestión y Control.
usuariosRouter.get(
  "/auditoria",
  requiereModulo("gestion_control"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("auditoria_usuarios")
      .select("*, usuario_afectado:usuarios!auditoria_usuarios_usuario_afectado_id_fkey(nombre), realizado_por:usuarios!auditoria_usuarios_realizado_por_id_fkey(nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("creado_en", { ascending: false })
      .limit(100);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

// Vehículo actualmente asignado al usuario logueado — self-service, sin
// el módulo "flota" (un colaborador no puede listar TODOS los
// vehículos, pero sí necesita ver el suyo).
usuariosRouter.get(
  "/me/vehiculo",
  ah<RequestConEmpresa>(async (req, res) => {
    res.json(await equipoAsignadoAColaborador(req.empresaId!, req.userId!));
  })
);

const IDIOMAS = ["es", "en", "pt"];

// Perfil del propio usuario logueado — a diferencia del resto de este
// router (que administra al EQUIPO, requiere admin), esto lo edita
// cualquiera sobre su propia fila, identificada por req.userId.
usuariosRouter.patch(
  "/me",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, telefono, idioma, pais, huso_horario } = req.body ?? {};
    const cambios: Partial<Usuario> = {};

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (telefono !== undefined) cambios.telefono = telefono?.trim() || null;
    if (idioma !== undefined) {
      if (!IDIOMAS.includes(idioma)) {
        res.status(400).json({ error: `idioma debe ser uno de: ${IDIOMAS.join(", ")}` });
        return;
      }
      cambios.idioma = idioma;
    }
    if (pais !== undefined) {
      if (typeof pais !== "string" || !/^[A-Z]{2}$/.test(pais)) {
        res.status(400).json({ error: "pais debe ser un código ISO de 2 letras (ej: CL)" });
        return;
      }
      cambios.pais = pais;
    }
    if (huso_horario !== undefined) {
      if (typeof huso_horario !== "string" || !HUSO_REGEX.test(huso_horario)) {
        res.status(400).json({ error: "huso_horario inválido" });
        return;
      }
      cambios.huso_horario = huso_horario;
    }
    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    // tenant-ok: acota por req.userId!, más estricto que empresa_id
    // (solo la propia fila del usuario logueado, no toda la empresa).
    const { data, error } = await supabase
      .from("usuarios")
      .update(cambios)
      .eq("id", req.userId!)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

// Historial de accesos propio — Seguridad. Cada quien ve solo el suyo.
// tenant-ok: acota por req.userId! (más estricto que empresa_id).
usuariosRouter.get(
  "/me/accesos",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("accesos_usuario")
      .select("*")
      .eq("usuario_id", req.userId!)
      .order("creado_en", { ascending: false })
      .limit(20);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

usuariosRouter.post(
  "/me/foto",
  uploadFoto.single("foto"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "Falta el archivo (campo 'foto')" });
      return;
    }

    const fotoUrl = await subirFotoPerfil(req.userId!, req.file.buffer, req.file.mimetype);

    // tenant-ok: acota por req.userId! (más estricto que empresa_id).
    const { data, error } = await supabase
      .from("usuarios")
      .update({ foto_url: fotoUrl })
      .eq("id", req.userId!)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);
