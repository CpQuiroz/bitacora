import { Router } from "express";
import type { DatosLaborales, Liquidacion, ParametroPrevisional } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { asegurarParametros, obtenerParametros } from "../remuneraciones/parametros";
import { armarLiquidacion, type VariablesMes } from "../remuneraciones/calcular";
import { generarPdfLiquidacion } from "../generarPdfLiquidacion";
import { subirPdfLiquidacion, urlFirmadaPdfLiquidacion } from "../storage";
import { generarArchivoPrevired, type FilaPrevired } from "../remuneraciones/archivoPrevired";
import { generarResumenPrevisional } from "../remuneraciones/resumenPrevisional";
import { generarLibroRemuneracionesDT } from "../remuneraciones/libroRemuneracionesDT";

export const remuneracionesRouter = Router();

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Resuelve el nombre del colaborador aparte (el cliente tipado de
// Supabase no infiere el embed para tablas nuevas — mismo criterio que
// documentos.ts / notificacionesFeed).
async function conNombreColaborador<T extends { usuario_id: string | null }>(
  empresaId: string,
  filas: T[]
): Promise<(T & { colaborador: { id: string; nombre: string } | null })[]> {
  const ids = [...new Set(filas.map((f) => f.usuario_id).filter((x): x is string => Boolean(x)))];
  const { data } = ids.length
    ? await supabase.from("usuarios").select("id, nombre").eq("empresa_id", empresaId).in("id", ids)
    : { data: [] as { id: string; nombre: string }[] };
  const nombre = new Map((data ?? []).map((u) => [u.id, u.nombre]));
  return filas.map((f) => ({
    ...f,
    colaborador: f.usuario_id ? { id: f.usuario_id, nombre: nombre.get(f.usuario_id) ?? "—" } : null,
  }));
}
const CONTRATOS = ["indefinido", "plazo_fijo", "por_obra"];
const SALUDES = ["fonasa", "isapre"];

// ── Parámetros previsionales del período ─────────────────────────────
remuneracionesRouter.get(
  "/parametros/:periodo",
  ah<RequestConEmpresa>(async (req, res) => {
    const { periodo } = req.params;
    if (!PERIODO_RE.test(periodo)) {
      res.status(400).json({ error: "periodo inválido (YYYY-MM)" });
      return;
    }
    const params = await asegurarParametros(periodo);
    if (!params) {
      res.status(503).json({ error: "No se pudo obtener UF/UTM (mindicador.cl no responde). Cárgalas a mano y vuelve a intentar." });
      return;
    }
    const { data: afp } = await supabase.from("afp_parametros").select("*").eq("periodo", periodo).order("nombre");
    res.json({ parametros: params, afp: afp ?? [] });
  })
);

remuneracionesRouter.patch(
  "/parametros/:periodo",
  ah<RequestConEmpresa>(async (req, res) => {
    const { periodo } = req.params;
    if (!PERIODO_RE.test(periodo)) {
      res.status(400).json({ error: "periodo inválido" });
      return;
    }
    const b = req.body ?? {};
    const cambios: Partial<ParametroPrevisional> = {};
    for (const campo of ["uf", "utm", "ingreso_minimo", "tope_imponible_uf", "tope_afc_uf", "tope_gratificacion_mensual", "tasa_sis", "tasa_mutual_base"] as const) {
      if (b[campo] !== undefined) {
        const n = Number(b[campo]);
        if (!Number.isFinite(n) || n < 0) {
          res.status(400).json({ error: `${campo} inválido` });
          return;
        }
        (cambios as Record<string, unknown>)[campo] = n;
      }
    }
    if (Array.isArray(b.tramos_impuesto)) cambios.tramos_impuesto = b.tramos_impuesto;
    if (Object.keys(cambios).length > 0) {
      cambios.fuente = "manual";
      cambios.actualizado_en = new Date().toISOString();
      const { error } = await supabase.from("parametros_previsionales").update(cambios).eq("periodo", periodo);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
    }
    // Comisiones AFP: { afp: [{ afp, tasa_comision }] }
    if (Array.isArray(b.afp)) {
      for (const a of b.afp) {
        if (typeof a?.afp === "string" && Number.isFinite(Number(a.tasa_comision))) {
          await supabase.from("afp_parametros").update({ tasa_comision: Number(a.tasa_comision) }).eq("periodo", periodo).eq("afp", a.afp);
        }
      }
    }
    const params = await obtenerParametros(periodo);
    const { data: afp } = await supabase.from("afp_parametros").select("*").eq("periodo", periodo).order("nombre");
    res.json({ parametros: params, afp: afp ?? [] });
  })
);

// ── Datos laborales por colaborador ─────────────────────────────────
remuneracionesRouter.get(
  "/datos-laborales",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: usuarios } = await supabase
      .from("usuarios")
      .select("id, nombre, rol, activo, rut")
      .eq("empresa_id", req.empresaId!)
      .neq("rol", "admin") // los admin normalmente no van en nómina; se pueden agregar a mano si hace falta
      .order("nombre");
    const { data: datos } = await supabase.from("datos_laborales").select("*").eq("empresa_id", req.empresaId!);
    const porUsuario = new Map((datos ?? []).map((d) => [d.usuario_id, d]));
    res.json(
      (usuarios ?? []).map((u) => ({
        usuario: u,
        datos_laborales: (porUsuario.get(u.id) as DatosLaborales | undefined) ?? null,
      }))
    );
  })
);

