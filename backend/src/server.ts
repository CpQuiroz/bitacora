import { Sentry } from "./instrument"; // primero de todo (auto-instrumentación)
import express from "express";
import cors from "cors";
import helmet from "helmet";
import type { Rubro } from "@bitacora/shared";
import { DIAS_PRUEBA, sumarDiasFecha } from "@bitacora/shared";
import { hoyChile } from "./fechaChile";
import { env } from "./env";
import { supabase } from "./supabase";
import { requiereAuth, type RequestConUsuario } from "./auth";
import { requiereEmpresa } from "./empresa";
import { trabajosRouter } from "./routes/trabajos";
import { cobrosRouter } from "./routes/cobros";
import { informeRouter } from "./routes/informe";
import { tiposOsTrabajoRouter } from "./routes/tiposOsTrabajo";
import { usuariosRouter } from "./routes/usuarios";
import { clientesRouter } from "./routes/clientes";
import { rutasRouter } from "./routes/rutas";
import { miEmpresaRouter } from "./routes/miEmpresa";
import { rutasPlanificadasRouter } from "./routes/rutasPlanificadas";
import { ordenesServicioRouter } from "./routes/ordenesServicio";
import { tareasRouter } from "./routes/tareas";
import { paquetesSesionesRouter } from "./routes/paquetesSesiones";
import { tiposPackRouter } from "./routes/tiposPack";
import { serviciosRouter } from "./routes/servicios";
import { ventasRouter } from "./routes/ventas";
import { suscripcionRouter } from "./routes/suscripcion";
import { planRouter } from "./routes/plan";
import { flowWebhookRouter } from "./routes/flowWebhook";
import { agendaProConfigRouter } from "./routes/agendaProConfig";
import { reservaPublicaRouter } from "./routes/reservaPublica";
import { dashboardRouter } from "./routes/dashboard";
import { informesRouter } from "./routes/informes";
import { gastosRouter } from "./routes/gastos";
import { rendicionesRouter } from "./routes/rendiciones";
import { cotizacionesRouter } from "./routes/cotizaciones";
import { plantillasRouter } from "./routes/plantillas";
import { checklistsRouter } from "./routes/checklists";
import { integracionesRouter } from "./routes/integraciones";
import { categoriasGastoRouter } from "./routes/categoriasGasto";
import { centrosCostoRouter } from "./routes/centrosCosto";
import { cotizacionEtapasRouter } from "./routes/cotizacionEtapas";
import { notificacionesRouter } from "./routes/notificaciones";
import { encuestaPublicaRouter } from "./routes/encuestaPublica";
import { equiposRouter } from "./routes/equipos";
import { eventosFlotaRouter } from "./routes/eventosFlota";
import { planesMantencionRouter } from "./routes/planesMantencion";
import { registrosMantencionRouter } from "./routes/registrosMantencion";
import { levantamientosRouter } from "./routes/levantamientos";
import { sugerenciasRubroRouter } from "./routes/sugerenciasRubro";
import { catalogoRouter } from "./routes/catalogo";
import { inventarioRouter } from "./routes/inventario";
import { proveedoresRouter } from "./routes/proveedores";
import { asistenteRouter } from "./routes/asistente";
import { modulosRouter } from "./routes/modulos";
import { viajesRouter } from "./routes/viajes";
import { tarifasViajesRouter } from "./routes/tarifasViajes";
import { misViajesRouter } from "./routes/misViajes";
import { misTrabajosRouter } from "./routes/misTrabajos";
import { accesosRouter } from "./routes/accesos";
import { empresaRolesRouter } from "./routes/empresaRoles";
import { remuneracionesRouter } from "./routes/remuneraciones";
import { whatsappRouter } from "./routes/whatsapp";
import { notificacionesFeedRouter } from "./routes/notificacionesFeed";
import { unidadesMedidaRouter } from "./routes/unidadesMedida";
import { notificacionesClienteRouter } from "./routes/notificacionesCliente";
import { portalRouter } from "./routes/portal";
import { superadminRouter } from "./superadmin/routes";
import { tiposDocumentoRouter } from "./routes/tiposDocumento";
import { documentosRouter } from "./routes/documentos";
import { mfaRouter } from "./routes/mfa";
import { authLoginRouter } from "./routes/authLogin";
import { limitarLogin, limitarEncuestaPublica } from "./rateLimiters";
import { modulosDeshabilitadosDeEmpresa, featureFlagsDeEmpresa, modulosVisiblesDeUsuario, requiereModulo, requierePlanIACompleta, requiereRol } from "./permisos";
import { accionesDeRol, rolExigeMfa } from "./roles";
import { resolverAccesoParaLogin, aprovisionarUsuario } from "./accesosAutorizados";
import { activarModulosDePrueba } from "./planes";
import { revisarCumpleanosSiCorresponde } from "./cumpleanosClientes";
import { sembrarSugerenciasRubro } from "./seedRubro";
import { registrarConsentimiento, tieneConsentimientoVigente } from "./consentimiento";
import { limpiarDatosVencidosSiCorresponde } from "./retencion";
import { verificarTokenBajaAvisos } from "./bajaAvisos";
import { medirLatencia } from "./instrumentacion";
import { ah } from "./asyncHandler";
import { empresaConPruebaVencida } from "./empresaOperativa";

