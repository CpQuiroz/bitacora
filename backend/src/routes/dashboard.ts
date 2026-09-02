import { Router } from "express";
import {
  estadoOT,
  estadoPresupuestos,
  ingresosPorMes,
  ingresosVsGastos,
  kpis,
  resumenFinanciero,
  resumenGastos,
} from "../agregacionesDashboard";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereRol } from "../permisos";

export const dashboardRouter = Router();

const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function resolverPeriodo(periodo: string | undefined, desdeQuery: unknown, hastaQuery: unknown) {
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  switch (periodo) {
    case "hoy":
      return { desde: fmt(inicioHoy), hasta: fmt(inicioHoy) };
    case "ayer": {
      const ayer = new Date(inicioHoy);
      ayer.setDate(ayer.getDate() - 1);
      return { desde: fmt(ayer), hasta: fmt(ayer) };
    }
    case "7d": {
      const d = new Date(inicioHoy);
      d.setDate(d.getDate() - 6);
      return { desde: fmt(d), hasta: fmt(inicioHoy) };
    }
    case "30d": {
      const d = new Date(inicioHoy);
      d.setDate(d.getDate() - 29);
      return { desde: fmt(d), hasta: fmt(inicioHoy) };
    }
    case "mes_pasado": {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      return { desde: fmt(inicio), hasta: fmt(fin) };
    }
    case "este_anio": {
      const inicio = new Date(hoy.getFullYear(), 0, 1);
      return { desde: fmt(inicio), hasta: fmt(inicioHoy) };
    }
    case "personalizado": {
      if (typeof desdeQuery === "string" && typeof hastaQuery === "string" && desdeQuery && hastaQuery) {
        return { desde: desdeQuery, hasta: hastaQuery };
      }
      // Sin rango válido, cae al mismo default que "este_mes".
    }
    // eslint-disable-next-line no-fallthrough
    case "este_mes":
    default: {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: fmt(inicio), hasta: fmt(inicioHoy) };
    }
  }
}

// KPIs financieros + operativos agregados de toda la empresa — no es
// para un colaborador (rol sin módulos). admin/supervisor/contador sí.
dashboardRouter.get(
  "/",
  requiereRol("admin", "supervisor", "contador"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { desde, hasta } = resolverPeriodo(
      typeof req.query.periodo === "string" ? req.query.periodo : undefined,
      req.query.desde,
      req.query.hasta
    );

    const [kpisData, financiero, gastos, ingresosGastos, presupuestosData, otData, porMes] = await Promise.all([
      kpis(req.empresaId!, desde, hasta),
      resumenFinanciero(req.empresaId!, desde, hasta),
      resumenGastos(req.empresaId!, desde, hasta),
      ingresosVsGastos(req.empresaId!, desde, hasta),
      estadoPresupuestos(req.empresaId!, desde, hasta),
      estadoOT(req.empresaId!, desde, hasta),
      ingresosPorMes(req.empresaId!),
    ]);

    res.json({
      periodo: { desde, hasta },
      kpis: kpisData,
      resumen_financiero: financiero,
      resumen_gastos: gastos,
      ingresos_vs_gastos: ingresosGastos,
      estado_presupuestos: presupuestosData,
      estado_ot: otData,
      ingresos_por_mes: porMes,
    });
  })
);