remuneracionesRouter.put(
  "/datos-laborales/:usuarioId",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.usuarioId)
      .maybeSingle();
    if (!usuario) {
      res.status(404).json({ error: "Colaborador no encontrado" });
      return;
    }
    const b = req.body ?? {};
    if (b.tipo_contrato && !CONTRATOS.includes(b.tipo_contrato)) {
      res.status(400).json({ error: `tipo_contrato debe ser: ${CONTRATOS.join(", ")}` });
      return;
    }
    if (b.sistema_salud && !SALUDES.includes(b.sistema_salud)) {
      res.status(400).json({ error: "sistema_salud debe ser fonasa o isapre" });
      return;
    }
    const num = (v: unknown, def = 0) => (v === "" || v == null ? def : Number(v));
    const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const fila = {
      usuario_id: req.params.usuarioId,
      empresa_id: req.empresaId!,
      tipo_contrato: b.tipo_contrato ?? "indefinido",
      fecha_ingreso: b.fecha_ingreso || null,
      sueldo_base: Math.max(0, num(b.sueldo_base)),
      gratificacion_legal: b.gratificacion_legal !== false,
      colacion_mensual: Math.max(0, num(b.colacion_mensual)),
      movilizacion_mensual: Math.max(0, num(b.movilizacion_mensual)),
      afp: b.afp || null,
      sistema_salud: b.sistema_salud ?? "fonasa",
      plan_isapre_uf: b.plan_isapre_uf ? Number(b.plan_isapre_uf) : null,
      plan_isapre_pesos: b.plan_isapre_pesos ? Number(b.plan_isapre_pesos) : null,
      cargas_familiares: Math.max(0, Math.trunc(num(b.cargas_familiares))),
      tasa_mutual_empresa: b.tasa_mutual_empresa ? Number(b.tasa_mutual_empresa) : null,
      codigo_isapre: txt(b.codigo_isapre),
      apellido_paterno: txt(b.apellido_paterno),
      apellido_materno: txt(b.apellido_materno),
      activo: b.activo !== false,
      actualizado_en: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("datos_laborales").upsert(fila).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    // El RUT vive en `usuarios` (identidad, no dato del módulo).
    if (b.rut !== undefined) {
      await supabase.from("usuarios").update({ rut: txt(b.rut) }).eq("empresa_id", req.empresaId!).eq("id", req.params.usuarioId);
    }
    res.json(data);
  })
);

// ── Liquidaciones ──────────────────────────────────────────────────
remuneracionesRouter.get(
  "/liquidaciones",
  ah<RequestConEmpresa>(async (req, res) => {
    const periodo = typeof req.query.periodo === "string" ? req.query.periodo : "";
    let q = supabase
      .from("liquidaciones")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("periodo", { ascending: false })
      .order("creado_en", { ascending: false });
    if (PERIODO_RE.test(periodo)) q = q.eq("periodo", periodo);
    const { data, error } = await q;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(await conNombreColaborador(req.empresaId!, (data ?? []) as Liquidacion[]));
  })
);

remuneracionesRouter.get(
  "/liquidaciones/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data } = await supabase
      .from("liquidaciones")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!data) {
      res.status(404).json({ error: "Liquidación no encontrada" });
      return;
    }
    res.json((await conNombreColaborador(req.empresaId!, [data as Liquidacion]))[0]);
  })
);