const RUBROS: Rubro[] = ["transporte", "servicio_tecnico", "cosmetologia", "otro"];

// export solo para que server.smoke.test.ts pueda importar la app real
// sin reimplementar el proceso de arranque — nada más la usa.
export const app = express();
// Cabeceras de seguridad estándar (X-Content-Type-Options,
// X-Frame-Options, etc.) — lo más temprano posible, antes de
// cualquier ruta. Ver checklist de seguridad pre-lanzamiento.
app.use(helmet());
// Para que req.ip sea la IP real del cliente (historial de accesos en
// Seguridad, límites de intentos de login) detrás del proxy de Render.
// Se confía en EXACTAMENTE 1 salto (el de Render), no en `true`: con
// `true` cualquiera podía mandar su propio X-Forwarded-For y aparecer
// con otra IP en cada intento, saltándose el límite de intentos de login
// (aviso ERR_ERL_PERMISSIVE_TRUST_PROXY de express-rate-limit).
// ⚠️ Si algún día se pone otro proxy delante (ej. Cloudflare con la nube
// naranja en un dominio propio, tarea 115), hay que subirlo a 2 — si no,
// todos los usuarios quedan con la IP de ese proxy y comparten el límite.
app.set("trust proxy", 1);
// Sin ALLOWED_ORIGINS configurada (dev local), solo se permite el dev
// server de Next.js — nunca "*". En producción, ALLOWED_ORIGINS debe
// listar los dominios reales separados por coma.
const origenesPermitidos = (env.ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: origenesPermitidos }));
// El verify callback guarda el body crudo en req.rawBody — lo necesita
// el webhook de WhatsApp para validar la firma HMAC de Meta (hay que
// firmar/verificar contra los bytes exactos, no el JSON re-serializado).
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);

// Mide la latencia de cada request; solo persiste las que superan el
// umbral (ver instrumentacion.ts). Va después de express.json (para
// tener el body) y antes de las rutas.
app.use(medirLatencia);

// Liveness: el proceso Node responde. Lo usa el health check de Render
// (healthCheckPath) y cualquier check "¿está vivo?".
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Readiness: además verifica que el backend puede hablar con Supabase.
// Es el que debe mirar un uptime monitor — devuelve 503 si la DB no
// responde (AUDITORIA_RESILIENCIA.md R2).
app.get("/health/ready", async (_req, res) => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const { error } = await supabase.from("empresas").select("id", { head: true, count: "exact" }).abortSignal(ctrl.signal);
    clearTimeout(t);
    if (error) throw new Error(error.message);
    res.json({ ok: true, db: "ok" });
  } catch (e) {
    res.status(503).json({ ok: false, db: "error", detalle: e instanceof Error ? e.message : String(e) });
  }
});

