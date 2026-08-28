import { Router } from "express";
import multer from "multer";
import type { Rol, Usuario } from "@bitacora/shared";
import { supabase } from "../supabase";
import { subirFotoPerfil } from "../storage";
import { env } from "../env";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const usuariosRouter = Router();

const ROLES: Rol[] = ["admin", "contador", "chofer"];
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
// por correo. Solo el admin de la empresa puede invitar. Supabase manda
// el correo con el link para que la persona defina su contraseña.
usuariosRouter.post(
  "/invitar",
  ah<RequestConEmpresa>(async (req, res) => {
    if (req.rol !== "admin") {
      res.status(403).json({ error: "Solo un admin puede invitar usuarios" });
      return;
    }

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

    const { data: invitado, error: errorInvitar } = await supabase.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: `${env.WEB_URL}/invitacion` }
    );

    if (errorInvitar || !invitado.user) {
      res.status(400).json({ error: errorInvitar?.message ?? "No se pudo invitar al usuario" });
      return;
    }

    const { data: usuario, error: errorUsuario } = await supabase
      .from("usuarios")
      .insert({
        id: invitado.user.id,
        empresa_id: req.empresaId!,
        nombre: nombre.trim(),
        rol,
      })
      .select()
      .single();

    if (errorUsuario) {
      // limpiar el auth user huérfano si falla la vinculación a la empresa
      await supabase.auth.admin.deleteUser(invitado.user.id);
      res.status(500).json({ error: errorUsuario.message });
      return;
    }

    res.status(201).json(usuario);
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

usuariosRouter.post(
  "/me/foto",
  uploadFoto.single("foto"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "Falta el archivo (campo 'foto')" });
      return;
    }

    const fotoUrl = await subirFotoPerfil(req.userId!, req.file.buffer, req.file.mimetype);

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