// Genera (o regenera si son borrador) las liquidaciones del período.
remuneracionesRouter.post(
  "/liquidaciones/generar",
  ah<RequestConEmpresa>(async (req, res) => {
    const { periodo, usuario_ids } = req.body ?? {};
    if (!PERIODO_RE.test(periodo)) {
      res.status(400).json({ error: "periodo inválido (YYYY-MM)" });
      return;
    }
    const params = await asegurarParametros(periodo);
    if (!params) {
      res.status(503).json({ error: "Faltan UF/UTM del período. Cárgalas en Parámetros y reintenta." });
      return;
    }

    let dq = supabase.from("datos_laborales").select("*").eq("empresa_id", req.empresaId!).eq("activo", true);
    if (Array.isArray(usuario_ids) && usuario_ids.length > 0) dq = dq.in("usuario_id", usuario_ids);
    const { data: datos } = await dq;
    if (!datos || datos.length === 0) {
      res.status(400).json({ error: "Ningún colaborador tiene datos laborales cargados." });
      return;
    }

    // No pisar las que ya están emitidas.
    const { data: emitidas } = await supabase
      .from("liquidaciones")
      .select("usuario_id")
      .eq("empresa_id", req.empresaId!)
      .eq("periodo", periodo)
      .eq("estado", "emitida");
    const bloqueados = new Set((emitidas ?? []).map((e) => e.usuario_id));

    let creadas = 0;
    let omitidas = 0;
    for (const d of datos as DatosLaborales[]) {
      if (bloqueados.has(d.usuario_id)) {
        omitidas++;
        continue;
      }
      const armada = await armarLiquidacion(periodo, d, params, {});
      const { error } = await supabase.from("liquidaciones").upsert(
        {
          ...armada,
          empresa_id: req.empresaId!,
          usuario_id: d.usuario_id,
          estado: "borrador",
          pdf_url: null,
          creado_por: req.userId!,
          actualizado_en: new Date().toISOString(),
        },
        { onConflict: "empresa_id,usuario_id,periodo" }
      );
      if (error) console.error("Error generando liquidación:", d.usuario_id, error.message);
      else creadas++;
    }
    res.json({ periodo, generadas: creadas, omitidas_emitidas: omitidas });
  })
);

remuneracionesRouter.patch(
  "/liquidaciones/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: liq } = await supabase
      .from("liquidaciones")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!liq) {
      res.status(404).json({ error: "Liquidación no encontrada" });
      return;
    }
    if ((liq as Liquidacion).estado === "emitida") {
      res.status(400).json({ error: "La liquidación ya fue emitida y no se puede editar." });
      return;
    }
    const params = await obtenerParametros((liq as Liquidacion).periodo);
    if (!params) {
      res.status(503).json({ error: "Faltan los parámetros del período." });
      return;
    }
    const { data: datos } = await supabase
      .from("datos_laborales")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("usuario_id", (liq as Liquidacion).usuario_id!)
      .maybeSingle();
    if (!datos) {
      res.status(400).json({ error: "El colaborador ya no tiene datos laborales." });
      return;
    }

    const b = req.body ?? {};
    const num = (v: unknown, prev: number) => (v === undefined ? prev : Number(v) || 0);
    const variables: VariablesMes = {
      dias_trabajados: b.dias_trabajados === undefined ? (liq as Liquidacion).dias_trabajados : Math.min(30, Math.max(0, Math.trunc(Number(b.dias_trabajados)))),
      horas_extra: num(b.horas_extra, (liq as Liquidacion).horas_extra),
      otros_imponibles: num(b.otros_imponibles, (liq as Liquidacion).otros_imponibles),
      otros_no_imponibles: num(b.otros_no_imponibles, (liq as Liquidacion).otros_no_imponibles),
      asignacion_familiar: num(b.asignacion_familiar, (liq as Liquidacion).asignacion_familiar),
      otros_descuentos: num(b.otros_descuentos, (liq as Liquidacion).otros_descuentos),
    };

    const armada = await armarLiquidacion((liq as Liquidacion).periodo, datos as DatosLaborales, params, variables);
    const { data, error } = await supabase
      .from("liquidaciones")
      .update({ ...armada, actualizado_en: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((await conNombreColaborador(req.empresaId!, [data as Liquidacion]))[0]);
  })
);

