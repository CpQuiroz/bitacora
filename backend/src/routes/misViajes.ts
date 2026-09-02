import { Router } from "express";
import multer from "multer";
import { supabase } from "../supabase";
import { subirFotoGuiaConNombre } from "../storage";
import { calcularMontos } from "../viajesMontos";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

// Viajes de un colaborador desde la app móvil / el bot de WhatsApp.
// Va aparte de /api/viajes (que exige requiereModulo("viajes"),
// disponible solo para supervisor/admin) porque un chofer necesita
// registrar y ver LOS SUYOS sin tener el módulo completo. Todo queda
// scopeado a chofer_id = el usuario autenticado, en estado 'borrador'
// para que la oficina lo revise.
export const misViajesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

misViajesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("viajes")
      .select("*, cliente_info:clientes(id, nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("chofer_id", req.userId!)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(100);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

misViajesRouter.post(
  "/",
  upload.single("foto"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { cliente_id, numero_guia, origen, destino, equipo_id, km_inicial, km_final, subtotal, aplica_iva } = req.body ?? {};

    if (typeof numero_guia !== "string" || !numero_guia.trim()) {
      res.status(400).json({ error: "Falta el número de guía" });
      return;
    }
    if (typeof origen !== "string" || !origen.trim() || typeof destino !== "string" || !destino.trim()) {
      res.status(400).json({ error: "Falta origen o destino" });
      return;
    }
    const subtotalNum = Number(subtotal);
    if (!Number.isFinite(subtotalNum) || subtotalNum <= 0) {
      res.status(400).json({ error: "Monto inválido" });
      return;
    }

    // Cliente: obligatorio y de la misma empresa.
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, nombre")
      .eq("empresa_id", req.empresaId!)
      .eq("id", typeof cliente_id === "string" ? cliente_id : "")
      .maybeSingle();
    if (!cliente) {
      res.status(400).json({ error: "Selecciona un cliente válido" });
      return;
    }

    // Equipo opcional, validado contra la empresa.
    let equipoId: string | null = null;
    if (typeof equipo_id === "string" && equipo_id) {
      const { data: equipo } = await supabase
        .from("equipos")
        .select("id")
        .eq("empresa_id", req.empresaId!)
        .eq("id", equipo_id)
        .maybeSingle();
      equipoId = equipo?.id ?? null;
    }

    let fotoKey: string | null = null;
    if (req.file) {
      fotoKey = await subirFotoGuiaConNombre(req.empresaId!, numero_guia.trim(), req.file.buffer, req.file.mimetype);
    }

    const aplicaIva = aplica_iva === "false" || aplica_iva === false ? false : true;
    const { subtotal: sub, iva, total } = calcularMontos(subtotalNum, aplicaIva);
    const aNum = (v: unknown) => (v === "" || v == null ? null : Number(v));

    const { data, error } = await supabase
      .from("viajes")
      .insert({
        empresa_id: req.empresaId!,
        fecha: new Date().toISOString().slice(0, 10),
        numero_guia: numero_guia.trim(),
        cliente: cliente.nombre,
        cliente_id: cliente.id,
        chofer_id: req.userId!,
        equipo_id: equipoId,
        origen: origen.trim(),
        destino: destino.trim(),
        km_inicial: aNum(km_inicial),
        km_final: aNum(km_final),
        subtotal: sub,
        aplica_iva: aplicaIva,
        iva,
        total,
        estado: "borrador",
        origen_captura: "app",
        foto_guia_url: fotoKey,
      })
      .select("*, cliente_info:clientes(id, nombre)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);
