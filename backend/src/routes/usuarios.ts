import { Router } from "express";
import type { Rol } from "@bitacora/shared";
import { supabase } from "../supabase";
import { env } from "../env";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const usuariosRouter = Router();

const ROLES: Rol[] = ["admin", "contador", "chofer"];

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
