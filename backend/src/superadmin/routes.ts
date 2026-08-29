import { Router } from "express";
import { supabase } from "../supabase";
import { env } from "../env";
import { ah } from "../asyncHandler";
import { descifrarJson } from "../crypto";
import { medirUsoStorage } from "../storage";
import { verificarPassword } from "./passwords";
import { verificarCodigoTotp } from "./totp";
import { crearTokenSuperAdmin, requiereSuperAdmin, registrarAuditoria, type RequestConSuperAdmin } from "./auth";

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
    const { data: empresa } = await supabase.from("empresas").select("id, nombre").eq("id", empresaId).maybeSingle();
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
