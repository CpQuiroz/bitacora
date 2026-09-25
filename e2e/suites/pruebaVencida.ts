// Tarea 144 (salida a prod, PASO 1): prueba vencida con bloqueo total,
// Super-Admin extender/reactivar con historial, Integraciones ocultas sin
// link de pago simulado, montos de viático del Super-Admin y empresa nueva
// sin precargas (solo checklists de transporte) + sugerencias por rubro.
import crypto from "node:crypto";
import { supabase } from "../../backend/src/supabase";
import { crearTokenPortal } from "../../backend/src/portalAuth";
import { crearTokenSuperAdmin } from "../../backend/src/superadmin/auth";
import { hashPassword } from "../../backend/src/superadmin/passwords";
import { generarSecretoTotp } from "../../backend/src/totp";
import { hoyChile } from "../../backend/src/fechaChile";
import { sumarDiasFecha } from "@bitacora/shared";
import { API, tokenDe, type Ctx } from "../entorno";

export async function pruebaVencida(ctx: Ctx): Promise<void> {
  const { check, api, sesion, empresaId } = ctx;
  const admin = await sesion("admin");
  const tecnico = await sesion("tecnico");
  const hoy = hoyChile();

  const { data: antes } = await supabase.from("empresas").select("plan, prueba_termina_en").eq("id", empresaId).single();

  // Super-Admin temporal (sesión firmada con el mismo secreto del backend).
  const { data: sa, error: eSa } = await supabase
    .from("super_admins")
    .insert({
      correo: `e2e-sa-${crypto.randomBytes(4).toString("hex")}@bitacora-e2e.test`,
      password_hash: hashPassword(crypto.randomBytes(16).toString("hex")),
      totp_secreto: generarSecretoTotp(),
      nombre: "E2E Super-Admin",
    })
    .select("id")
    .single();
  if (eSa || !sa) throw new Error(`super_admin: ${eSa?.message}`);
  const tokenSa = crearTokenSuperAdmin(sa.id);

  // Cliente para el portal y chofer con teléfono para el bot.
  const { data: cliente } = await supabase.from("clientes").insert({ empresa_id: empresaId, nombre: "E2E Portal", direccion: "Calle 1", rut: "11.111.111-1", correo: "e2e-portal@bitacora-e2e.test" }).select("id").single();
  const { data: acceso } = await supabase
    .from("portal_accesos")
    .insert({ empresa_id: empresaId, cliente_id: cliente!.id, expira_en: new Date(Date.now() + 3600_000).toISOString() })
    .select("id")
    .single();
  const abonado = String(10000000 + Math.floor(Math.random() * 89999999));
  const { data: chofer } = await supabase.from("usuarios").select("telefono").eq("id", ctx.u.chofer.id).single();
  await supabase.from("usuarios").update({ telefono: `+56 9 ${abonado}` }).eq("id", ctx.u.chofer.id);

  try {
    // ── Prueba vencida ──
    await supabase.from("empresas").update({ plan: "trial", prueba_termina_en: "2026-01-01" }).eq("id", empresaId);

    const t = await api(admin, "GET", "/api/trabajos");
    check("144-1 prueba vencida: una ruta cualquiera da 403 TRIAL_VENCIDO", t.s === 403 && t.j?.code === "TRIAL_VENCIDO", JSON.stringify(t));
    const me = await api(admin, "GET", "/api/me");
    check("144-2 /api/me avisa prueba_vencida", me.s === 200 && me.j?.prueba_vencida === true, `${me.s} ${me.j?.prueba_vencida}`);
    const plan = await api(admin, "GET", "/api/plan");
    check("144-3 Plan sigue abierto", plan.s === 200 && plan.j?.trialVencido === true, JSON.stringify(plan.j));
    const [cuenta, mfa, prefs, sus] = await Promise.all([
      api(admin, "GET", "/api/usuarios/me"),
      api(admin, "GET", "/api/usuarios/me/mfa"),
      api(admin, "GET", "/api/notificaciones-feed/preferencias"),
      api(admin, "GET", "/api/suscripcion"),
    ]);
    // /api/usuarios/me solo tiene PATCH (GET da 404): lo que importa es que no sea el bloqueo.
    check(
      "144-4 Mi cuenta, 2FA, preferencias y suscripción siguen abiertos",
      cuenta.j?.code !== "TRIAL_VENCIDO" && [mfa, prefs, sus].every((r) => r.s === 200),
      [cuenta, mfa, prefs, sus].map((r) => r.s).join(",")
    );
    const borrar = await api(admin, "DELETE", "/api/empresa", { confirmar: "x" });
    check("144-5 no se puede borrar la empresa con la prueba vencida", borrar.s === 403 && borrar.j?.code === "TRIAL_VENCIDO", JSON.stringify(borrar));
    const mv = await api(tecnico, "GET", "/api/mis-trabajos");
    check("144-6 el colaborador también queda bloqueado", mv.s === 403 && mv.j?.code === "TRIAL_VENCIDO", `${mv.s}`);
    const imp = await api(admin, "GET", "/api/usuarios");
    check("144-7 /api/usuarios (equipo) no es Mi cuenta → bloqueado", imp.s === 403, `${imp.s}`);

    const veh = await api(await sesion("chofer"), "GET", "/api/usuarios/me/vehiculo");
    check("144-7b el vehículo asignado (operación) queda bloqueado", veh.s === 403 && veh.j?.code === "TRIAL_VENCIDO", `${veh.s}`);
    const codigo = await fetch(`${API}/api/portal/solicitar-codigo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "11.111.111-1", empresa_id: empresaId }),
    });
    const { count: codigos } = await supabase.from("portal_codigos").select("id", { count: "exact", head: true }).eq("cliente_id", cliente!.id);
    check("144-7c portal por RUT: respuesta genérica y no se envía código", codigo.status === 200 && codigos === 0, `${codigo.status} codigos=${codigos}`);
    const reservar = await fetch(`${API}/api/reserva-publica/${empresaId}/reservar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha: sumarDiasFecha(hoy, 1), hora: "10:00", nombre: "E2E", telefono: "+56911111111" }),
    });
    check("144-7d reservar en línea: 404", reservar.status === 404, `${reservar.status}`);
    const link = await fetch(`${API}/api/portal/${acceso!.id}`).then(async (r) => ({ s: r.status, j: await r.json().catch(() => null) }));
    check("144-8 portal: el link no entrega sesión", link.s === 403 && link.j?.code === "PORTAL_NO_DISPONIBLE", JSON.stringify(link));
    const tokenPortal = crearTokenPortal(cliente!.id, empresaId);
    const cfg = await api(tokenPortal, "GET", "/api/portal/config");
    check("144-9 portal: una sesión ya abierta se corta", cfg.s === 403 && cfg.j?.code === "PORTAL_NO_DISPONIBLE", `${cfg.s}`);
    const reserva = await fetch(`${API}/api/reserva-publica/${empresaId}/info`);
    check("144-10 reserva online: 404", reserva.status === 404, `${reserva.status}`);
    const bot = await fetch(`${API}/api/whatsapp/_simular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefono: `+56 9 ${abonado}`, texto: "hola" }),
    }).then((r) => r.json());
    check("144-11 bot de WhatsApp: no registra nada", bot?.respuestas?.[0]?.includes("no está disponible") === true, JSON.stringify(bot));

    // ── Super-Admin: extender / reactivar / historial ──
    const sa0 = await api(tokenSa, "POST", `/api/superadmin/empresas/${empresaId}/prueba/extender`, { dias: 0 });
    check("144-12 extender 0 días → 400", sa0.s === 400, `${sa0.s}`);
    const sa1 = await api(tokenSa, "POST", `/api/superadmin/empresas/${empresaId}/prueba/extender`, { dias: 5 });
    check("144-13 extender 5 días (vencida) cuenta desde hoy", sa1.s === 200 && sa1.j?.prueba_termina_en === sumarDiasFecha(hoy, 5), JSON.stringify(sa1.j));
    const t2 = await api(admin, "GET", "/api/trabajos");
    check("144-14 con la prueba extendida la app vuelve", t2.s === 200, `${t2.s}`);
    const sa2 = await api(tokenSa, "POST", `/api/superadmin/empresas/${empresaId}/prueba/extender`, { dias: 3 });
    check("144-15 extender vigente suma a la fecha de fin", sa2.j?.prueba_termina_en === sumarDiasFecha(hoy, 8), JSON.stringify(sa2.j));
    const sa3 = await api(tokenSa, "POST", `/api/superadmin/empresas/${empresaId}/prueba/reactivar`);
    check("144-16 reactivar no acorta una prueba vigente más larga", sa3.s === 200 && sa3.j?.prueba_termina_en === sumarDiasFecha(hoy, 8), JSON.stringify(sa3.j));
    await supabase.from("empresas").update({ prueba_termina_en: "2026-01-01" }).eq("id", empresaId);
    const sa4 = await api(tokenSa, "POST", `/api/superadmin/empresas/${empresaId}/prueba/reactivar`);
    check("144-16b reactivar una vencida deja 7 días desde hoy", sa4.s === 200 && sa4.j?.prueba_termina_en === sumarDiasFecha(hoy, 7), JSON.stringify(sa4.j));
    const pasada = await api(tokenSa, "PATCH", `/api/superadmin/empresas/${empresaId}/prueba`, { prueba_termina_en: "2020-01-01" });
    check("144-17 fecha exacta en el pasado → 400", pasada.s === 400, `${pasada.s}`);
    const hist = await api(tokenSa, "GET", `/api/superadmin/empresas/${empresaId}/prueba/historial`);
    check(
      "144-18 historial con quién y cuándo (4 cambios)",
      hist.s === 200 && hist.j?.length === 4 && hist.j.every((h: { super_admin?: { nombre?: string }; creado_en?: string }) => h.super_admin?.nombre === "E2E Super-Admin" && h.creado_en),
      JSON.stringify(hist.j)
    );
    const sinSa = await api(admin, "POST", `/api/superadmin/empresas/${empresaId}/prueba/reactivar`);
    check("144-19 un usuario normal no puede extender (401)", sinSa.s === 401, `${sinSa.s}`);
    await supabase.from("empresas").update({ plan: "pro" }).eq("id", empresaId);
    const pago = await api(tokenSa, "POST", `/api/superadmin/empresas/${empresaId}/prueba/extender`, { dias: 5 });
    check("144-20 con plan pago la prueba no aplica (409)", pago.s === 409, `${pago.s}`);

    // ── Viático: montos por defecto desde el Super-Admin ──
    const vMal = await api(tokenSa, "PATCH", `/api/superadmin/empresas/${empresaId}/viaticos`, { viatico_local_monto: -1 });
    check("144-21 viático negativo → 400", vMal.s === 400, `${vMal.s}`);
    const vOk = await api(tokenSa, "PATCH", `/api/superadmin/empresas/${empresaId}/viaticos`, { viatico_local_monto: 8000, viatico_interregional_monto: 25000 });
    const cfgViajes = await api(admin, "GET", "/api/viajes/config");
    check(
      "144-22 el Super-Admin ajusta los montos y el Admin los ve",
      vOk.s === 200 && Number(cfgViajes.j?.viatico_local_monto) === 8000 && Number(cfgViajes.j?.viatico_interregional_monto) === 25000,
      JSON.stringify(cfgViajes.j)
    );
  } finally {
    await supabase.from("empresas").update({ plan: antes?.plan ?? "pro", prueba_termina_en: antes?.prueba_termina_en ?? null }).eq("id", empresaId);
    await supabase.from("usuarios").update({ telefono: chofer?.telefono ?? null }).eq("id", ctx.u.chofer.id);
    await supabase.from("super_admins").delete().eq("id", sa.id);
  }

  // ── Integraciones ocultas ──
  const integ = await api(admin, "GET", "/api/integraciones");
  check("144-23 /api/integraciones responde 404", integ.s === 404, `${integ.s}`);
  const linkPago = await api(admin, "POST", `/api/cobros/${crypto.randomUUID()}/generar-link-pago`, { proveedor: "flow" });
  check("144-24 no se puede generar un link de pago simulado (410)", linkPago.s === 410, `${linkPago.s}`);

  // ── Empresa nueva: rubro obligatorio, sin precargas, sugerencias ──
  const correo = `e2e-registro-${crypto.randomBytes(4).toString("hex")}@bitacora-e2e.test`;
  const password = `E2e-${crypto.randomBytes(12).toString("base64url")}9`;
  const { data: nuevo } = await supabase.auth.admin.createUser({ email: correo, password, email_confirm: true });
  let nuevaEmpresaId: string | null = null;
  try {
    const token = await tokenDe(correo, password);
    const base = { nombre_empresa: "E2E Registro Transporte", nombre_usuario: "E2E Registro", acepto_documentos: true };
    const sinRubro = await api(token, "POST", "/api/registro-empresa", base);
    check("144-25 registrar sin rubro → 400", sinRubro.s === 400, `${sinRubro.s}`);
    const reg = await api(token, "POST", "/api/registro-empresa", { ...base, rubro: "transporte" });
    nuevaEmpresaId = reg.j?.empresa?.id ?? null;
    check("144-26 registrar con rubro → 201", reg.s === 201 && Boolean(nuevaEmpresaId), `${reg.s}`);
    if (nuevaEmpresaId) {
      const contar = async (tabla: string) => (await supabase.from(tabla).select("id", { count: "exact", head: true }).eq("empresa_id", nuevaEmpresaId!)).count ?? -1;
      const tablas = ["servicios", "tipos_pack", "catalogo_items", "tipos_os_trabajo", "categorias_gasto", "tipos_documento"];
      const conteos = await Promise.all(tablas.map(contar));
      check("144-27 parte sin servicios, packs, catálogo, tipos de OS, categorías ni documentos", conteos.every((c) => c === 0), tablas.map((t, i) => `${t}=${conteos[i]}`).join(" "));
      check("144-28 transporte sigue con sus 2 checklists de flota", (await contar("checklist_templates")) === 2, "");
      // El Admin exige 2FA (roles.requiere_2fa): se marca activado para pasar el gate.
      await supabase.from("usuarios").update({ mfa_activado: true, mfa_metodo: "email" }).eq("id", nuevo!.user!.id);
      const sug = await api(token, "GET", "/api/sugerencias-rubro");
      const lista = Array.isArray(sug.j) ? sug.j : [];
      const tipos = new Set(lista.map((s: { tipo_sugerencia: string }) => s.tipo_sugerencia));
      const servicio = lista.find((s: { tipo_sugerencia: string }) => s.tipo_sugerencia === "servicio");
      check(
        "144-29 sugerencias del rubro: servicios (con duración), packs, categorías, tipos de OS y documentos",
        ["servicio", "tipo_pack", "categoria_gasto", "tipo_os", "tipo_documento", "categoria_catalogo"].every((x) => tipos.has(x)) && Number(servicio?.datos?.duracion_min) > 0,
        JSON.stringify([...tipos])
      );
    }
    const { count: cosm } = await supabase.from("sugerencias_rubro").select("id", { count: "exact", head: true }).eq("rubro", "cosmetologia");
    check("144-30 hay sugerencias para cosmetología", (cosm ?? 0) > 0, `${cosm}`);
  } finally {
    if (nuevaEmpresaId) await supabase.from("empresas").delete().eq("id", nuevaEmpresaId);
    if (nuevo?.user) await supabase.auth.admin.deleteUser(nuevo.user.id);
  }
}
