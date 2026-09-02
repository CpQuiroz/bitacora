import { Router } from "express";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { rolesDeEmpresa, empresaPuedeUsarRol } from "../roles";
import { validarValorAcceso } from "../accesosAutorizados";

// Correos y dominios autorizados de la PROPIA empresa (migración 72).
// Mismo dato que gestiona el Super-Admin en la ficha de la empresa,
// pero acá scopeado a req.empresaId. Se monta con
// requiereModulo("gestion_control") — hoy = admin.
export const accesosRouter = Router();

accesosRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const [{ data: accesos }, roles] = await Promise.all([
      supabase
        .from("empresa_accesos_autorizados")
        .select("id, tipo, valor, rol, creado_en")
        .eq("empresa_id", req.empresaId!)
        .order("creado_en", { ascending: false }),
      rolesDeEmpresa(req.empresaId!),
    ]);
    res.json({ accesos: accesos ?? [], roles: roles.map((r) => ({ slug: r.slug, nombre: r.nombre })) });
  })
);

accesosRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const v = validarValorAcceso(req.body?.tipo, req.body?.valor);
    if (!v.ok) {
      res.status(400).json({ error: v.error });
      return;
    }
    const rol = typeof req.body?.rol === "string" && req.body.rol ? req.body.rol : "colaborador";
    if (!(await empresaPuedeUsarRol(rol, req.empresaId!))) {
      res.status(400).json({ error: "El rol indicado no está disponible para tu empresa" });
      return;
    }

    const { error } = await supabase.from("empresa_accesos_autorizados").insert({
      empresa_id: req.empresaId!,
      tipo: v.tipo,
      valor: v.valor,
      rol,
      creado_por: req.userId!,
    });
    if (error) {
      res.status(error.code === "23505" ? 409 : 500).json({
        error: error.code === "23505" ? "Ese correo o dominio ya está en la lista" : error.message,
      });
      return;
    }
    res.status(201).json({ ok: true });
  })
);

accesosRouter.delete(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: acceso } = await supabase
      .from("empresa_accesos_autorizados")
      .select("id")
      .eq("id", req.params.id)
      .eq("empresa_id", req.empresaId!)
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
    res.json({ ok: true });
  })
);