// Usuario + empresa del token actual. usuario:null si el login ya
// existe en Supabase Auth pero todavía no completó el onboarding
// (no tiene fila en "usuarios").
app.get("/api/me", requiereAuth, ah<RequestConUsuario>(async (req, res) => {
  const { data: filaUsuario, error } = await supabase
    .from("usuarios")
    .select("*, empresa:empresas(*)")
    .eq("id", req.userId!)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  let usuario = filaUsuario;
  // Cuenta autenticada sin fila en `usuarios`: resolver el acceso por
  // correo/dominio autorizado (migración 72). El camino de impersonación
  // nunca cae acá — ese usuario siempre tiene fila.
  if (!usuario && !req.impersonacion) {
    const acceso = await resolverAccesoParaLogin(req.userEmail, req.userMetadata);
    if (acceso.estado === "entra") {
      const nombre =
        (typeof req.userMetadata?.full_name === "string" && req.userMetadata.full_name) ||
        (typeof req.userMetadata?.name === "string" && req.userMetadata.name) ||
        (req.userEmail ? req.userEmail.split("@")[0] : "");
      usuario = await aprovisionarUsuario({
        userId: req.userId!,
        empresaId: acceso.empresaId,
        rol: acceso.rol,
        nombre,
      });
    }
    if (!usuario) {
      // "entra" que falló el insert cae acá como denegado — es raro y
      // preferible a dejar entrar sin fila.
      res.json({ usuario: null, acceso: acceso.estado === "entra" ? "denegado" : acceso.estado });
      return;
    }
  }

  const [modulosDeshabilitados, featureFlags, modulosVisibles, acciones, rolExige2fa, consentimientoVigente] = usuario
    ? await Promise.all([
        modulosDeshabilitadosDeEmpresa(usuario.empresa_id),
        featureFlagsDeEmpresa(usuario.empresa_id),
        modulosVisiblesDeUsuario(usuario.rol, usuario.empresa_id),
        accionesDeRol(usuario.rol),
        rolExigeMfa(usuario.rol),
        tieneConsentimientoVigente(usuario.id),
      ])
    : [[], [], [], [], false, true];
  // Sin cron en este proyecto — /api/me es el endpoint más universal
  // (cualquier navegación del dashboard lo llama), así que es donde
  // más chances hay de que el chequeo corra el día justo. No bloquea
  // la respuesta.
  const pruebaVencidaEmpresa = usuario ? empresaConPruebaVencida((usuario as unknown as { empresa?: { plan: string; prueba_termina_en: string | null } | null }).empresa) : false;
  // Con la prueba vencida no salen avisos a los clientes de la empresa (tarea 144).
  if (usuario && !pruebaVencidaEmpresa) revisarCumpleanosSiCorresponde(usuario.empresa_id);
  // Ley 21.719 — limpieza perezosa de logs/tokens vencidos (ver retencion.ts).
  if (usuario) limpiarDatosVencidosSiCorresponde();
  res.json({
    usuario,
    modulos_deshabilitados: modulosDeshabilitados,
    // Módulos que este usuario realmente ve (rol ∩ contratados) y sus
    // acciones sensibles delegadas — el frontend filtra la navegación y
    // los botones con esto, ya no con la matriz hardcodeada.
    modulos_visibles: modulosVisibles,
    acciones,
    // Si el rol del usuario exige 2FA (roles.requiere_2fa). Lo usa la app
    // móvil para saber si debe pedir activar 2FA (el gate real lo hace
    // requiereEmpresa en cada ruta, pero /api/me no pasa por ahí).
    rol_exige_2fa: rolExige2fa,
    // Feature flags en beta activados para esta empresa (Panel de
    // Super-Admin). Lista de nombres; el frontend hace .includes(...).
    feature_flags: featureFlags,
    // Marca (sin datos del super-admin) para que el dashboard muestre el
    // banner persistente de "estás impersonando". La verdad la tiene el
    // servidor: el token de este request es de impersonación o no.
    impersonacion: req.impersonacion ? { activa: true } : null,
    // Ley 21.719 — true si el usuario nunca aceptó (o aceptó una versión
    // anterior de) la Política de Privacidad / Términos. El frontend
    // muestra un aviso para que lo acepte.
    consentimiento_pendiente: usuario ? !consentimientoVigente : false,
    // Tarea 144: prueba vencida sin plan pago — web y mobile bloquean todo
    // salvo Plan/pago, Mi cuenta y cerrar sesión (el gate real lo hace
    // requiereEmpresa; /api/me no pasa por ahí).
    prueba_vencida: pruebaVencidaEmpresa,
  });
}));

