// ============================================================
// Configuración › Módulos (tarea 124, etapa 3): el Admin de la empresa
// (acción gestionar_plan) elige qué secciones usar dentro del tope de
// su plan, y puede pedir más al equipo de Bitácora. Solo las secciones
// que cuentan para el tope (MODULOS_CONTABLES): la IA y la base las
// maneja el Super-Admin.
// ============================================================
import { Router } from "express";
import type { Modulo } from "@bitacora/shared";
import { ETIQUETA_PLAN, LIMITES_POR_PLAN, MODULOS_CONTABLES, cuentaParaTope } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereAccion } from "../permisos";
import { cambiarModuloEmpresa, modulosActivosContables, obtenerPlan } from "../limites";
import { avisarSuperAdmins, escaparHtml } from "../avisosSuperAdmin";
import { limitarSolicitudesSuperAdmin } from "../rateLimiters";

export const modulosRouter = Router();

modulosRouter.use(requiereAccion("gestionar_plan"));

async function estado(empresaId: string) {
  const [plan, activos] = await Promise.all([obtenerPlan(empresaId), modulosActivosContables(empresaId)]);
  const activosSet = new Set(activos);
  return {
    plan,
    modulosMax: LIMITES_POR_PLAN[plan].modulosMax,
    activos: activos.length,
    modulos: MODULOS_CONTABLES.map((modulo) => ({ modulo, activado: activosSet.has(modulo) })),
  };
}

modulosRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    res.json(await estado(req.empresaId!));
  })
);

modulosRouter.patch(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { modulo, activado } = req.body ?? {};
    if (typeof modulo !== "string" || !cuentaParaTope(modulo as Modulo) || typeof activado !== "boolean") {
      res.status(400).json({ error: "Falta un módulo válido o activado (true/false)" });
      return;
    }
    // Chequeo del tope y guardado juntos en la base → 403 LIMITE_PLAN.
    await cambiarModuloEmpresa(req.empresaId!, modulo as Modulo, activado);
    res.json(await estado(req.empresaId!));
  })
);

// "Solicitar más módulos": correo a los Super-Admin con los módulos que
// la empresa quiere sumar. Ellos le responden (subir de plan o ajustar).
modulosRouter.post(
  "/solicitar",
  limitarSolicitudesSuperAdmin,
  ah<RequestConEmpresa>(async (req, res) => {
    const pedidos = Array.isArray(req.body?.modulos)
      ? (req.body.modulos as unknown[]).filter((m): m is Modulo => typeof m === "string" && cuentaParaTope(m as Modulo))
      : [];
    const mensaje = typeof req.body?.mensaje === "string" ? req.body.mensaje.trim().slice(0, 2000) : "";
    if (pedidos.length === 0 && !mensaje) {
      res.status(400).json({ error: "Elige al menos un módulo o escribe qué necesitas" });
      return;
    }

    const [{ data: empresa }, info, { data: authUser }] = await Promise.all([
      supabase.from("empresas").select("nombre, rut").eq("id", req.empresaId!).maybeSingle(),
      estado(req.empresaId!),
      supabase.auth.admin.getUserById(req.userId!),
    ]);
    const correo = authUser?.user?.email ?? null;
    const nombreEmpresa = empresa?.nombre ?? "Empresa";
    const tope = info.modulosMax == null ? "sin tope" : `${info.activos} de ${info.modulosMax}`;
    const html = `
      <div style="font-family:sans-serif;max-width:560px;">
        <h2>Solicitud de más módulos</h2>
        <p><b>Empresa:</b> ${escaparHtml(nombreEmpresa)}${empresa?.rut ? ` (${escaparHtml(empresa.rut)})` : ""}</p>
        <p><b>Plan:</b> ${escaparHtml(ETIQUETA_PLAN[info.plan])} · <b>módulos activos:</b> ${escaparHtml(tope)}</p>
        ${pedidos.length ? `<p><b>Quiere sumar:</b> ${pedidos.map((m) => escaparHtml(m)).join(", ")}</p>` : ""}
        <p><b>Contacto:</b> ${escaparHtml(correo ?? "(sin correo)")}</p>
        ${mensaje ? `<p><b>Mensaje:</b><br>${escaparHtml(mensaje).replace(/\n/g, "<br>")}</p>` : ""}
      </div>`;
    try {
      await avisarSuperAdmins(`Más módulos — ${nombreEmpresa}`, html, correo, "la solicitud de módulos");
    } catch (err) {
      console.error("modulos/solicitar:", err);
      res.status(502).json({ error: "No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos." });
      return;
    }
    res.status(201).json({ ok: true });
  })
);
