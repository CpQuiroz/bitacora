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
// módulos, para caber en el tope del plan que elija) y Mi cuenta —lista
// cerrada de subrutas de /api/usuarios/me: perfil, sus datos, accesos,
// foto y 2FA; /me/vehiculo NO (es de la operación)—, más las preferencias
// de avisos. Borrar la empresa (Seguridad) NO queda abierto: con la
// prueba vencida no se borran datos. Cerrar sesión es del cliente
// (Supabase Auth).
const RUTAS_BASE_ABIERTAS = ["/api/plan", "/api/suscripcion", "/api/modulos", "/api/usuarios/me/mfa", "/api/notificaciones-feed/preferencias"];
const RUTAS_EXACTAS_ABIERTAS = ["/api/usuarios/me", "/api/usuarios/me/datos", "/api/usuarios/me/accesos", "/api/usuarios/me/foto"];

export function rutaPermitidaConPruebaVencida(url: string): boolean {
  const ruta = url.split("?")[0].replace(/\/+$/, "");
  return RUTAS_EXACTAS_ABIERTAS.includes(ruta) || RUTAS_BASE_ABIERTAS.some((base) => esRuta(ruta, base));
}

export const MENSAJE_PRUEBA_VENCIDA = "Tu período de prueba terminó — elige un plan para seguir usando Bitácora.";
