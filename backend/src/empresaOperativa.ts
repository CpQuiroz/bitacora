// ============================================================
// Empresa operativa (tarea 144): activa y sin la prueba vencida. Con la
// prueba vencida la app queda bloqueada entera (web, mobile, portal del
// cliente, reserva online y bot de WhatsApp) salvo Plan/pago, Mi cuenta y
// cerrar sesión. Nunca se borran datos: al confirmarse el pago
// (cambiarPlanEmpresa) o si el Super-Admin extiende la prueba, vuelve todo.
// ============================================================
import { pruebaVencida } from "@bitacora/shared";
import { supabase } from "./supabase";
import { hoyChile } from "./fechaChile";

export type EstadoEmpresa = { estado: string; plan: string; prueba_termina_en: string | null };

export function empresaConPruebaVencida(empresa: Pick<EstadoEmpresa, "plan" | "prueba_termina_en"> | null | undefined): boolean {
  return Boolean(empresa) && pruebaVencida(empresa!.plan, empresa!.prueba_termina_en, hoyChile());
}

// Para las entradas públicas (portal, reserva online, WhatsApp), que no
// pasan por requiereEmpresa.
export async function empresaOperativa(empresaId: string): Promise<boolean> {
  const { data } = await supabase.from("empresas").select("estado, plan, prueba_termina_en").eq("id", empresaId).maybeSingle();
  return Boolean(data) && data!.estado === "activa" && !empresaConPruebaVencida(data);
}

// ¿La URL es `base` o algo debajo de `base/`? Compara por segmento (un
// startsWith("/api/plan") a secas también calza con /api/plantillas).
export function esRuta(url: string, base: string): boolean {
  return url === base || url.startsWith(`${base}/`) || url.startsWith(`${base}?`);
}

// Lo único que sigue abierto con la prueba vencida: Plan y pago (los
// módulos, para caber en el tope del plan que elija), Mi cuenta (perfil,
// 2FA, accesos, sus datos, preferencias de avisos). Borrar la empresa
// (Seguridad) NO queda abierto: con la prueba vencida no se borran datos.
// Cerrar sesión es del cliente (Supabase Auth).
export function rutaPermitidaConPruebaVencida(url: string): boolean {
  const ruta = url.split("?")[0];
  return (
    esRuta(ruta, "/api/plan") ||
    esRuta(ruta, "/api/suscripcion") ||
    esRuta(ruta, "/api/modulos") ||
    esRuta(ruta, "/api/usuarios/me") ||
    esRuta(ruta, "/api/notificaciones-feed/preferencias")
  );
}

export const MENSAJE_PRUEBA_VENCIDA = "Tu período de prueba terminó — elige un plan para seguir usando Bitácora.";
