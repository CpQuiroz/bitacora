import { supabase } from "./supabase";

// Ley 21.719 — derecho de supresión a nivel individual. En vez de
// borrar (que rompería la integridad referencial de trabajos/OS/etc.
// donde la persona figura como responsable), se reemplazan los datos
// identificatorios por un placeholder y se eliminan los datos
// accesorios (contrato, logs de acceso, códigos, consentimientos).
// Los registros operativos quedan pero sin nombre de persona.

const PLACEHOLDER_NOMBRE = "— eliminado —";

export async function anonimizarUsuario(usuarioId: string): Promise<{ ok: boolean; error?: string }> {
  const { error: eUpd } = await supabase
    .from("usuarios")
    .update({
      nombre: PLACEHOLDER_NOMBRE,
      rut: null,
      telefono: null,
      foto_url: null,
      zona: null,
      funcion: null,
      activo: false,
    })
    .eq("id", usuarioId);
  if (eUpd) return { ok: false, error: eUpd.message };

  // Datos accesorios: se eliminan (todos tienen on delete cascade desde
  // usuarios, así que también desaparecerían con un DELETE — acá se
  // hace explícito sin borrar la fila de `usuarios`).
  // Todas estas tablas referencian al usuario por `usuario_id`.
  for (const tabla of [
    "datos_laborales",
    "accesos_usuario",
    "notificaciones",
    "notificaciones_preferencias",
    "login_2fa_pendiente",
    "mfa_codigo_pendiente",
    "consentimientos",
  ]) {
    await supabase.from(tabla).delete().eq("usuario_id", usuarioId).then(({ error }) => {
      if (error) console.error(`anonimizarUsuario ${tabla}:`, error.message);
    });
  }

  // Cuenta de Auth: scramble del correo + ban permanente, así el correo
  // real deja de estar asociado y la persona no puede volver a entrar.
  // NO se elimina la cuenta de Auth (el FK usuarios.id → auth.users es
  // on delete cascade y borraría la fila anonimizada).
  await supabase.auth.admin
    .updateUserById(usuarioId, {
      email: `anon-${usuarioId}@anonimizado.invalid`,
      ban_duration: "876000h", // ~100 años
      user_metadata: { anonimizado: true },
    })
    .catch((err) => console.error("anonimizarUsuario (auth):", err));

  return { ok: true };
}

export async function anonimizarCliente(clienteId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: cliente } = await supabase
    .from("clientes")
    .select("correo, telefono")
    .eq("id", clienteId)
    .maybeSingle();

  const { error: eUpd } = await supabase
    .from("clientes")
    .update({
      nombre: PLACEHOLDER_NOMBRE,
      rut: null,
      telefono: null,
      correo: null,
      direccion: PLACEHOLDER_NOMBRE,
      comuna: null,
      lat: null,
      lng: null,
      notas: null,
      fecha_nacimiento: null,
      activo: false,
    })
    .eq("id", clienteId);
  if (eUpd) return { ok: false, error: eUpd.message };

  await supabase.from("portal_accesos").delete().eq("cliente_id", clienteId).then(({ error }) => {
    if (error) console.error("anonimizarCliente portal_accesos:", error.message);
  });
  await supabase.from("portal_codigos").delete().eq("cliente_id", clienteId).then(({ error }) => {
    if (error) console.error("anonimizarCliente portal_codigos:", error.message);
  });
  await supabase.from("consentimientos").delete().eq("cliente_id", clienteId).then(({ error }) => {
    if (error) console.error("anonimizarCliente consentimientos:", error.message);
  });

  // Log de avisos: se guarda el destinatario como texto suelto — se
  // borran las filas que llevan el correo o teléfono de este cliente.
  const destinatarios = [cliente?.correo, cliente?.telefono].filter(Boolean) as string[];
  if (destinatarios.length) {
    await supabase
      .from("notificaciones_cliente_log")
      .delete()
      .in("destinatario", destinatarios)
      .then(({ error }) => {
        if (error) console.error("anonimizarCliente notificaciones_cliente_log:", error.message);
      });
  }

  return { ok: true };
}
