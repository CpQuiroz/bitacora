// ============================================================
// BITÁCORA — Perfiles por empresa. El Admin de cada empresa ajusta qué
// módulos ve cada rol DENTRO de su empresa, sin tocar la plantilla
// global del rol (eso sigue siendo solo del Super-Admin).
//
// Guarda overrides en empresa_rol_modulos (migración 75). El gating de
// plan (empresa_modulos) se aplica igual después — activar un módulo
// acá no lo hace visible si la empresa no lo tiene contratado.
// ============================================================
import { Router } from "express";
import { MODULOS_DELEGABLES_POR_EMPRESA } from "@bitacora/shared";
import { ah } from "../asyncHandler";
import type { RequestConEmpresa } from "../empresa";
import { empresaTieneModulo, requiereRol } from "../permisos";
import { fijarModulosDeRolEnEmpresa, modulosPorRolDeEmpresa } from "../roles";

export const empresaRolesRouter = Router();

// Solo el Admin de la empresa. (Supervisor administra su gente pero no
// redefine qué ve cada rol.)
empresaRolesRouter.use(requiereRol("admin"));

const DELEGABLES = new Set<string>(MODULOS_DELEGABLES_POR_EMPRESA);

empresaRolesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const empresaId = req.empresaId!;
    const [roles, contratados] = await Promise.all([
      modulosPorRolDeEmpresa(empresaId),
      Promise.all(
        MODULOS_DELEGABLES_POR_EMPRESA.map(async (m) => [m, await empresaTieneModulo(empresaId, m)] as const)
      ),
    ]);
    const mapaContratado = new Map(contratados);

    res.json({
      // El rol admin no se togglea: se muestra informativo, sin controles.
      roles: roles
        .filter((r) => r.slug !== "admin")
        .sort((a, b) => a.orden - b.orden)
        .map((r) => ({
          slug: r.slug,
          nombre: r.nombre,
          es_sistema: r.es_sistema,
          // Solo los módulos delegables y su estado efectivo en esta empresa.
          modulos: MODULOS_DELEGABLES_POR_EMPRESA.filter((m) => r.modulos.includes(m)),
        })),
      catalogo: MODULOS_DELEGABLES_POR_EMPRESA.map((m) => ({
        modulo: m,
        contratado: mapaContratado.get(m) ?? false,
      })),
    });
  })
);

empresaRolesRouter.put(
  "/:slug/modulos",
  ah<RequestConEmpresa>(async (req, res) => {
    const empresaId = req.empresaId!;
    const slug = req.params.slug;

    if (slug === "admin") {
      res.status(400).json({ error: "El rol Admin tiene acceso total y no se edita." });
      return;
    }

    const modulos = req.body?.modulos;
    if (!Array.isArray(modulos) || modulos.some((m) => typeof m !== "string")) {
      res.status(400).json({ error: "Falta la lista de módulos" });
      return;
    }
    const invalido = modulos.find((m) => !DELEGABLES.has(m));
    if (invalido) {
      res.status(400).json({ error: `El módulo "${invalido}" no se puede delegar desde acá.` });
      return;
    }

    // El rol tiene que ser uno que esta empresa pueda usar.
    const disponibles = await modulosPorRolDeEmpresa(empresaId);
    if (!disponibles.some((r) => r.slug === slug)) {
      res.status(404).json({ error: "Ese rol no está disponible para tu empresa." });
      return;
    }

    await fijarModulosDeRolEnEmpresa(empresaId, slug, modulos);
    res.json({ ok: true });
  })
);
