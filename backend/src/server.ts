import express from "express";
import cors from "cors";
import type { Rubro } from "@bitacora/shared";
import { env } from "./env";
import { supabase } from "./supabase";
import { requiereAuth, type RequestConUsuario } from "./auth";
import { requiereEmpresa } from "./empresa";
import { trabajosRouter } from "./routes/trabajos";
import { cobrosRouter } from "./routes/cobros";
import { informeRouter } from "./routes/informe";
import { tiposTrabajoRouter } from "./routes/tiposTrabajo";
import { usuariosRouter } from "./routes/usuarios";
import { clientesRouter } from "./routes/clientes";
import { rutasRouter } from "./routes/rutas";
import { miEmpresaRouter } from "./routes/miEmpresa";
import { rutasPlanificadasRouter } from "./routes/rutasPlanificadas";
import { ordenesServicioRouter } from "./routes/ordenesServicio";
import { dashboardRouter } from "./routes/dashboard";
import { informesRouter } from "./routes/informes";
import { gastosRouter } from "./routes/gastos";
import { cotizacionesRouter } from "./routes/cotizaciones";
import { plantillasRouter } from "./routes/plantillas";
import { checklistsRouter } from "./routes/checklists";
import { tiposOsRouter } from "./routes/tiposOs";
import { integracionesRouter } from "./routes/integraciones";
import { categoriasGastoRouter } from "./routes/categoriasGasto";
import { centrosCostoRouter } from "./routes/centrosCosto";
import { notificacionesRouter } from "./routes/notificaciones";
import { encuestaPublicaRouter } from "./routes/encuestaPublica";
import { equiposRouter } from "./routes/equipos";
import { catalogoRouter } from "./routes/catalogo";
import { inventarioRouter } from "./routes/inventario";
import { proveedoresRouter } from "./routes/proveedores";
import { asistenteRouter } from "./routes/asistente";
import { ah } from "./asyncHandler";

const RUBROS: Rubro[] = ["transporte", "servicio_tecnico", "otro"];

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Usuario + empresa del token actual. usuario:null si el login ya
// existe en Supabase Auth pero todavía no completó el onboarding
// (no tiene fila en "usuarios").
app.get("/api/me", requiereAuth, ah<RequestConUsuario>(async (req, res) => {
  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("*, empresa:empresas(*)")
    .eq("id", req.userId!)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ usuario });
}));

// Onboarding multi-tenant: crea la empresa y vincula al usuario ya
// autenticado como su primer admin. Requiere service role porque
// "empresas"/"usuarios" no tienen policy de INSERT para el cliente
// (el aislamiento entre empresas se hace a propósito solo con SELECT/UPDATE).
app.post("/api/registro-empresa", requiereAuth, ah<RequestConUsuario>(async (req, res) => {
  const { nombre_empresa, rubro, nombre_usuario } = req.body ?? {};

  if (typeof nombre_empresa !== "string" || !nombre_empresa.trim()) {
    res.status(400).json({ error: "Falta nombre_empresa" });
    return;
  }
  if (typeof nombre_usuario !== "string" || !nombre_usuario.trim()) {
    res.status(400).json({ error: "Falta nombre_usuario" });
    return;
  }
  if (!RUBROS.includes(rubro)) {
    res.status(400).json({ error: `rubro debe ser uno de: ${RUBROS.join(", ")}` });
    return;
  }

  const { data: existente } = await supabase
    .from("usuarios")
    .select("id")
    .eq("id", req.userId!)
    .maybeSingle();
  if (existente) {
    res.status(409).json({ error: "Este usuario ya pertenece a una empresa" });
    return;
  }

  const pruebaTerminaEn = new Date();
  pruebaTerminaEn.setDate(pruebaTerminaEn.getDate() + 14);

  const { data: empresa, error: errorEmpresa } = await supabase
    .from("empresas")
    .insert({
      nombre: nombre_empresa.trim(),
      rubro,
      prueba_termina_en: pruebaTerminaEn.toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (errorEmpresa) {
    res.status(500).json({ error: errorEmpresa.message });
    return;
  }

  const { data: usuario, error: errorUsuario } = await supabase
    .from("usuarios")
    .insert({
      id: req.userId!,
      empresa_id: empresa.id,
      nombre: nombre_usuario.trim(),
      rol: "admin",
    })
    .select()
    .single();
  if (errorUsuario) {
    // limpiar la empresa huérfana si falla la vinculación del usuario
    await supabase.from("empresas").delete().eq("id", empresa.id);
    res.status(500).json({ error: errorUsuario.message });
    return;
  }

  res.status(201).json({ empresa, usuario });
}));

app.use("/api/trabajos", requiereAuth, requiereEmpresa, trabajosRouter);
app.use("/api/cobros", requiereAuth, requiereEmpresa, cobrosRouter);
app.use("/api/informe", requiereAuth, requiereEmpresa, informeRouter);
app.use("/api/tipos-trabajo", requiereAuth, requiereEmpresa, tiposTrabajoRouter);
app.use("/api/usuarios", requiereAuth, requiereEmpresa, usuariosRouter);
app.use("/api/clientes", requiereAuth, requiereEmpresa, clientesRouter);
app.use("/api/rutas", requiereAuth, requiereEmpresa, rutasRouter);
app.use("/api/empresa", requiereAuth, requiereEmpresa, miEmpresaRouter);
app.use("/api/rutas-planificadas", requiereAuth, requiereEmpresa, rutasPlanificadasRouter);
app.use("/api/ordenes-servicio", requiereAuth, requiereEmpresa, ordenesServicioRouter);
app.use("/api/dashboard", requiereAuth, requiereEmpresa, dashboardRouter);
app.use("/api/informes", requiereAuth, requiereEmpresa, informesRouter);
app.use("/api/gastos", requiereAuth, requiereEmpresa, gastosRouter);
app.use("/api/cotizaciones", requiereAuth, requiereEmpresa, cotizacionesRouter);
app.use("/api/plantillas", requiereAuth, requiereEmpresa, plantillasRouter);
app.use("/api/checklists", requiereAuth, requiereEmpresa, checklistsRouter);
app.use("/api/tipos-os", requiereAuth, requiereEmpresa, tiposOsRouter);
app.use("/api/integraciones", requiereAuth, requiereEmpresa, integracionesRouter);
app.use("/api/categorias-gasto", requiereAuth, requiereEmpresa, categoriasGastoRouter);
app.use("/api/centros-costo", requiereAuth, requiereEmpresa, centrosCostoRouter);
app.use("/api/notificaciones", requiereAuth, requiereEmpresa, notificacionesRouter);
app.use("/api/equipos", requiereAuth, requiereEmpresa, equiposRouter);
app.use("/api/catalogo", requiereAuth, requiereEmpresa, catalogoRouter);
app.use("/api/inventario", requiereAuth, requiereEmpresa, inventarioRouter);
app.use("/api/proveedores", requiereAuth, requiereEmpresa, proveedoresRouter);
app.use("/api/asistente", requiereAuth, requiereEmpresa, asistenteRouter);
// Sin auth a propósito — la abre un cliente anónimo desde el correo.
app.use("/api/encuesta", encuestaPublicaRouter);

// Handler de errores global: cualquier excepción sin capturar en una
// ruta async (vía ah()) termina acá en vez de tumbar el proceso.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const mensaje = err instanceof Error ? err.message : "Error interno";
  res.status(500).json({ error: mensaje });
});

app.listen(env.PORT, () => {
  console.log(`Bitácora backend escuchando en :${env.PORT}`);
});
