import { Router } from "express";
import type { EstadoEmpresa, Modulo, Plan } from "@bitacora/shared";
import { MODULOS, moduloActivadoPorDefecto } from "@bitacora/shared";
import { supabase } from "../supabase";
import { env } from "../env";
import { ah } from "../asyncHandler";
import { descifrarJson } from "../crypto";
import { medirUsoStorage } from "../storage";
import { TABLAS_POR_EMPRESA } from "../tenant";
import { cambiarPlanEmpresa } from "../planes";
import { verificarPassword } from "./passwords";
import { verificarCodigoTotp } from "./totp";
import { crearTokenSuperAdmin, requiereSuperAdmin, registrarAuditoria, type RequestConSuperAdmin } from "./auth";

const ESTADOS_EMPRESA: EstadoEmpresa[] = ["activa", "suspendida", "dada_de_baja"];
const PLANES: Plan[] = ["trial", "basico", "pro"];

export const superadminRouter = Router();

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

superadminRouter.post(
  "/login",
  ah(async (req, res) => {
    const { correo, password, codigo } = req.body ?? {};
    if (typeof correo !== "string" || typeof password !== "string" || typeof codigo !== "string") {
      res.status(400).json({ error: "Falta correo, password o código" });
      return;
    }

    const { data: superAdmin } = await supabase
      .from("super_admins")
      .select("*")
      .eq("correo", correo.trim().toLowerCase())
      .maybeSingle();

    // Mismo mensaje genérico en todos los casos de fallo — no revela
    // si el correo existe, si la password está mal, o si falta el TOTP.
    const credencialesInvalidas = () => res.status(401).json({ error: "Credenciales inválidas" });

    if (!superAdmin || !superAdmin.activo) {
      credencialesInvalidas();
      return;
    }
    if (superAdmin.bloqueado_hasta && new Date(superAdmin.bloqueado_hasta).getTime() > Date.now()) {
      res.status(423).json({ error: "Cuenta bloqueada temporalmente por demasiados intentos fallidos" });
      return;
    }

    const totpSecreto = descifrarJson(superAdmin.totp_secreto, env.SUPERADMIN_ENCRYPTION_KEY, "SUPERADMIN_ENCRYPTION_KEY").secreto as string;
    const passwordOk = verificarPassword(password, superAdmin.password_hash);
    const codigoOk = passwordOk && verificarCodigoTotp(totpSecreto, codigo);

    if (!passwordOk || !codigoOk) {
      const intentos = superAdmin.intentos_fallidos + 1;
      await supabase
        .from("super_admins")
        .update({
          intentos_fallidos: intentos,
          bloqueado_hasta: intentos >= MAX_INTENTOS ? new Date(Date.now() + BLOQUEO_MS).toISOString() : null,
        })
        .eq("id", superAdmin.id);
      credencialesInvalidas();
      return;
    }

    await supabase
      .from("super_admins")
      .update({ intentos_fallidos: 0, bloqueado_hasta: null, ultimo_login_en: new Date().toISOString() })
      .eq("id", superAdmin.id);

    await registrarAuditoria(superAdmin.id, "login", { ip: req.ip ?? null });

    res.json({ token: crearTokenSuperAdmin(superAdmin.id), nombre: superAdmin.nombre });
  })
);

superadminRouter.get(
  "/empresas",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const busqueda = typeof req.query.busqueda === "string" ? req.query.busqueda.trim() : "";

    let query = supabase
      .from("empresas")
      .select("id, nombre, plan, estado, creado_en")
      .order("creado_en", { ascending: false });
    if (busqueda) query = query.ilike("nombre", `%${busqueda}%`);

    const { data: empresas, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const { data: usuarios } = await supabase.from("usuarios").select("empresa_id");
    const cantidadPorEmpresa = new Map<string, number>();
    for (const u of usuarios ?? []) {
      cantidadPorEmpresa.set(u.empresa_id, (cantidadPorEmpresa.get(u.empresa_id) ?? 0) + 1);
    }

    await registrarAuditoria(req.superAdminId!, "ver_empresas", { ip: req.ip ?? null, detalle: busqueda || undefined });

    res.json((empresas ?? []).map((e) => ({ ...e, cantidad_usuarios: cantidadPorEmpresa.get(e.id) ?? 0 })));
  })
);

