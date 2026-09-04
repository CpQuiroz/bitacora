import { apiJson } from "./api";

export type RolDisponible = { slug: string; nombre: string };

/** Roles que la empresa puede asignar — GET /api/usuarios/roles. */
export async function listarRoles(): Promise<RolDisponible[]> {
  const res = await apiJson<RolDisponible[]>("/api/usuarios/roles");
  return res.ok ? res.data : [];
}

export type BorradorInvitacion = { nombre: string; correo: string; rol: string };

type Resultado = { ok: true } | { ok: false; error: string };

/**
 * Invita a un nuevo miembro del equipo (POST /api/usuarios/invitar) — crea
 * la cuenta y le manda el correo de invitación, pero no queda activa hasta
 * que la acepte. A propósito no devuelve el usuario: no se puede asignar
 * como responsable todavía (mismo criterio que ComboboxResponsable en la
 * web).
 */
export async function invitarUsuario(b: BorradorInvitacion): Promise<Resultado> {
  const res = await apiJson<{ ok?: boolean }>("/api/usuarios/invitar", {
    method: "POST",
    body: JSON.stringify({ email: b.correo.trim(), nombre: b.nombre.trim(), rol: b.rol }),
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
