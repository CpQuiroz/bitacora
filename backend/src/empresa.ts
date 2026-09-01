import { supabase } from "./supabase";
import type { RequestConUsuario } from "./auth";
import { ah } from "./asyncHandler";
import { registrarAccesoSiCorresponde } from "./accesos";

export interface RequestConEmpresa extends RequestConUsuario {
  empresaId?: string;
  rol?: string;
}

// Durante una sesión de impersonación de Super-Admin (debug de un
// problema reportado, ver superadmin/routes.ts) se permite mirar y
// operar liviano, pero NO tocar nada irreversible o de gobernanza:
// borrar registros, cancelar/cambiar la suscripción o el plan, editar
// datos de la empresa (incluye la autobaja), gestionar el equipo/roles,
// ni las credenciales de integraciones. Regla conservadora a propósito
// (Ley 21.719) — ajustable si estorba demasiado al debugging real.
function mutacionBloqueadaEnImpersonacion(req: RequestConUsuario): boolean {
  if (!req.impersonacion) return false;
  if (req.method === "GET" || req.method === "HEAD") return false;
  if (req.method === "DELETE") return true;
  const url = req.originalUrl;
  return (
    url.startsWith("/api/suscripcion") ||
    url.startsWith("/api/plan") ||
    url.startsWith("/api/empresa") ||
    url.startsWith("/api/usuarios") ||
    url.startsWith("/api/integraciones")
  );
}

// Va después de requiereAuth: resuelve la empresa del usuario logueado.
// 403 si el usuario todavía no completó /api/registro-empresa, o si un
// admin lo desactivó (Gestión y Control) — un solo punto de chequeo que
// protege todo el backend automáticamente.
export const requiereEmpresa = ah<RequestConEmpresa>(async (req, res, next) => {
  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("empresa_id, rol, activo, mfa_activado, empresa:empresas(estado, plan, prueba_termina_en)")
    .eq("id", req.userId!)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!usuario) {
    res.status(403).json({ error: "Completa el registro de tu empresa primero" });
    return;
  }
  if (!usuario.activo) {
    res.status(403).json({ error: "Tu cuenta fue desactivada — contacta a un administrador" });
    return;
  }
  const empresa = (usuario as unknown as { empresa: { estado: string; plan: string; prueba_termina_en: string | null } | null }).empresa;
  if (empresa?.estado === "suspendida") {
    res.status(403).json({ error: "Tu empresa fue suspendida — contacta al soporte" });
    return;
  }
  if (empresa?.estado === "dada_de_baja") {
    res.status(403).json({ error: "Esta cuenta fue dada de baja" });
    return;
  }

  // Trial vencido sin haber elegido un plan pago: empresas.plan solo
  // sale de "trial" al confirmarse una tarjeta (ver cambiarPlanEmpresa
  // en planes.ts) — así que si sigue en "trial" pasada la fecha, es
  // que nunca eligió plan. Se deja pasar /api/plan* y /api/suscripcion*
  // para que pueda elegir uno y salir del bloqueo.
  const HOY = new Date().toISOString().slice(0, 10);
  const trialVencido = empresa?.plan === "trial" && empresa.prueba_termina_en != null && empresa.prueba_termina_en < HOY;
  const rutaDePlan = req.originalUrl.startsWith("/api/plan") || req.originalUrl.startsWith("/api/suscripcion");
  if (trialVencido && !rutaDePlan) {
    res.status(403).json({
      error: "Tu período de prueba terminó — elige un plan para seguir usando Bitácora.",
      code: "TRIAL_VENCIDO",
    });
    return;
  }

  // admin/supervisor están obligados a tener 2FA activo (ver mfa.ts) —
  // se les deja pasar la contraseña (no hace falta pedirla de nuevo) y
  // entrar a su propio perfil/2FA para poder configurarlo, pero
  // cualquier otra ruta queda bloqueada hasta que lo activen.
  const rolExigeMfa = usuario.rol === "admin" || usuario.rol === "supervisor";
  const rutaExceptuada = req.originalUrl.startsWith("/api/usuarios/me");
  if (rolExigeMfa && !usuario.mfa_activado && !rutaExceptuada) {
    res.status(403).json({
      error: "Tu rol requiere activar la verificación en dos pasos antes de continuar — actívala en Configuración > Seguridad.",
      code: "MFA_REQUERIDA",
    });
    return;
  }

  if (mutacionBloqueadaEnImpersonacion(req)) {
    res.status(403).json({
      error: "Esta acción no está permitida durante una sesión de impersonación de Super-Admin.",
      code: "IMPERSONACION_SOLO_LECTURA",
    });
    return;
  }

  req.empresaId = usuario.empresa_id;
  req.rol = usuario.rol;
  // No registrar el acceso como si fuera un login del usuario cuando en
  // realidad es el Super-Admin impersonando — ensuciaría su historial de
  // Seguridad. La impersonación queda en super_admin_auditoria.
  if (!req.impersonacion) {
    void registrarAccesoSiCorresponde(req.userId!, usuario.empresa_id, req.ip ?? null, req.headers["user-agent"] ?? null);
  }
  next();
});