superadminRouter.get(
  "/empresas/:id/salud",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const empresaId = req.params.id;
    const { data: empresa } = await supabase.from("empresas").select("id, nombre, estado, plan").eq("id", empresaId).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const inicioMesIso = inicioMes.toISOString();

    const [{ data: ultimoAcceso }, { data: accesosDelMes }, { count: osDelMes }, usoStorage, { data: usoIaDelMes }, { data: erroresRecientes }] =
      await Promise.all([
        supabase
          .from("accesos_usuario")
          .select("creado_en")
          .eq("empresa_id", empresaId)
          .order("creado_en", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("accesos_usuario").select("usuario_id").eq("empresa_id", empresaId).gte("creado_en", inicioMesIso),
        supabase
          .from("ordenes_servicio")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .gte("creado_en", inicioMesIso),
        medirUsoStorage(empresaId).catch(() => ({ bytesTotal: 0, incluyeAvatares: false as const })),
        supabase.from("ia_uso").select("feature, tokens_entrada, tokens_salida").eq("empresa_id", empresaId).gte("creado_en", inicioMesIso),
        supabase
          .from("errores_backend")
          .select("ruta, mensaje, creado_en")
          .eq("empresa_id", empresaId)
          .order("creado_en", { ascending: false })
          .limit(10),
      ]);

    const usuariosActivosMes = new Set((accesosDelMes ?? []).map((a) => a.usuario_id)).size;

    const porFeature: Record<string, { tokens_entrada: number; tokens_salida: number }> = {};
    let tokensEntradaTotal = 0;
    let tokensSalidaTotal = 0;
    for (const fila of usoIaDelMes ?? []) {
      tokensEntradaTotal += fila.tokens_entrada;
      tokensSalidaTotal += fila.tokens_salida;
      const actual = porFeature[fila.feature] ?? { tokens_entrada: 0, tokens_salida: 0 };
      actual.tokens_entrada += fila.tokens_entrada;
      actual.tokens_salida += fila.tokens_salida;
      porFeature[fila.feature] = actual;
    }

    await registrarAuditoria(req.superAdminId!, "ver_salud_empresa", { empresaId, ip: req.ip ?? null });

    res.json({
      empresa,
      ultima_actividad: ultimoAcceso?.creado_en ?? null,
      usuarios_activos_mes: usuariosActivosMes,
      os_creadas_mes: osDelMes ?? 0,
      almacenamiento_bytes: usoStorage.bytesTotal,
      consumo_ia_mes: { tokens_entrada: tokensEntradaTotal, tokens_salida: tokensSalidaTotal, por_feature: porFeature },
      errores_recientes: erroresRecientes ?? [],
      almacenamiento_incluye_avatares: usoStorage.incluyeAvatares,
    });
  })
);

superadminRouter.patch(
  "/empresas/:id/estado",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { estado } = req.body ?? {};
    if (typeof estado !== "string" || !ESTADOS_EMPRESA.includes(estado as EstadoEmpresa)) {
      res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS_EMPRESA.join(", ")}` });
      return;
    }

    const { data: actual } = await supabase.from("empresas").select("nombre, estado").eq("id", req.params.id).maybeSingle();
    if (!actual) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    const { data, error } = await supabase
      .from("empresas")
      .update({ estado: estado as EstadoEmpresa })
      .eq("id", req.params.id)
      .select("id, estado")
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await registrarAuditoria(req.superAdminId!, "cambiar_estado_empresa", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${actual.nombre}: ${actual.estado} → ${estado}`,
    });

    res.json(data);
  })
);

superadminRouter.patch(
  "/empresas/:id/plan",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { plan } = req.body ?? {};
    if (typeof plan !== "string" || !PLANES.includes(plan as Plan)) {
      res.status(400).json({ error: `plan debe ser uno de: ${PLANES.join(", ")}` });
      return;
    }

    const { data: actual } = await supabase.from("empresas").select("nombre, plan").eq("id", req.params.id).maybeSingle();
    if (!actual) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    // Misma función que usa la autogestión de la empresa (Configuración >
    // Plan) — sincroniza empresa_modulos y queda en empresa_plan_historial,
    // para que ningún camino pueda desincronizarse del otro.
    await cambiarPlanEmpresa(req.params.id, plan as Plan, { tipo: "super_admin", superAdminId: req.superAdminId! });

    await registrarAuditoria(req.superAdminId!, "cambiar_plan_empresa", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${actual.nombre}: ${actual.plan} → ${plan}`,
    });

    res.json({ id: req.params.id, plan });
  })
);

// No incluye el contenido de los archivos de Storage (fotos/PDFs) —
// solo las keys ya guardadas en cada fila. Nunca se renderiza en el
// panel: sale directo como descarga, así el Super-Admin no navega
// datos operativos ajenos, solo genera el archivo de portabilidad.
superadminRouter.get(
  "/empresas/:id/exportar",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const empresaId = req.params.id;
    const { data: empresa } = await supabase.from("empresas").select("*").eq("id", empresaId).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    const resultados = await Promise.all(
      TABLAS_POR_EMPRESA.map(async (tabla) => {
        const { data } = await supabase.from(tabla).select("*").eq("empresa_id", empresaId);
        return [tabla, data ?? []] as const;
      })
    );
    const datosPorTabla = Object.fromEntries(resultados);

    await registrarAuditoria(req.superAdminId!, "exportar_datos_empresa", {
      empresaId,
      ip: req.ip ?? null,
      detalle: empresa.nombre,
    });

    const nombreArchivo = `${empresa.nombre.replace(/[^a-zA-Z0-9_-]/g, "_")}-export-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
    res.json({
      generado_en: new Date().toISOString(),
      empresa,
      nota: "No incluye el contenido de fotos/PDFs de Storage, solo las referencias (keys) ya guardadas en cada fila.",
      datos: datosPorTabla,
    });
  })
);

