import { supabase } from "./supabase";

const VENTANA_MS = 4 * 60 * 60 * 1000;

// Igual criterio que la generación perezosa de notificaciones: no se
// registra en cada request (inundaría la tabla), solo si el último
// acceso conocido del usuario es más viejo que la ventana — funciona
// como una huella de "sesión nueva" sin necesitar un evento de login
// real (el login pasa directo entre el navegador y Supabase Auth, el
// backend nunca lo ve).
//
// El "último acceso" se rastrea en memoria, no con un select previo a la
// base — una carga de página dispara varios requests en paralelo, todos
// pasando por requiereEmpresa, y un check-then-insert contra la BD deja
// una ventana de carrera real (los dos leen "sin acceso reciente" antes
// de que cualquiera alcance a escribir). Como Node corre el chequeo y el
// Map.set en el mismo tick síncrono, no hay forma de que dos requests
// paralelos pasen el filtro a la vez.
const ultimosAccesos = new Map<string, number>();

export function registrarAccesoSiCorresponde(usuarioId: string, empresaId: string, ip: string | null, userAgent: string | null): void {
  const ahora = Date.now();
  const ultimo = ultimosAccesos.get(usuarioId);
  if (ultimo && ahora - ultimo < VENTANA_MS) return;
  ultimosAccesos.set(usuarioId, ahora);

  supabase
    .from("accesos_usuario")
    .insert({ usuario_id: usuarioId, empresa_id: empresaId, ip, user_agent: userAgent })
    .then(({ error }) => {
      if (error) console.error("Error registrando acceso:", error.message);
    });
}
