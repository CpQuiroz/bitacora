import { Router } from "express";
import {
  clientesPorComuna,
  clientesPorMes,
  cotizacionesPorMes,
  distribucionClientes,
  estadoPresupuestos,
  gastosAgrupados,
  gastosEnOS,
  ingresosPorMes,
  ingresosVsGastos,
  kpis,
  kpisClientes,
  kpisVentas,
  kpisYDistribucionOperaciones,
  kpisYDistribucionServicios,
  mejoresClientes,
  osPorMes,
  porFormaPago,
  resumenFinanciero,
  resumenGastos,
  tasaRetencionPorMes,
  tiempoPromedioConclusion,
  topServiciosVendidos,
} from "../agregacionesDashboard";
import { resolverPeriodo } from "./dashboard";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const informesRouter = Router();

function periodoDesdeQuery(req: RequestConEmpresa) {
  return resolverPeriodo(
    typeof req.query.periodo === "string" ? req.query.periodo : undefined,
    req.query.desde,
    req.query.hasta
  );
}

informesRouter.get(
  "/vision-general",
  ah<RequestConEmpresa>(async (req, res) => {
    const { desde, hasta } = periodoDesdeQuery(req);

    const [kpisData, gastos, ingresosGastos, porMes] = await Promise.all([
      kpis(req.empresaId!, desde, hasta),
      resumenGastos(req.empresaId!, desde, hasta),
      ingresosVsGastos(req.empresaId!, desde, hasta),
      ingresosPorMes(req.empresaId!),
    ]);

    res.json({
      periodo: { desde, hasta },
      kpis: kpisData,
      resumen_gastos: gastos,
      ingresos_vs_gastos: ingresosGastos,
      ingresos_por_mes: porMes,
    });
  })
);

informesRouter.get(
  "/financiero",
  ah<RequestConEmpresa>(async (req, res) => {
    const { desde, hasta } = periodoDesdeQuery(req);

    const [financiero, porMes, formaPago, clientes] = await Promise.all([
      resumenFinanciero(req.empresaId!, desde, hasta),
      ingresosPorMes(req.empresaId!),
      porFormaPago(req.empresaId!, desde, hasta),
      mejoresClientes(req.empresaId!, desde, hasta),
    ]);

    res.json({
      periodo: { desde, hasta },
      resumen_financiero: financiero,
      ingresos_por_mes: porMes,
      por_forma_pago: formaPago,
      mejores_clientes: clientes,
    });
  })
);

informesRouter.get(
  "/ventas",
  ah<RequestConEmpresa>(async (req, res) => {
    const { desde, hasta } = periodoDesdeQuery(req);

    const [kpisData, porMes, distribucion, topServicios] = await Promise.all([
      kpisVentas(req.empresaId!, desde, hasta),
      cotizacionesPorMes(req.empresaId!),
      estadoPresupuestos(req.empresaId!, desde, hasta),
      topServiciosVendidos(req.empresaId!, desde, hasta),
    ]);

    res.json({
      periodo: { desde, hasta },
      kpis: kpisData,
      cotizaciones_por_mes: porMes,
      distribucion_estado: distribucion,
      top_servicios: topServicios,
    });
  })
);

informesRouter.get(
  "/operaciones",
  ah<RequestConEmpresa>(async (req, res) => {
    const { desde, hasta } = periodoDesdeQuery(req);

    const [kpisYDistribucion, porMes, tiempoPromedio] = await Promise.all([
      kpisYDistribucionOperaciones(req.empresaId!, desde, hasta),
      osPorMes(req.empresaId!),
      tiempoPromedioConclusion(req.empresaId!),
    ]);

    res.json({
      periodo: { desde, hasta },
      kpis: kpisYDistribucion.kpis,
      distribucion_estado: kpisYDistribucion.distribucion,
      os_por_mes: porMes,
      tiempo_promedio_conclusion: tiempoPromedio,
    });
  })
);

informesRouter.get(
  "/servicios",
  ah<RequestConEmpresa>(async (req, res) => {
    const { desde, hasta } = periodoDesdeQuery(req);
    const resultado = await kpisYDistribucionServicios(req.empresaId!, desde, hasta);

    res.json({
      periodo: { desde, hasta },
      kpis: resultado.kpis,
      distribucion_tipo: resultado.distribucion_tipo,
      ranking_tipos: resultado.ranking_tipos,
      top_clientes_por_tipo: resultado.top_clientes_por_tipo,
    });
  })
);

informesRouter.get(
  "/clientes",
  ah<RequestConEmpresa>(async (req, res) => {
    const { desde, hasta } = periodoDesdeQuery(req);

    const [kpisData, distribucion, porMes, retencion, comunas] = await Promise.all([
      kpisClientes(req.empresaId!, desde, hasta),
      distribucionClientes(req.empresaId!),
      clientesPorMes(req.empresaId!),
      tasaRetencionPorMes(req.empresaId!),
      clientesPorComuna(req.empresaId!),
    ]);

    res.json({
      periodo: { desde, hasta },
      kpis: kpisData,
      distribucion_estado: distribucion,
      clientes_por_mes: porMes,
      tasa_retencion: retencion,
      por_comuna: comunas,
    });
  })
);

informesRouter.get(
  "/gastos-os",
  ah<RequestConEmpresa>(async (req, res) => {
    const { desde, hasta } = periodoDesdeQuery(req);
    const resultado = await gastosEnOS(req.empresaId!, desde, hasta);
    res.json({ periodo: { desde, hasta }, ...resultado });
  })
);

informesRouter.get(
  "/gastos-categoria",
  ah<RequestConEmpresa>(async (req, res) => {
    const { desde, hasta } = periodoDesdeQuery(req);
    const resultado = await gastosAgrupados(req.empresaId!, desde, hasta, "categoria");
    res.json({ periodo: { desde, hasta }, ...resultado });
  })
);

informesRouter.get(
  "/gastos-centro-costo",
  ah<RequestConEmpresa>(async (req, res) => {
    const { desde, hasta } = periodoDesdeQuery(req);
    const resultado = await gastosAgrupados(req.empresaId!, desde, hasta, "centro_costo");
    res.json({ periodo: { desde, hasta }, ...resultado });
  })
);
