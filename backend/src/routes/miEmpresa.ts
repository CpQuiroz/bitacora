import { Router } from "express";
import multer from "multer";
import type { Empresa, TipoCuenta } from "@bitacora/shared";
import { comunasDeRegion, formatearRut, REGIONES, validarRut } from "@bitacora/shared";
import { supabase } from "../supabase";
import { subirLogo } from "../storage";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const miEmpresaRouter = Router();

const MONEDAS = ["CLP", "USD", "EUR", "PEN", "COP", "MXN", "ARS"];
// Debe reflejar exactamente los "valor" de web/src/lib/fuentes.ts.
const FUENTES = ["sistema", "inter", "roboto", "poppins", "montserrat", "nunito", "work-sans", "lato", "source-sans-3"];
const TIPOS_CUENTA: TipoCuenta[] = ["corriente", "vista", "ahorro"];

// Brillo percibido (fórmula YIQ) para decidir si el texto sobre el
// color de marca debe ser blanco o casi negro — evita que un admin
// elija un color claro y el texto de los botones quede ilegible.
function contrasteTexto(hex: string): string {
  const limpio = hex.replace("#", "");
  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);
  const brillo = (r * 299 + g * 587 + b * 114) / 1000;
  return brillo > 150 ? "#16161f" : "#ffffff";
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(new Error("Formato de imagen no soportado (usa jpeg, png o webp)"));
      return;
    }
    cb(null, true);
  },
});

miEmpresaRouter.post(
  "/logo",
  upload.single("logo"),
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "Falta el archivo (campo 'logo')" });
      return;
    }

    const logoUrl = await subirLogo(req.empresaId!, req.file.buffer, req.file.mimetype);

    const { data, error } = await supabase
      .from("empresas")
      .update({ logo_url: logoUrl })
      .eq("id", req.empresaId!)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