remuneracionesRouter.post(
  "/liquidaciones/:id/emitir",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: liq } = await supabase
      .from("liquidaciones")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!liq) {
      res.status(404).json({ error: "Liquidación no encontrada" });
      return;
    }
    const L = liq as Liquidacion;
    const [conNombre] = await conNombreColaborador(req.empresaId!, [L]);

    const [{ data: empresa }, { data: datos }] = await Promise.all([
      supabase.from("empresas").select("nombre, rut, logo_url, color_primario").eq("id", req.empresaId!).single(),
      supabase.from("datos_laborales").select("*").eq("empresa_id", req.empresaId!).eq("usuario_id", L.usuario_id!).maybeSingle(),
    ]);
    const dl = datos as DatosLaborales | null;

    const pdf = await generarPdfLiquidacion({
      empresaNombre: empresa?.nombre ?? "Empresa",
      empresaRut: empresa?.rut ?? null,
      empresaLogoUrl: empresa?.logo_url ?? null,
      colorPrimario: empresa?.color_primario ?? null,
      colaboradorNombre: conNombre.colaborador?.nombre ?? "Colaborador",
      tipoContrato: dl?.tipo_contrato ?? "indefinido",
      fechaIngreso: dl?.fecha_ingreso ?? null,
      afp: dl?.afp ?? null,
      sistemaSalud: dl?.sistema_salud ?? "fonasa",
      periodo: L.periodo,
      liquidacion: L,
    });
    const key = await subirPdfLiquidacion(req.empresaId!, L.id, pdf);

    const { data, error } = await supabase
      .from("liquidaciones")
      .update({ estado: "emitida", pdf_url: key, emitida_en: new Date().toISOString(), actualizado_en: new Date().toISOString() })
      .eq("id", L.id)
      .select("*")
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((await conNombreColaborador(req.empresaId!, [data as Liquidacion]))[0]);
  })
);

remuneracionesRouter.get(
  "/liquidaciones/:id/pdf",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data } = await supabase
      .from("liquidaciones")
      .select("pdf_url")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!data?.pdf_url) {
      res.status(404).json({ error: "Esta liquidación todavía no fue emitida." });
      return;
    }
    res.json({ url: await urlFirmadaPdfLiquidacion(data.pdf_url) });
  })
);

// ── Exportar archivos del período (Previred / DT / resumen) ──────────
// Solo cuentan las liquidaciones EMITIDAS. Se descarga y se sube a
// previred.cl / la DT — Bitácora no presenta nada.
type Formato = "previred" | "lre" | "resumen";

remuneracionesRouter.get(
  "/exportar/:formato",
  ah<RequestConEmpresa>(async (req, res) => {
    const formato = req.params.formato as Formato;
    const periodo = typeof req.query.periodo === "string" ? req.query.periodo : "";
    if (!["previred", "lre", "resumen"].includes(formato) || !PERIODO_RE.test(periodo)) {
      res.status(400).json({ error: "Parámetros inválidos (formato + periodo YYYY-MM)" });
      return;
    }

    const { data: liqs } = await supabase
      .from("liquidaciones")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("periodo", periodo)
      .eq("estado", "emitida");
    if (!liqs || liqs.length === 0) {
      res.status(400).json({ error: "No hay liquidaciones emitidas en este período. Emitilas primero." });
      return;
    }

    const usuarioIds = (liqs as Liquidacion[]).map((l) => l.usuario_id).filter((x): x is string => Boolean(x));
    const [{ data: datosL }, { data: usuarios }] = await Promise.all([
      supabase.from("datos_laborales").select("*").eq("empresa_id", req.empresaId!).in("usuario_id", usuarioIds),
      supabase.from("usuarios").select("id, nombre, rut").eq("empresa_id", req.empresaId!).in("id", usuarioIds),
    ]);
    const datosPorUsuario = new Map((datosL ?? []).map((d) => [d.usuario_id, d]));
    const usuarioPorId = new Map((usuarios ?? []).map((u) => [u.id, u]));

    const filas: FilaPrevired[] = (liqs as Liquidacion[])
      .filter((l) => l.usuario_id && datosPorUsuario.has(l.usuario_id))
      .map((l) => ({
        liquidacion: l,
        datos: datosPorUsuario.get(l.usuario_id!)!,
        usuario: {
          nombre: usuarioPorId.get(l.usuario_id!)?.nombre ?? "",
          rut: usuarioPorId.get(l.usuario_id!)?.rut ?? null,
        },
      }));

    const sinRut = filas.filter((f) => !f.usuario.rut).length;

    let contenido: string;
    let nombreArchivo: string;
    let contentType: string;
    if (formato === "previred") {
      contenido = generarArchivoPrevired(filas, periodo);
      nombreArchivo = `previred_${periodo}.txt`;
      contentType = "text/plain; charset=utf-8";
    } else if (formato === "lre") {
      contenido = generarLibroRemuneracionesDT(filas);
      nombreArchivo = `libro_remuneraciones_${periodo}.csv`;
      contentType = "text/csv; charset=utf-8";
    } else {
      contenido = generarResumenPrevisional(filas);
      nombreArchivo = `resumen_previsional_${periodo}.csv`;
      contentType = "text/csv; charset=utf-8";
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
    if (sinRut > 0) res.setHeader("X-Aviso", `${sinRut} colaborador(es) sin RUT — cargalo en Datos del equipo`);
    res.send(contenido);
  })
);
