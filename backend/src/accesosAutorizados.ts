// ============================================================
// BITÁCORA — Resolución de acceso por correo/dominio (migración 72).
//
// Cuando un usuario autenticado NO tiene fila en `usuarios` todavía,
// /api/me llama a resolverAccesoParaLogin() para decidir qué hacer:
//   - "entra"      → el correo/dominio está autorizado en 1 empresa;
//                     se crea la fila en `usuarios` con ese rol.
//   - "multiple"   → autorizado en varias empresas → se niega (una
//                     persona = una empresa; que lo inviten directo).
//   - "onboarding" → sin autorización pero se autorregistró en /registro
//                     (user_metadata.self_signup) → puede crear empresa.
//   - "denegado"   → sin autorización y sin autorregistro → fuera.
//
// OJO: distinto de accesos.ts (ese registra la bitácora de "sesión
// nueva" en accesos_usuario; esto decide si la cuenta puede entrar).
// ============================================================
import { supabase } from "./supabase";
import { empresaPuedeUsarRol } from "./roles";

export function normalizarCorreo(email: string): string {
  return email.trim().toLowerCase();
}

export function dominioDeCorreo(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

export type AccesoAutorizado = { empresaId: string; rol: string; tipo: "correo" | "dominio" };

// Todas las autorizaciones que matchean un correo — por correo exacto o
// por dominio. Si una empresa autoriza el correo por las dos vías, gana
// la fila de correo exacto (su rol es más específico).
export async function resolverAccesosPorCorreo(email: string): Promise<AccesoAutorizado[]> {
  const correo = normalizarCorreo(email);
  const dominio = dominioDeCorreo(correo);
  const valores = dominio ? [correo, dominio] : [correo];

  const { data, error } = await supabase
    .from("empresa_accesos_autorizados")
    .select("empresa_id, tipo, valor, rol")
    .in("valor", valores);
  if (error || !data) return [];

  const porEmpresa = new Map<string, AccesoAutorizado>();
  for (const fila of data) {
    // fila.valor tiene que coincidir con su tipo (evita que un correo
    // guardado como 'dominio' matchee por la lista `in`, y viceversa).
    if (fila.tipo === "correo" && fila.valor !== correo) continue;
    if (fila.tipo === "dominio" && fila.valor !== dominio) continue;
    const previo = porEmpresa.get(fila.empresa_id);
    if (!previo || (previo.tipo === "dominio" && fila.tipo === "correo")) {
      porEmpresa.set(fila.empresa_id, { empresaId: fila.empresa_id, rol: fila.rol, tipo: fila.tipo });
    }
  }
  return [...porEmpresa.values()];
}

export type ResultadoAcceso =
  | { estado: "entra"; empresaId: string; rol: string }
  | { estado: "multiple"; empresas: string[] }
  | { estado: "onboarding" }
  | { estado: "denegado" };

export async function resolverAccesoParaLogin(
  email: string | undefined,
  metadata: Record<string, unknown> | undefined
): Promise<ResultadoAcceso> {
  const seAutorregistro = metadata?.self_signup === true;

  if (!email) return seAutorregistro ? { estado: "onboarding" } : { estado: "denegado" };

  const accesos = await resolverAccesosPorCorreo(email);
  if (accesos.length === 1) {
    const { empresaId, rol } = accesos[0];
    // Si el rol guardado ya no está disponible para la empresa (lo
    // borraron), cae a colaborador — nunca dejar entrar sin rol válido.
    const rolFinal = (await empresaPuedeUsarRol(rol, empresaId)) ? rol : "colaborador";
    return { estado: "entra", empresaId, rol: rolFinal };
  }
  if (accesos.length > 1) return { estado: "multiple", empresas: accesos.map((a) => a.empresaId) };
  return seAutorregistro ? { estado: "onboarding" } : { estado: "denegado" };
}

// Crea la fila en `usuarios` para un acceso ya resuelto como "entra".
// Devuelve la fila creada (con la empresa embebida) o null si falló.
export async function aprovisionarUsuario(params: {
  userId: string;
  empresaId: string;
  rol: string;
  nombre: string;
}) {
  const { data, error } = await supabase
    .from("usuarios")
    .insert({
      id: params.userId,
      empresa_id: params.empresaId,
      nombre: params.nombre.trim() || "Nuevo usuario",
      rol: params.rol as never,
    })
    .select("*, empresa:empresas(*)")
    .single();
  if (error) {
    console.error("Error aprovisionando usuario por acceso autorizado:", error);
    return null;
  }
  return data;
}