miEmpresaRouter.patch(
  "/",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const {
      nombre,
      color_primario,
      color_secundario,
      moneda,
      fuente,
      razon_social,
      giro,
      rut,
      correo_empresa,
      telefono_empresa,
      whatsapp,
      region,
      comuna,
      direccion_calle,
      direccion_numero,
      direccion_depto,
      pago_activado,
      pago_banco,
      pago_tipo_cuenta,
      pago_numero_cuenta,
      pago_titular,
      inventario_activado,
      inventario_stock_minimo_default,
    } = req.body ?? {};
    const cambios: Partial<Empresa> = {};

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (razon_social !== undefined) cambios.razon_social = razon_social?.trim() || null;
    if (giro !== undefined) cambios.giro = giro?.trim() || null;
    if (rut !== undefined) {
      if (rut !== null && rut !== "") {
        if (!validarRut(rut)) {
          res.status(400).json({ error: "RUT inválido (verifica el dígito verificador)" });
          return;
        }
        cambios.rut = formatearRut(rut);
      } else {
        cambios.rut = null;
      }
    }
    if (correo_empresa !== undefined) {
      if (correo_empresa && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo_empresa)) {
        res.status(400).json({ error: "correo_empresa inválido" });
        return;
      }
      cambios.correo_empresa = correo_empresa?.trim() || null;
    }
    if (telefono_empresa !== undefined) cambios.telefono_empresa = telefono_empresa?.trim() || null;
    if (whatsapp !== undefined) cambios.whatsapp = whatsapp?.trim() || null;
    if (region !== undefined) {
      if (region !== null && region !== "" && !REGIONES.includes(region)) {
        res.status(400).json({ error: "region inválida" });
        return;
      }
      cambios.region = region || null;
    }
    if (comuna !== undefined && comuna) {
      // La comuna se valida contra la región de este mismo request si
      // viene incluida, o si no contra la región ya guardada.
      const regionEfectiva =
        region !== undefined ? region : (await supabase.from("empresas").select("region").eq("id", req.empresaId!).single()).data?.region;
      if (!comunasDeRegion(regionEfectiva).includes(comuna)) {
        res.status(400).json({ error: "comuna inválida para la región seleccionada" });
        return;
      }
      cambios.comuna = comuna;
    } else if (comuna !== undefined) {
      cambios.comuna = null;
    }
    if (direccion_calle !== undefined) cambios.direccion_calle = direccion_calle?.trim() || null;
    if (direccion_numero !== undefined) cambios.direccion_numero = direccion_numero?.trim() || null;
    if (direccion_depto !== undefined) cambios.direccion_depto = direccion_depto?.trim() || null;
    if (pago_activado !== undefined) cambios.pago_activado = Boolean(pago_activado);
    if (pago_banco !== undefined) cambios.pago_banco = pago_banco?.trim() || null;
    if (pago_tipo_cuenta !== undefined) {
      if (pago_tipo_cuenta !== null && !TIPOS_CUENTA.includes(pago_tipo_cuenta)) {
        res.status(400).json({ error: `pago_tipo_cuenta debe ser uno de: ${TIPOS_CUENTA.join(", ")}` });
        return;
      }
      cambios.pago_tipo_cuenta = pago_tipo_cuenta || null;
    }
    if (pago_numero_cuenta !== undefined) cambios.pago_numero_cuenta = pago_numero_cuenta?.trim() || null;
    if (pago_titular !== undefined) cambios.pago_titular = pago_titular?.trim() || null;
    if (inventario_activado !== undefined) cambios.inventario_activado = Boolean(inventario_activado);
    if (inventario_stock_minimo_default !== undefined) {
      if (!Number.isInteger(inventario_stock_minimo_default) || inventario_stock_minimo_default < 0) {
        res.status(400).json({ error: "inventario_stock_minimo_default debe ser un entero positivo" });
        return;
      }
      cambios.inventario_stock_minimo_default = inventario_stock_minimo_default;
    }

    if (color_primario !== undefined) {
      if (color_primario !== null && !/^#[0-9a-fA-F]{6}$/.test(color_primario)) {
        res.status(400).json({ error: "color_primario debe ser un hex válido (#rrggbb)" });
        return;
      }
      cambios.color_primario = color_primario;
      cambios.color_primario_foreground = color_primario ? contrasteTexto(color_primario) : null;
    }
    if (color_secundario !== undefined) {
      if (color_secundario !== null && !/^#[0-9a-fA-F]{6}$/.test(color_secundario)) {
        res.status(400).json({ error: "color_secundario debe ser un hex válido (#rrggbb)" });
        return;
      }
      cambios.color_secundario = color_secundario;
    }
    if (fuente !== undefined) {
      if (fuente !== null && !FUENTES.includes(fuente)) {
        res.status(400).json({ error: `fuente debe ser una de: ${FUENTES.join(", ")}` });
        return;
      }
      cambios.fuente = fuente;
    }
    if (moneda !== undefined) {
      if (!MONEDAS.includes(moneda)) {
        res.status(400).json({ error: `moneda debe ser una de: ${MONEDAS.join(", ")}` });
        return;
      }
      cambios.moneda = moneda;
    }
    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("empresas")
      .update(cambios)
      .eq("id", req.empresaId!)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

// Zona de peligro: elimina la empresa completa — clientes, trabajos/OS,
// facturas, presupuestos, gastos, etc. se van con ella por los "on
// delete cascade" ya definidos en cada tabla. Irreversible a propósito:
// exige que el admin escriba el nombre exacto de la empresa, no solo
// un checkbox — la misma confirmación se revalida acá, no solo en la UI.
miEmpresaRouter.delete(
  "/",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { confirmar } = req.body ?? {};
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", req.empresaId!).single();
    if (typeof confirmar !== "string" || confirmar !== empresa?.nombre) {
      res.status(400).json({ error: "Escribe el nombre exacto de la empresa para confirmar" });
      return;
    }

    const { error } = await supabase.from("empresas").delete().eq("id", req.empresaId!);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).end();
  })
);