// Onboarding multi-tenant: crea la empresa y vincula al usuario ya
// autenticado como su primer admin. Requiere service role porque
// "empresas"/"usuarios" no tienen policy de INSERT para el cliente
// (el aislamiento entre empresas se hace a propósito solo con SELECT/UPDATE).
app.post("/api/registro-empresa", requiereAuth, ah<RequestConUsuario>(async (req, res) => {
  const { nombre_empresa, rubro, nombre_usuario, acepto_documentos } = req.body ?? {};

  // Ley 21.719 — sin aceptación de Política de Privacidad + Términos no
  // se crea la cuenta. El frontend fuerza el checkbox; esto lo respalda.
  if (acepto_documentos !== true) {
    res.status(400).json({ error: "Debes aceptar la Política de Privacidad y los Términos para crear la cuenta." });
    return;
  }
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

  // Fecha de Chile, igual que el bloqueo (empresaOperativa.ts).
  const pruebaTerminaEn = sumarDiasFecha(hoyChile(), DIAS_PRUEBA);

  const { data: empresa, error: errorEmpresa } = await supabase
    .from("empresas")
    .insert({
      nombre: nombre_empresa.trim(),
      rubro,
      prueba_termina_en: pruebaTerminaEn,
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

  // La prueba trae todo activo (tarea 124). Si falla, la empresa
  // arranca con los módulos por defecto; no se bloquea el alta.
  await activarModulosDePrueba(empresa.id).catch((err) => console.error("Módulos de la prueba:", err));

  // Ley 21.719 — deja constancia de la aceptación (tabla consentimientos).
  await registrarConsentimiento(
    { usuarioId: req.userId! },
    { empresaId: empresa.id, ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null }
  );

  // Transporte: checklists de mantención de flota. El resto parte vacío y
  // se crea desde las sugerencias del rubro (tarea 144). No falla el alta.
  await sembrarSugerenciasRubro(empresa.id, empresa.rubro as Rubro);

  res.status(201).json({ empresa, usuario });
}));

// Ley 21.719 — registra que el usuario autenticado aceptó la Política de
// Privacidad + Términos vigentes. Lo llama la pantalla de invitación (al
// activar la cuenta) y el banner de re-aceptación cuando sube la versión.
app.post("/api/consentimiento", requiereAuth, ah<RequestConUsuario>(async (req, res) => {
  await registrarConsentimiento(
    { usuarioId: req.userId! },
    { ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null }
  );
  res.status(201).json({ ok: true });
}));

app.use("/api/trabajos", requiereAuth, requiereEmpresa, trabajosRouter);
app.use("/api/cobros", requiereAuth, requiereEmpresa, requiereModulo("cobros"), cobrosRouter);
// Informe con IA: todos los planes, solo el rol admin (tarea 124,
// 24-sep-2026); el tope de informes por plan lo aplica crearMensajeIA.
app.use("/api/informe", requiereAuth, requiereEmpresa, requiereRol("admin"), requiereModulo("informe_ia"), informeRouter);
app.use("/api/tipos-os-trabajo", requiereAuth, requiereEmpresa, tiposOsTrabajoRouter);
app.use("/api/usuarios", requiereAuth, requiereEmpresa, usuariosRouter);
app.use("/api/accesos", requiereAuth, requiereEmpresa, requiereModulo("gestion_control"), accesosRouter);
app.use("/api/empresa/roles", requiereAuth, requiereEmpresa, empresaRolesRouter);
app.use("/api/usuarios/me/mfa", requiereAuth, requiereEmpresa, mfaRouter);
app.use("/api/auth", limitarLogin, authLoginRouter);
app.use("/api/clientes", requiereAuth, requiereEmpresa, clientesRouter);
app.use("/api/rutas", requiereAuth, requiereEmpresa, rutasRouter);
app.use("/api/empresa", requiereAuth, requiereEmpresa, miEmpresaRouter);
app.use("/api/rutas-planificadas", requiereAuth, requiereEmpresa, rutasPlanificadasRouter);
app.use("/api/ordenes-servicio", requiereAuth, requiereEmpresa, ordenesServicioRouter);
app.use("/api/tareas", requiereAuth, requiereEmpresa, tareasRouter);
app.use("/api/paquetes-sesiones", requiereAuth, requiereEmpresa, paquetesSesionesRouter);
app.use("/api/tipos-pack", requiereAuth, requiereEmpresa, tiposPackRouter);
app.use("/api/servicios", requiereAuth, requiereEmpresa, serviciosRouter);
app.use("/api/ventas", requiereAuth, requiereEmpresa, ventasRouter);
app.use("/api/suscripcion", requiereAuth, requiereEmpresa, suscripcionRouter);
app.use("/api/plan", requiereAuth, requiereEmpresa, planRouter);
// Configuración › Módulos de la empresa (tarea 124, etapa 3). La acción
// gestionar_plan se exige adentro del router.
app.use("/api/modulos", requiereAuth, requiereEmpresa, modulosRouter);
app.use("/api/agenda-pro/config", requiereAuth, requiereEmpresa, agendaProConfigRouter);
app.use("/api/dashboard", requiereAuth, requiereEmpresa, dashboardRouter);
app.use("/api/informes", requiereAuth, requiereEmpresa, requiereModulo("informes"), informesRouter);
app.use("/api/gastos", requiereAuth, requiereEmpresa, requiereModulo("financiero"), gastosRouter);
app.use("/api/rendiciones", requiereAuth, requiereEmpresa, requiereModulo("financiero"), rendicionesRouter);
app.use("/api/cotizaciones", requiereAuth, requiereEmpresa, requiereModulo("cotizaciones"), cotizacionesRouter);
app.use("/api/plantillas", requiereAuth, requiereEmpresa, plantillasRouter);
app.use("/api/checklists", requiereAuth, requiereEmpresa, checklistsRouter);
app.use("/api/integraciones", requiereAuth, requiereEmpresa, integracionesRouter);
app.use("/api/categorias-gasto", requiereAuth, requiereEmpresa, categoriasGastoRouter);
app.use("/api/centros-costo", requiereAuth, requiereEmpresa, centrosCostoRouter);
app.use("/api/cotizacion-etapas", requiereAuth, requiereEmpresa, cotizacionEtapasRouter);
app.use("/api/notificaciones", requiereAuth, requiereEmpresa, notificacionesRouter);
app.use("/api/equipos", requiereAuth, requiereEmpresa, equiposRouter);
// Registros de mantención de flota — mismo prefijo /api/equipos, sin
// requiereModulo (igual que equipos): la autorización es por handler
// (gestionar flota vs. chofer del vehículo). Ver routes/registrosMantencion.ts.
app.use("/api/equipos", requiereAuth, requiereEmpresa, registrosMantencionRouter);
// Eventos semanales de flota (migración 128) — mismo criterio por handler.
app.use("/api/equipos", requiereAuth, requiereEmpresa, eventosFlotaRouter);
// Sin requiereModulo a nivel de router (igual que registrosMantencion):
// el técnico asignado (usuarios.funcion, no rol) necesita pasar por acá
// aunque su rol "colaborador" no vea el módulo — cada handler valida
// empresaTieneModulo() + el permiso puntual. Ver routes/levantamientos.ts.
app.use("/api/levantamientos", requiereAuth, requiereEmpresa, levantamientosRouter);
app.use("/api/planes-mantencion", requiereAuth, requiereEmpresa, planesMantencionRouter);
app.use("/api/sugerencias-rubro", requiereAuth, requiereEmpresa, sugerenciasRubroRouter);
app.use("/api/catalogo", requiereAuth, requiereEmpresa, catalogoRouter);
app.use("/api/inventario", requiereAuth, requiereEmpresa, inventarioRouter);
app.use("/api/unidades-medida", requiereAuth, requiereEmpresa, unidadesMedidaRouter);
app.use("/api/proveedores", requiereAuth, requiereEmpresa, proveedoresRouter);
// FASE 2.2 (23-sep-2026, pedido explícito): el Asistente IA es solo
// para Admin, sin excepción — requiereRol("admin") además del gate de
// módulo (empresa_modulos sigue decidiendo si la empresa lo tiene
// contratado). A diferencia de requiereModulo, esto NO se puede
// esquivar delegando el módulo "asistente" a otro rol desde
// Configuración > Perfiles o el Panel de Super-Admin — ver también
// permisos.ts (MODULOS_DELEGABLES_POR_EMPRESA ya no lo incluye).
// Además del rol y el módulo, el Asistente es de los planes con IA
// completa (prueba, Pro, Empresa) — 403 LIMITE_PLAN en los demás.
app.use("/api/asistente", requiereAuth, requiereEmpresa, requiereRol("admin"), requiereModulo("asistente"), requierePlanIACompleta, asistenteRouter);
app.use("/api/notificaciones-feed", requiereAuth, requiereEmpresa, notificacionesFeedRouter);
app.use("/api/notificaciones-cliente", requiereAuth, requiereEmpresa, notificacionesClienteRouter);
// Tarifas (tarea 135) antes que /api/viajes para que no las capture /:id.
app.use("/api/viajes/tarifas", requiereAuth, requiereEmpresa, requiereModulo("viajes"), tarifasViajesRouter);
app.use("/api/viajes", requiereAuth, requiereEmpresa, requiereModulo("viajes"), viajesRouter);
// Viajes propios de un colaborador (app móvil / bot) — sin requiereModulo,
// scopeado a chofer_id = usuario autenticado. Ver routes/misViajes.ts.
app.use("/api/mis-viajes", requiereAuth, requiereEmpresa, misViajesRouter);
// "Mis trabajos" (Fase 5.3) — historial de levantamientos/OS
// terminados del colaborador, mismo criterio que mis-viajes: sin
// requiereModulo, self-service. Ver routes/misTrabajos.ts.
app.use("/api/mis-trabajos", requiereAuth, requiereEmpresa, misTrabajosRouter);
// Remuneraciones (liquidaciones de sueldo) — módulo opt-in, apagado por
// defecto, lo enciende el Super-Admin. Roles admin/supervisor.
app.use("/api/remuneraciones", requiereAuth, requiereEmpresa, requiereModulo("remuneraciones"), remuneracionesRouter);
app.use("/api/tipos-documento", requiereAuth, requiereEmpresa, tiposDocumentoRouter);
app.use("/api/documentos", requiereAuth, requiereEmpresa, documentosRouter);
// Ley 21.719 — baja de avisos. Sin auth: la abre el cliente desde el
// link del pie del correo. El token firmado identifica cliente+empresa.
app.post("/api/baja-avisos", ah(async (req, res) => {
  const info = verificarTokenBajaAvisos(typeof req.body?.token === "string" ? req.body.token : "");
  if (!info) {
    res.status(400).json({ error: "El link no es válido o está incompleto." });
    return;
  }
  const { error } = await supabase
    .from("clientes")
    .update({ notificaciones_opt_out: true })
    .eq("id", info.clienteId)
    .eq("empresa_id", info.empresaId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true });
}));

// Sin auth a propósito — la abre un cliente anónimo desde el correo.
app.use("/api/encuesta", limitarEncuestaPublica, encuestaPublicaRouter);
app.use("/api/reserva-publica", reservaPublicaRouter);
app.use("/api/flow-webhook", flowWebhookRouter);
// Sin auth a propósito — lo llama Meta directamente; se autentica con
// la firma HMAC del webhook (ver whatsapp.ts), no con un usuario.
app.use("/api/whatsapp", whatsappRouter);
// Sin requiereAuth/requiereEmpresa a propósito — identidad externa sin
// cuenta de Bitácora. Las rutas de datos (/datos/*) están protegidas
// adentro del propio router con requierePortal (portalAuth.ts).
app.use("/api/portal", portalRouter);
app.use("/api/superadmin", superadminRouter);

// Handler de errores global: cualquier excepción sin capturar en una
// ruta async (vía ah()) termina acá en vez de tumbar el proceso. Único
// punto por el que pasan TODAS las rutas — se aprovecha para loguear
// en errores_backend (Panel de Super-Admin), sin tocar cada ruta.
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const mensaje = err instanceof Error ? err.message : "Error interno";
  // Errores "esperados" (ej. LimiteAlcanzadoError, ver limites.ts)
  // traen su propio status 4xx — son un freno del negocio, no un bug,
  // así que no ensucian errores_backend (Panel de Super-Admin) ni se
  // loguean como si algo hubiera fallado de verdad.
  const posibleStatus = err instanceof Error ? (err as unknown as { status?: unknown }).status : undefined;
  const status = typeof posibleStatus === "number" ? posibleStatus : 500;
  // Un error que trae su propio `.status` fue lanzado a propósito (freno
  // de negocio, backpressure de la cola de IA…) — no es un bug, no se
  // loguea aunque el status sea 5xx (ej. 503 de EsperaEnColaExcedida).
  const esperado = typeof posibleStatus === "number";

  if (status >= 500 && !esperado) {
    console.error(err);
    Sentry.captureException(err, { extra: { ruta: req.path, metodo: req.method } });
    const empresaId = (req as express.Request & { empresaId?: string }).empresaId ?? null;
    void (async () => {
      try {
        const { error } = await supabase.from("errores_backend").insert({
          empresa_id: empresaId,
          ruta: req.path,
          metodo: req.method,
          mensaje: mensaje.slice(0, 500),
        });
        if (error) console.error("Error registrando en errores_backend:", error);
      } catch (err) {
        console.error("Error registrando en errores_backend:", err);
      }
    })();
  }

  const posibleCode = err instanceof Error ? (err as unknown as { code?: unknown }).code : undefined;
  res.status(status).json(esperado && typeof posibleCode === "string" ? { error: mensaje, code: posibleCode } : { error: mensaje });
});

// Red de seguridad a nivel proceso (AUDITORIA_RESILIENCIA.md R5). Casi
// todo pasa por ah()/el handler global, pero un `void algoAsync()` que
// rechace sin catch tumbaría el proceso en Node 22. Lo logueamos y —
// para uncaughtException, que deja el proceso en estado dudoso — salimos
// para que Render lo reinicie limpio.
process.on("unhandledRejection", (motivo) => {
  console.error("unhandledRejection:", motivo);
  Sentry.captureException(motivo);
});
process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
  Sentry.captureException(err);
  Sentry.flush(2000).finally(() => process.exit(1));
});

// export por el mismo motivo que `app` — server.smoke.test.ts necesita
// el Server real para saber en qué puerto quedó (PORT=0 → el SO asigna
// uno libre) y cerrarlo prolijo al terminar.
export const httpServer = app.listen(env.PORT, () => {
  console.log(`Bitácora backend escuchando en :${env.PORT}`);
});
