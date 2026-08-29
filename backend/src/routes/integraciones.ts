import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import type { CategoriaIntegracion, ProveedorIntegracion } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";
import { cifrarJson, descifrarJson } from "../crypto";
import { env } from "../env";

export const integracionesRouter = Router();

const DEFINICIONES: Record<
  ProveedorIntegracion,
  { nombre: string; descripcion: string; categoria: CategoriaIntegracion; campos: string[]; campoPrincipal: string }
> = {
  webpay: {
    nombre: "Webpay / Transbank",
    descripcion: "Pagos con tarjeta vía Transbank",
    categoria: "pagos",
    campos: ["commerce_code", "api_key"],
    campoPrincipal: "api_key",
  },
  flow: {
    nombre: "Flow",
    descripcion: "Pasarela de pagos chilena",
    categoria: "pagos",
    campos: ["api_key", "secret_key"],
    campoPrincipal: "secret_key",
  },
  mercadopago: {
    nombre: "Mercado Pago",
    descripcion: "Pagos con tarjeta y billetera digital",
    categoria: "pagos",
    campos: ["access_token"],
    campoPrincipal: "access_token",
  },
  whatsapp: {
    nombre: "WhatsApp",
    descripcion: "Envía cotizaciones, OS y cobranzas por WhatsApp",
    categoria: "comunicacion",
    campos: ["instance_id", "api_token", "numero"],
    campoPrincipal: "api_token",
  },
  anthropic: {
    nombre: "Anthropic Claude API",
    descripcion: "Genera los informes ejecutivos y análisis con IA",
    categoria: "ia",
    campos: ["api_key"],
    campoPrincipal: "api_key",
  },
  google_document_ai: {
    nombre: "Google Document AI",
    descripcion: "Extrae monto, fecha, proveedor e ítems de facturas/boletas escaneadas",
    categoria: "ia",
    campos: ["processor_id", "service_account_json"],
    campoPrincipal: "service_account_json",
  },
};

const PROVEEDORES = Object.keys(DEFINICIONES) as ProveedorIntegracion[];

function proveedorValido(p: string): p is ProveedorIntegracion {
  return (PROVEEDORES as string[]).includes(p);
}

function enmascarar(valor: unknown): string | null {
  if (typeof valor !== "string" || !valor) return null;
  if (valor.length <= 4) return "••••";
  return `••••${valor.slice(-4)}`;
}

// Nunca se devuelve "credenciales" tal cual al frontend — solo un
// preview enmascarado del campo principal (últimos 4 caracteres). En la
// base viaja cifrado (crypto.ts); acá es el único lugar donde se
// descifra, y solo para calcular el preview — el valor completo nunca
// sale de esta función.
function aRespuestaPublica(proveedor: ProveedorIntegracion, fila: Record<string, unknown> | null) {
  const def = DEFINICIONES[proveedor];
  const credenciales = descifrarJson(fila?.credenciales as string | undefined, env.INTEGRACIONES_ENCRYPTION_KEY, "INTEGRACIONES_ENCRYPTION_KEY");
  return {
    proveedor,
    nombre: def.nombre,
    descripcion: def.descripcion,
    categoria: def.categoria,
    campos: def.campos,
    conectado: Boolean(fila?.conectado),
    conectado_en: (fila?.conectado_en as string | null) ?? null,
    preview: enmascarar(credenciales[def.campoPrincipal]),
  };
}

integracionesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase.from("integraciones").select("*").eq("empresa_id", req.empresaId!);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const porProveedor = new Map((data ?? []).map((f) => [f.proveedor, f]));
    res.json(PROVEEDORES.map((p) => aRespuestaPublica(p, porProveedor.get(p) ?? null)));
  })
);

integracionesRouter.patch(
  "/:proveedor",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (!proveedorValido(req.params.proveedor)) {
      res.status(400).json({ error: `proveedor debe ser uno de: ${PROVEEDORES.join(", ")}` });
      return;
    }
    const def = DEFINICIONES[req.params.proveedor];
    const credenciales: Record<string, string> = {};
    for (const campo of def.campos) {
      const valor = req.body?.[campo];
      if (typeof valor === "string" && valor.trim()) credenciales[campo] = valor.trim();
    }
    if (Object.keys(credenciales).length === 0) {
      res.status(400).json({ error: "Falta al menos un campo de credenciales" });
      return;
    }

    const { data: existente } = await supabase
      .from("integraciones")
      .select("id")
      .eq("empresa_id", req.empresaId!)
      .eq("proveedor", req.params.proveedor)
      .maybeSingle();

    // Guardar credenciales nuevas exige volver a probar la conexión.
    const cambios = { credenciales: cifrarJson(credenciales, env.INTEGRACIONES_ENCRYPTION_KEY, "INTEGRACIONES_ENCRYPTION_KEY"), conectado: false, conectado_en: null, actualizado_en: new Date().toISOString() };

    const { data, error } = existente
      ? await supabase.from("integraciones").update(cambios).eq("id", existente.id).select().single()
      : await supabase
          .from("integraciones")
          .insert({ empresa_id: req.empresaId!, proveedor: req.params.proveedor, categoria: def.categoria, ...cambios })
          .select()
          .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(aRespuestaPublica(req.params.proveedor, data));
  })
);

integracionesRouter.post(
  "/:proveedor/probar",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (!proveedorValido(req.params.proveedor)) {
      res.status(400).json({ error: `proveedor debe ser uno de: ${PROVEEDORES.join(", ")}` });
      return;
    }
    const proveedor = req.params.proveedor;
    const { data: fila } = await supabase
      .from("integraciones")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("proveedor", proveedor)
      .maybeSingle();

    const credenciales = descifrarJson(fila?.credenciales as string | undefined, env.INTEGRACIONES_ENCRYPTION_KEY, "INTEGRACIONES_ENCRYPTION_KEY");
    if (!fila || Object.keys(credenciales).length === 0) {
      res.status(400).json({ error: "Primero guarda las credenciales" });
      return;
    }

    let ok = true;
    let mensaje = "Datos guardados — esta integración no tiene verificación en vivo todavía.";

    if (proveedor === "anthropic") {
      try {
        const cliente = new Anthropic({ apiKey: credenciales.api_key as string });
        await cliente.models.list({ limit: 1 });
        mensaje = "Conexión verificada con la API de Anthropic.";
      } catch (err) {
        ok = false;
        mensaje = err instanceof Anthropic.AuthenticationError ? "La API key no es válida." : "No se pudo conectar con Anthropic.";
      }
    }

    const { data, error } = await supabase
      .from("integraciones")
      .update({ conectado: ok, conectado_en: ok ? new Date().toISOString() : null })
      .eq("id", fila.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ ok, mensaje, integracion: aRespuestaPublica(proveedor, data) });
  })
);

integracionesRouter.delete(
  "/:proveedor",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (!proveedorValido(req.params.proveedor)) {
      res.status(400).json({ error: `proveedor debe ser uno de: ${PROVEEDORES.join(", ")}` });
      return;
    }
    await supabase
      .from("integraciones")
      .update({ credenciales: "{}", conectado: false, conectado_en: null })
      .eq("empresa_id", req.empresaId!)
      .eq("proveedor", req.params.proveedor);
    res.json(aRespuestaPublica(req.params.proveedor, null));
  })
);
