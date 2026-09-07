import { supabase } from "./supabase";

// Ley 21.719 — derecho de acceso / portabilidad a nivel individual.
// Junta en un solo objeto todos los datos personales de UNA persona
// (no de una empresa entera, que es lo que hace el export del
// Super-Admin). Solo lectura.

async function filas(tabla: string, columna: string, valor: string, select = "*") {
  const { data, error } = await supabase.from(tabla).select(select).eq(columna, valor);
  if (error) {
    console.error(`exportarDatosPersonales ${tabla}.${columna}:`, error.message);
    return [];
  }
  return data ?? [];
}

export async function datosPersonalesDeUsuario(usuarioId: string): Promise<Record<string, unknown>> {
  const { data: authUser } = await supabase.auth.admin.getUserById(usuarioId);

  // Eventos de impersonación de Super-Admin sobre esta cuenta (hallazgo
  // #10 de la auditoría) — la persona tiene derecho a saber si, cuándo y
  // con qué motivo declarado su cuenta fue impersonada.
  const { data: auditoriaSA } = await supabase
    .from("super_admin_auditoria")
    .select("accion, detalle, creado_en")
    .in("accion", ["iniciar_impersonacion", "finalizar_impersonacion"])
    .ilike("detalle", `%${usuarioId}%`)
    .order("creado_en", { ascending: false });

  const [usuario] = await filas("usuarios", "id", usuarioId);

  return {
    generado_en: new Date().toISOString(),
    titular: { tipo: "usuario", id: usuarioId },
    nota: "No incluye el contenido de fotos/PDFs de Storage, solo las referencias ya guardadas en cada fila.",
    cuenta: { correo: authUser?.user?.email ?? null, creada_en: authUser?.user?.created_at ?? null },
    perfil: usuario ?? null,
    datos_laborales: await filas("datos_laborales", "usuario_id", usuarioId),
    liquidaciones: await filas("liquidaciones", "usuario_id", usuarioId),
    accesos: await filas("accesos_usuario", "usuario_id", usuarioId),
    notificaciones: await filas("notificaciones", "usuario_id", usuarioId),
    preferencias_notificaciones: await filas("notificaciones_preferencias", "usuario_id", usuarioId),
    consentimientos: await filas("consentimientos", "usuario_id", usuarioId),
    tareas_asignadas: await filas("tareas", "responsable_id", usuarioId),
    trabajos_asignados: await filas("trabajos", "responsable_id", usuarioId),
    viajes_como_chofer: await filas("viajes", "chofer_id", usuarioId),
    cambios_registrados_sobre_mi: await filas(
      "auditoria_usuarios",
      "usuario_afectado_id",
      usuarioId,
      "campo, valor_anterior, valor_nuevo, creado_en"
    ),
    impersonaciones_de_superadmin: auditoriaSA ?? [],
  };
}

export async function datosPersonalesDeCliente(clienteId: string): Promise<Record<string, unknown>> {
  const [cliente] = await filas("clientes", "id", clienteId);
  const correo = (cliente as { correo?: string | null } | undefined)?.correo ?? null;
  const telefono = (cliente as { telefono?: string | null } | undefined)?.telefono ?? null;

  const [trabajos, cotizaciones, facturas, citas] = await Promise.all([
    filas("trabajos", "cliente_id", clienteId),
    // La tabla es `presupuestos` (no existe `cotizaciones`) — el nombre
    // de cara al cliente sí es "cotización".
    filas("presupuestos", "cliente_id", clienteId),
    filas("facturas", "cliente_id", clienteId),
    filas("tareas", "cliente_id", clienteId),
  ]);

  // Log de avisos: `notificaciones_cliente_log` no tiene cliente_id.
  // Guarda `destinatario` como texto (correo/teléfono) y `entidad_id`
  // de la entidad avisada. Juntamos ambos caminos: por destinatario y
  // por cualquier entidad que sea de este cliente.
  const idFila = (f: unknown) => (f as { id?: string }).id;
  const entidadIds = [
    clienteId,
    ...trabajos.map(idFila),
    ...cotizaciones.map(idFila),
    ...facturas.map(idFila),
    ...citas.map(idFila),
  ].filter(Boolean) as string[];
  const destinatarios = [correo, telefono].filter(Boolean) as string[];

  const avisosMap = new Map<string, unknown>();
  const registrarAvisos = (rows: { id?: string }[] | null | undefined) => {
    for (const a of rows ?? []) if (a.id) avisosMap.set(a.id, a);
  };
  if (destinatarios.length) {
    const { data } = await supabase
      .from("notificaciones_cliente_log")
      .select("id, tipo, destinatario, entidad_tipo, entidad_id, exito, creado_en")
      .in("destinatario", destinatarios)
      .order("creado_en", { ascending: false });
    registrarAvisos(data);
  }
  if (entidadIds.length) {
    const { data } = await supabase
      .from("notificaciones_cliente_log")
      .select("id, tipo, destinatario, entidad_tipo, entidad_id, exito, creado_en")
      .in("entidad_id", entidadIds)
      .order("creado_en", { ascending: false });
    registrarAvisos(data);
  }
  const avisos = [...avisosMap.values()].sort((a, b) =>
    String((b as { creado_en?: string }).creado_en ?? "").localeCompare(String((a as { creado_en?: string }).creado_en ?? ""))
  );

  return {
    generado_en: new Date().toISOString(),
    titular: { tipo: "cliente", id: clienteId },
    ficha: cliente ?? null,
    consentimientos: await filas("consentimientos", "cliente_id", clienteId),
    accesos_al_portal: await filas("portal_accesos", "cliente_id", clienteId),
    trabajos,
    cotizaciones,
    facturas,
    citas,
    avisos_recibidos: avisos,
  };
}
