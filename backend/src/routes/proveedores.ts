import { Router } from "express";
import type { Proveedor } from "@bitacora/shared";
import { formatearRut, validarRut } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const proveedoresRouter = Router();

proveedoresRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("proveedores")
      .select("*, categoria:categorias_gasto(id, nombre, color)")
      .eq("empresa_id", req.empresaId!)
      .order("nombre");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

proveedoresRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, razon_social, rut, telefono, correo, categoria_gasto_id } = req.body ?? {};

    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }

    let rutFormateado: string | null = null;
    if (rut) {
      if (!validarRut(rut)) {
        res.status(400).json({ error: "RUT inválido (verifica el dígito verificador)" });
        return;
      }
      rutFormateado = formatearRut(rut);
    }

    if (categoria_gasto_id) {
      const { data: categoria } = await supabase
        .from("categorias_gasto")
        .select("id")
        .eq("empresa_id", req.empresaId!)
        .eq("id", categoria_gasto_id)
        .maybeSingle();
      if (!categoria) {
        res.status(400).json({ error: "La categoría de gasto indicada no existe" });
        return;
      }
    }

    const { data, error } = await supabase
      .from("proveedores")
      .insert({
        empresa_id: req.empresaId!,
        nombre: nombre.trim(),
        razon_social: razon_social?.trim() || null,
        rut: rutFormateado,
        telefono: telefono?.trim() || null,
        correo: correo?.trim() || null,
        categoria_gasto_id: categoria_gasto_id || null,
      })
      .select("*, categoria:categorias_gasto(id, nombre, color)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

// POST /importar — alta masiva desde CSV (mismo patrón que
// clientes.ts). Dedupe por RUT, igual criterio. No resuelve
// categoria_gasto_id por nombre (ambiguo) — se completa editando la
// ficha.
type FilaImportProveedor = {
  nombre?: unknown;
  razon_social?: unknown;
  rut?: unknown;
  telefono?: unknown;
  correo?: unknown;
};

proveedoresRouter.post(
  "/importar",
  ah<RequestConEmpresa>(async (req, res) => {
    const filas = req.body?.filas;
    if (!Array.isArray(filas) || filas.length === 0) {
      res.status(400).json({ error: "Falta el arreglo de filas a importar" });
      return;
    }
    if (filas.length > 500) {
      res.status(400).json({ error: "Máximo 500 filas por importación — dividí el archivo en partes más chicas" });
      return;
    }

    const { data: existentes } = await supabase.from("proveedores").select("rut").eq("empresa_id", req.empresaId!).not("rut", "is", null);
    const rutsExistentes = new Set((existentes ?? []).map((p) => p.rut));

    const errores: { fila: number; motivo: string }[] = [];
    const omitidos: { fila: number; motivo: string }[] = [];
    const paraCrear: {
      empresa_id: string;
      nombre: string;
      razon_social: string | null;
      rut: string | null;
      telefono: string | null;
      correo: string | null;
    }[] = [];
    const rutsEnEsteArchivo = new Set<string>();

    (filas as FilaImportProveedor[]).forEach((f, i) => {
      const numeroFila = i + 2;
      const nombre = typeof f.nombre === "string" ? f.nombre.trim() : "";
      if (!nombre) {
        errores.push({ fila: numeroFila, motivo: "Falta el nombre" });
        return;
      }
      const rutBruto = typeof f.rut === "string" ? f.rut.trim() : "";
      if (rutBruto && !validarRut(rutBruto)) {
        errores.push({ fila: numeroFila, motivo: `RUT inválido: "${rutBruto}"` });
        return;
      }
      const rut = rutBruto ? formatearRut(rutBruto) : null;
      if (rut && (rutsExistentes.has(rut) || rutsEnEsteArchivo.has(rut))) {
        omitidos.push({ fila: numeroFila, motivo: `Ya existe un proveedor con RUT ${rut} — no se creó de nuevo` });
        return;
      }
      if (rut) rutsEnEsteArchivo.add(rut);

      paraCrear.push({
        empresa_id: req.empresaId!,
        nombre,
        razon_social: typeof f.razon_social === "string" && f.razon_social.trim() ? f.razon_social.trim() : null,
        rut,
        telefono: typeof f.telefono === "string" && f.telefono.trim() ? f.telefono.trim() : null,
        correo: typeof f.correo === "string" && f.correo.trim() ? f.correo.trim() : null,
      });
    });

    if (paraCrear.length === 0) {
      res.status(400).json({ error: "Ninguna fila es válida", errores, omitidos });
      return;
    }

    const { data: creados, error: errorImport } = await supabase.from("proveedores").insert(paraCrear).select("id");
    if (errorImport) {
      res.status(500).json({ error: errorImport.message });
      return;
    }
    res.json({ creados: creados?.length ?? 0, errores, omitidos });
  })
);

proveedoresRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, razon_social, rut, telefono, correo, categoria_gasto_id, activo } = req.body ?? {};
    const cambios: Partial<Proveedor> = {};

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (razon_social !== undefined) cambios.razon_social = razon_social?.trim() || null;
    if (rut !== undefined) {
      if (rut) {
        if (!validarRut(rut)) {
          res.status(400).json({ error: "RUT inválido (verifica el dígito verificador)" });
          return;
        }
        cambios.rut = formatearRut(rut);
      } else {
        cambios.rut = null;
      }
    }
    if (telefono !== undefined) cambios.telefono = telefono?.trim() || null;
    if (correo !== undefined) cambios.correo = correo?.trim() || null;
    if (categoria_gasto_id !== undefined) {
      if (categoria_gasto_id) {
        const { data: categoria } = await supabase
          .from("categorias_gasto")
          .select("id")
          .eq("empresa_id", req.empresaId!)
          .eq("id", categoria_gasto_id)
          .maybeSingle();
        if (!categoria) {
          res.status(400).json({ error: "La categoría de gasto indicada no existe" });
          return;
        }
      }
      cambios.categoria_gasto_id = categoria_gasto_id || null;
    }
    if (activo !== undefined) cambios.activo = Boolean(activo);

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("proveedores")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select("*, categoria:categorias_gasto(id, nombre, color)")
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Proveedor no encontrado" });
      return;
    }
    res.json(data);
  })
);