// Irreversible a propósito — mismo patrón que la autobaja del propio
// admin (miEmpresa.ts DELETE /): exige el nombre exacto de la empresa,
// no un checkbox. El cascade real lo hacen los "on delete cascade" ya
// definidos en cada una de las 43 tablas de tenant.
superadminRouter.delete(
  "/empresas/:id",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { confirmar } = req.body ?? {};
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }
    if (typeof confirmar !== "string" || confirmar !== empresa.nombre) {
      res.status(400).json({ error: "Escribe el nombre exacto de la empresa para confirmar" });
      return;
    }

    // Se loguea el nombre como texto ANTES de borrar — el FK de
    // super_admin_auditoria.empresa_id es "on delete set null", así que
    // sin esto el registro sobreviviría sin ninguna referencia legible.
    await registrarAuditoria(req.superAdminId!, "eliminar_empresa", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: empresa.nombre,
    });

    const { error } = await supabase.from("empresas").delete().eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).end();
  })
);

superadminRouter.get(
  "/empresas/:id/modulos",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: empresa } = await supabase.from("empresas").select("id").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }
    const { data } = await supabase.from("empresa_modulos").select("modulo, activado").eq("empresa_id", req.params.id);
    const filas = new Map((data ?? []).map((f) => [f.modulo, f.activado]));
    res.json(MODULOS.map((m) => ({ modulo: m, activado: filas.has(m) ? filas.get(m)! : moduloActivadoPorDefecto(m) })));
  })
);

superadminRouter.patch(
  "/empresas/:id/modulos",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { modulo, activado } = req.body ?? {};
    if (typeof modulo !== "string" || !MODULOS.includes(modulo as Modulo) || typeof activado !== "boolean") {
      res.status(400).json({ error: "Falta modulo (válido) o activado (boolean)" });
      return;
    }
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }

    const { error } = await supabase
      .from("empresa_modulos")
      .upsert(
        { empresa_id: req.params.id, modulo, activado, actualizado_en: new Date().toISOString() },
        { onConflict: "empresa_id,modulo" }
      );
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await registrarAuditoria(req.superAdminId!, "cambiar_modulo_empresa", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${empresa.nombre}: ${modulo} → ${activado ? "activado" : "desactivado"}`,
    });

    res.json({ modulo, activado });
  })
);

// Suscripción B2B (cobro recurrente a esta empresa) — solo lectura +
// extender el trial acá; cambiar el estado de facturación en sí lo hace
// exclusivamente el webhook de Flow (backend/src/routes/flowWebhook.ts),
// nunca a mano, para que el estado real de Flow y el de Bitácora no se
// desincronicen.
superadminRouter.get(
  "/empresas/:id/suscripcion",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { data: empresa } = await supabase.from("empresas").select("id, prueba_termina_en").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }
    const { data: suscripcion } = await supabase.from("suscripciones").select("*").eq("empresa_id", req.params.id).maybeSingle();
    const { data: cobros } = await supabase
      .from("suscripcion_cobros")
      .select("*")
      .eq("empresa_id", req.params.id)
      .order("creado_en", { ascending: false })
      .limit(24);
    res.json({ prueba_termina_en: empresa.prueba_termina_en, suscripcion: suscripcion ?? null, cobros: cobros ?? [] });
  })
);

superadminRouter.patch(
  "/empresas/:id/prueba",
  requiereSuperAdmin,
  ah<RequestConSuperAdmin>(async (req, res) => {
    const { prueba_termina_en } = req.body ?? {};
    if (typeof prueba_termina_en !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(prueba_termina_en)) {
      res.status(400).json({ error: "prueba_termina_en debe ser una fecha YYYY-MM-DD" });
      return;
    }
    const { data: empresa } = await supabase.from("empresas").select("nombre, prueba_termina_en").eq("id", req.params.id).maybeSingle();
    if (!empresa) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return;
    }
    const { error } = await supabase.from("empresas").update({ prueba_termina_en }).eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    await registrarAuditoria(req.superAdminId!, "extender_prueba_empresa", {
      empresaId: req.params.id,
      ip: req.ip ?? null,
      detalle: `${empresa.nombre}: ${empresa.prueba_termina_en ?? "—"} → ${prueba_termina_en}`,
    });
    res.json({ prueba_termina_en });
  })
);
