// ============================================================
// Tipos compartidos — reflejan el esquema de Supabase después de
// aplicar, en orden, supabase/migrations/01..05 (ver ese folder).
// La tabla "trabajos" generalizó la "viajes" original (04_generalizacion.sql).
// "viajes" volvió en 25_viajes.sql, con otro propósito: guías de
// despacho del rubro transporte, separado de "trabajos"/OS genérico.
//
// Nota: los "Row" son `type`, no `interface`, a propósito — el
// cliente tipado de supabase-js exige que cada Row/Insert/Update
// sea estructuralmente compatible con Record<string, unknown>, y
// TypeScript solo infiere eso para `type`, no para `interface`
// (mismo patrón que usa `supabase gen types typescript`).
// ============================================================

export type Rol = "admin" | "supervisor" | "contador" | "colaborador";

// Función / especialidad de un colaborador en terreno — más fina que el
// rol (ver migración 65). La usa la app móvil para mostrar solo las
// herramientas que ese colaborador realmente usa. null = sin definir.
export type FuncionColaborador = "tecnico" | "chofer" | "instalador" | "administrativo" | "otro";
export type Rubro = "transporte" | "servicio_tecnico" | "cosmetologia" | "otro";
export type Plan = "trial" | "basico" | "pro";
export type EstadoEmpresa = "activa" | "suspendida" | "dada_de_baja";
// @internal — columna `trabajos.estado`. NO usar para pintar UI ni sumar
// informes: eso va SIEMPRE contra `ordenes_servicio.estado_os` (PASO 1
// del rediseño). El backend mantiene estado_os sincronizado desde cada
// write de trabajos.estado, así que estado_os es la única verdad visible.
// Mapeo 1:1 → en_curso≈en_proceso · completado≈completada · cancelado≈cancelada.
export type EstadoTrabajo = "en_curso" | "completado" | "cancelado";
export type Prioridad = "alta" | "media" | "baja";
export type TipoCheckin = "manual" | "ubicacion";
export type EstadoRuta = "borrador" | "finalizada";
export type DiaSemana =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";
export type EstadoFactura = "pendiente" | "pagada" | "vencida";
export type EstadoAnalisisFoto = "procesando" | "listo" | "error";
export type TipoGasto = "negocio" | "personal";
// Vocabulario ÚNICO de estado de un trabajo/OS visible en toda la app
// (badges, filtros, informes). "cancelada" se sumó en PASO 1 (antes solo
// existía como EstadoTrabajo.cancelado).
export type EstadoOS = "pendiente" | "enviada" | "en_proceso" | "completada" | "firmada" | "cancelada";

// Mapea el estado interno del trabajo al vocabulario visible (EstadoOS).
// Solo hace falta como fallback: cada trabajo tiene una orden y su
// estado_os es la fuente de verdad — esto cubre el caso teórico sin orden.
export function estadoOsDeTrabajo(estado: EstadoTrabajo): EstadoOS {
  return estado === "completado" ? "completada" : estado === "cancelado" ? "cancelada" : "en_proceso";
}
export type EstadoGasto = "pagado" | "pendiente";
export type EstadoPresupuesto = "borrador" | "enviado" | "aprobado" | "rechazado" | "expirado";
export type TipoInforme = "financiero" | "operativo" | "clientes" | "colaboradores" | "personalizado";
export type SeccionInforme = "financiero" | "ventas" | "operaciones" | "servicios" | "clientes" | "gastos";

export type TipoCuenta = "corriente" | "vista" | "ahorro";
export type TipoPlantilla = "cotizacion" | "orden_servicio" | "cobranza" | "terminos_aceptacion";
export type PosicionLogo = "izquierda" | "centro" | "derecha";
export type ProveedorIntegracion = "webpay" | "flow" | "mercadopago" | "whatsapp" | "anthropic" | "google_document_ai";
export type CategoriaIntegracion = "pagos" | "comunicacion" | "ia";
export type TipoMensajePersonalizado =
  | "cotizacion"
  | "orden_servicio"
  | "cobranza"
  | "tecnico_en_camino"
  | "cita_agendada"
  | "cita_cancelada"
  | "cumpleanos";

export type Empresa = {
  id: string;
  nombre: string;
  rubro: Rubro;
  plan: Plan;
  logo_url: string | null;
  siguiente_folio_os: number;
  siguiente_numero_cotizacion: number;
  color_primario: string | null;
  color_primario_foreground: string | null;
  color_secundario: string | null;
  fuente: string | null;
  moneda: string;
  razon_social: string | null;
  giro: string | null;
  rut: string | null;
  correo_empresa: string | null;
  telefono_empresa: string | null;
  whatsapp: string | null;
  region: string | null;
  comuna: string | null;
  direccion_calle: string | null;
  direccion_numero: string | null;
  direccion_depto: string | null;
  pago_activado: boolean;
  pago_banco: string | null;
  pago_tipo_cuenta: TipoCuenta | null;
  pago_numero_cuenta: string | null;
  pago_titular: string | null;
  prueba_termina_en: string | null;
  inventario_activado: boolean;
  inventario_stock_minimo_default: number;
  // Bloque B (config. de inventario): antes hardcodeado a "firmada" —
  // ahora configurable por empresa. Ver backend/src/inventario.ts.
  inventario_descontar_en_estado: EstadoOS;
  inventario_permitir_negativo: boolean;
  inventario_descontar_una_vez: boolean;
  // Puente OS → Cobro (migración 91): en TRUE, finalizar/firmar una OS
  // con monto > 0 crea automáticamente una factura "pendiente" por ese
  // trabajo. FALSE = la empresa factura por fuera (ej. contra guía
  // semanal) y sigue usando "desde trabajos" a mano.
  cobro_automatico_al_firmar: boolean;
  // Viajes registrados desde la app: en TRUE entran directo como
  // "confirmado" (sin pasar por aprobación del admin). Ver migración 78.
  viajes_aprobacion_automatica: boolean;
  // Portal del cliente (migración 93): qué secciones ve el cliente final
  // al entrar a /portal. Default TRUE. El backend del portal filtra por
  // estas columnas; el dashboard las edita en Clientes → Portal del cliente.
  portal_muestra_ordenes: boolean;
  portal_muestra_citas: boolean;
  portal_muestra_cotizaciones: boolean;
  portal_muestra_cobros: boolean;
  // Contador aproximado, incrementado por la app en cada subida (ver
  // migración 56 y backend/src/limites.ts) — no un total exacto
  // recalculado, para no tener que escanear los buckets S3 en cada
  // subida de archivo (eso sí lo hace medirUsoStorage, para el Panel
  // de Super-Admin, con costo de latencia asumido para ese caso).
  storage_bytes_usado: number;
  estado: EstadoEmpresa;
  // Ley 21.719 — cuándo se dio de baja (para el ejercicio de retención).
  dada_de_baja_en: string | null;
  creado_en: string;
};

// Identidad de plataforma — completamente separada de Usuario/Rol. Fila
// completa de la tabla (incluye secretos) — los endpoints de superadmin
// nunca devuelven password_hash/totp_secreto al frontend, seleccionan
// explícitamente solo los campos públicos.
export type SuperAdmin = {
  id: string;
  correo: string;
  password_hash: string;
  totp_secreto: string;
  nombre: string;
  activo: boolean;
  intentos_fallidos: number;
  bloqueado_hasta: string | null;
  ultimo_login_en: string | null;
  creado_en: string;
};

export type SuperAdminAuditoria = {
  id: string;
  super_admin_id: string;
  accion: string;
  empresa_id: string | null;
  detalle: string | null;
  ip: string | null;
  creado_en: string;
};

export type IaUso = {
  id: string;
  empresa_id: string;
  feature: string;
  modelo: string;
  tokens_entrada: number;
  tokens_salida: number;
  creado_en: string;
};

// Snapshot cacheado del dashboard global del Super-Admin (una sola fila,
// id = 1). Ver migración 60 y GET /api/superadmin/metricas.
export type SuperadminMetricasCache = {
  id: number;
  datos: MetricasSuperAdmin;
  generado_en: string;
};

// Forma del jsonb que devuelve superadmin_metricas_calcular() + los
// campos que agrega el endpoint (generado_en, cacheado).
export type MetricasSuperAdmin = {
  empresas_por_estado_suscripcion: Record<string, number>;
  empresas_por_estado_operativo: Record<string, number>;
  empresas_por_rubro: Record<string, number>;
  total_empresas: number;
  mrr: { mes_actual: number; mes_anterior: number; variacion_pct: number | null };
  churn: { canceladas_30d: number; base: number; tasa_pct: number | null };
  uso_mes: { os_creadas: number; tokens_ia: number; storage_bytes_total: number };
  top_ia: { id: string; nombre: string; tokens: number }[];
  top_storage: { id: string; nombre: string; bytes: number }[];
  generado_en: string;
  cacheado: boolean;
  obsoleto?: boolean;
};

export type ErrorBackend = {
  id: string;
  empresa_id: string | null;
  ruta: string;
  metodo: string;
  mensaje: string;
  creado_en: string;
};

// Instrumentación de latencia — solo requests que superan el umbral
// (ver backend/src/instrumentacion.ts, migración 83).
export type RequestLento = {
  id: string;
  empresa_id: string | null;
  ruta: string;
  metodo: string;
  ms: number;
  status_code: number | null;
  filas_devueltas: number | null;
  creado_en: string;
};

// Idempotencia de operaciones que crean plata (migración 77). Ver
// backend/src/idempotencia.ts.
export type Idempotencia = {
  clave: string;
  empresa_id: string | null;
  metodo: string;
  ruta: string;
  status_code: number | null;
  respuesta: unknown;
  creado_en: string;
};

// Ley 21.719 — registro de aceptación de Política de Privacidad / Términos.
export type Consentimiento = {
  id: string;
  usuario_id: string | null;
  cliente_id: string | null;
  empresa_id: string | null;
  documento: "privacidad" | "terminos";
  version: string;
  aceptado_en: string;
  ip: string | null;
  user_agent: string | null;
  creado_en: string;
};

export type EmpresaModulo = {
  empresa_id: string;
  modulo: string;
  activado: boolean;
  actualizado_en: string;
};

// Override por empresa de qué módulos ve un rol dentro de esa empresa
// (lo edita el Admin en Configuración > Perfiles). Sin fila = el rol usa
// su plantilla global (tabla `roles`). Ver migración 75.
export type EmpresaRolModulo = {
  empresa_id: string;
  rol_slug: string;
  modulo: string;
  activado: boolean;
  actualizado_en: string;
};

// Feature flag por empresa — funcionalidad en beta activada para 1-2
// empresas puntuales antes de ofrecerla a todos. Eje separado de
// EmpresaModulo (contratado vs. en prueba). Ver migración 61.
export type EmpresaFeatureFlag = {
  id: string;
  empresa_id: string;
  flag: string;
  activado: boolean;
  activado_en: string;
  activado_por: string | null;
};

export type Usuario = {
  id: string; // = auth.users.id
  empresa_id: string;
  nombre: string;
  // Desde la migración 71 el rol es el `slug` de una fila de `roles`
  // (editable desde el Panel de Super-Admin). Los 4 de sistema —
  // admin/supervisor/contador/colaborador — mantienen su semántica.
  // El tipo se mantiene como `Rol` para no romper el frontend, que
  // resuelve los permisos vía `/api/me` (`modulos_visibles`). El backend
  // castea a string donde necesita aceptar slugs custom.
  rol: Rol;
  telefono: string | null;
  idioma: string;
  pais: string;
  huso_horario: string;
  foto_url: string | null;
  activo: boolean;
  fecha_vencimiento_licencia: string | null;
  mfa_activado: boolean;
  mfa_metodo: "totp" | "email" | null;
  zona: string | null;
  funcion: FuncionColaborador | null;
  rut: string | null; // migración 70 — para el archivo Previred
  creado_en: string;
};

// Secreto TOTP cifrado de 2FA de usuario — tabla aparte de "usuarios"
// a propósito, nunca la tocan los select("*") que sí llegan al
// frontend (ej. GET /api/usuarios).
export type MfaTotpSecreto = {
  usuario_id: string;
  secreto_cifrado: string;
  creado_en: string;
};

// Código de 6 dígitos vigente de 2FA por correo — se reutiliza tanto
// al activar el método (enrollment) como en el challenge de login.
export type MfaCodigoPendiente = {
  usuario_id: string;
  codigo_hash: string;
  intentos: number;
  expira_en: string;
  creado_en: string;
};

// Ticket de login pendiente de segundo factor — guarda la sesión de
// Supabase ya válida (contraseña correcta) cifrada, hasta confirmar
// el código.
export type Login2faPendiente = {
  id: string;
  usuario_id: string;
  metodo: "totp" | "email";
  intentos: number;
  access_token_cifrado: string;
  refresh_token_cifrado: string;
  expira_en: string;
  creado_en: string;
};

export type AplicaDocumento = "colaborador" | "vehiculo" | "ambos";

export type TipoDocumento = {
  id: string;
  empresa_id: string;
  nombre: string;
  aplica_a: AplicaDocumento;
  activo: boolean;
  creado_en: string;
};

export type EntidadDocumento = "colaborador" | "vehiculo";
export type EstadoDocumento = "vigente" | "por_vencer" | "vencido";

export type Documento = {
  id: string;
  empresa_id: string;
  entidad_tipo: EntidadDocumento;
  entidad_id: string;
  tipo_documento_id: string;
  numero: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  archivo_key: string | null;
  creado_en: string;
  actualizado_en: string;
};

// equipo_id apunta a equipos(id) (categoria = "Vehículo") desde la
// fusión — el nombre de la tabla se mantuvo (vehiculo_asignaciones) al
// no ser parte de lo pedido, solo se renombró la columna.
export type VehiculoAsignacion = {
  id: string;
  empresa_id: string;
  equipo_id: string;
  colaborador_id: string;
  desde: string;
  hasta: string | null;
  creado_en: string;
};

// Sin fecha_vencimiento no hay nada que alertar — "vigente" por defecto
// (documentos como una foto de patente no siempre vencen).
export function estadoDocumento(fechaVencimiento: string | null): EstadoDocumento | null {
  if (!fechaVencimiento) return null;
  const hoy = new Date().toISOString().slice(0, 10);
  const enTreintaDias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (fechaVencimiento < hoy) return "vencido";
  if (fechaVencimiento <= enTreintaDias) return "por_vencer";
  return "vigente";
}

export type AccesoUsuario = {
  id: string;
  usuario_id: string;
  empresa_id: string;
  ip: string | null;
  user_agent: string | null;
  creado_en: string;
};

export type AuditoriaUsuario = {
  id: string;
  empresa_id: string;
  usuario_afectado_id: string;
  realizado_por_id: string | null;
  campo: "rol" | "activo" | "clave";
  valor_anterior: string | null;
  valor_nuevo: string | null;
  creado_en: string;
};

export type TipoNotificacion =
  | "os_asignada"
  | "os_completada"
  | "cobro_por_vencer"
  | "cobro_vencido"
  | "ruta_finalizada"
  | "tarea_retrasada"
  | "licencia_por_vencer"
  | "email_fallido"
  | "cotizacion_aprobada"
  | "tarea_asignada"
  | "documento_por_vencer"
  | "cita_confirmada"
  | "cita_cancelada"
  | "solicitud_correccion_datos";

export type EntidadNotificacion = "trabajo" | "factura" | "ruta" | "usuario" | "cotizacion" | "tarea" | "documento";

export type Notificacion = {
  id: string;
  empresa_id: string;
  usuario_id: string;
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string | null;
  entidad_tipo: EntidadNotificacion | null;
  entidad_id: string | null;
  leido: boolean;
  creado_en: string;
};

export type NotificacionPreferencia = {
  id: string;
  usuario_id: string;
  tipo: TipoNotificacion;
  app_activado: boolean;
  email_activado: boolean;
};

export type CampoTipoTrabajo = {
  clave: string;
  etiqueta: string;
  tipo: "texto" | "numero" | "fecha" | "booleano";
};

// Cruza los campos definidos por el tipo de trabajo contra los valores
// guardados en `trabajo.datos` y devuelve pares etiqueta/valor listos
// para mostrar. Único punto de verdad del formateo (Sí/No para booleano,
// "—" para ausente) — lo usan el informe con IA y el PDF de la OS.
export function mapearCamposPersonalizados(
  campos: CampoTipoTrabajo[] | null | undefined,
  datos: Record<string, unknown> | null | undefined
): { etiqueta: string; valor: string }[] {
  const d = datos ?? {};
  return (campos ?? []).map((c) => {
    const bruto = d[c.clave];
    let valor: string;
    if (bruto === undefined || bruto === null || bruto === "") {
      valor = "—";
    } else if (c.tipo === "booleano") {
      valor = bruto === true || bruto === "true" || bruto === 1 ? "Sí" : "No";
    } else {
      valor = String(bruto);
    }
    return { etiqueta: c.etiqueta, valor };
  });
}

export type TipoTrabajo = {
  id: string;
  empresa_id: string;
  nombre: string;
  campos: CampoTipoTrabajo[];
  activo: boolean;
  creado_en: string;
};

export type Anexo = {
  nombre: string;
  key: string;
  tamano_bytes: number;
  // Trazabilidad de "quién agregó qué y cuándo" — usado por los anexos
  // que se suben DESPUÉS de firmar la OS (POST /api/trabajos/:id/anexos).
  // Opcionales: los anexos de otros flujos (rutas planificadas) no los
  // traen y no se rompen.
  subido_por?: string | null;
  creado_en?: string;
};

export type Trabajo = {
  id: string;
  empresa_id: string;
  tipo_trabajo_id: string | null;
  tipo_os_id: string | null;
  codigo: string | null;
  fecha: string;
  semana: number | null;
  responsable_id: string | null;
  cliente: string;
  cliente_id: string | null;
  ubicacion: string | null;
  monto: number;
  estado: EstadoTrabajo;
  datos: Record<string, unknown>;
  descripcion: string | null;
  ruta_id: string | null;
  orden_en_ruta: number | null;
  hora_estimada_llegada: string | null;
  duracion_estimada_min: number | null;
  prioridad: Prioridad;
  etiquetas: string[];
  tipo_checkin: TipoCheckin;
  anexos: Anexo[];
  encuesta_email: string | null;
  encuesta_enviada_en: string | null;
  calificacion_satisfaccion: number | null;
  encuesta_respondida_en: string | null;
  hora_programada: string | null;
  notas_internas: string | null;
  // Equipo específico del cliente al que aplica esta OS (opcional) —
  // alimenta el histórico de mantenciones de un Equipo.
  equipo_id: string | null;
  creado_en: string;
};

// Evento de Agenda liviano — no requiere una Orden de Servicio (a
// diferencia de Trabajo/trabajos, que sí la crea eagerly). Para
// recordatorios y visitas técnicas sueltas.
// "confirmada" es propia de Agenda Pro — el cliente confirma la cita
// desde el Portal antes de que llegue la fecha (ver 5c). Sin Agenda
// Pro las tareas siguen yendo directo de pendiente a completada.
// "no_asistio" y "cancelada_anticipada" solo aplican a citas con
// paquete_id — separan si la cancelación/inasistencia descuenta la
// sesión del paquete o no, según la ventana de aviso configurada
// (ver backend/src/agendaPro.ts). Citas sin paquete siguen usando el
// "cancelada" genérico.
export type EstadoTarea = "pendiente" | "confirmada" | "completada" | "cancelada" | "no_asistio" | "cancelada_anticipada";

export type AdicionalCita = { concepto: string; monto: number };

export type Tarea = {
  id: string;
  empresa_id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora: string | null;
  responsable_id: string | null;
  cliente_id: string | null;
  prioridad: Prioridad;
  estado: EstadoTarea;
  paquete_id: string | null;
  sesiones_consumidas: number;
  // Duración estimada de la cita, en minutos — opcional, solo para
  // mostrar "hasta las HH:MM" y prevenir choques de horario. No hay
  // columna hora_fin: se calcula siempre a partir de hora+duracion_min
  // (mismo criterio que el saldo de paquetes_sesiones, nunca guardar lo
  // que se puede derivar).
  duracion_min: number | null;
  // Servicio elegido (catálogo Agenda Pro) — determina el precio de
  // lista y precarga la duración sugerida al crear la cita.
  servicio_id: string | null;
  // Nota visible para el CLIENTE (va en el correo/portal). Distinta de
  // `descripcion`, que sigue siendo la nota INTERNA — no se renombró
  // para no romper nada que ya la lea/escriba.
  nota_cliente: string | null;
  // Si esta cita puntual avisa por WhatsApp (además del correo) — el
  // interruptor real de "manda o no manda" sigue siendo
  // notificaciones_config.whatsapp_activado a nivel empresa, esto es
  // el opt-out por cita.
  avisar_whatsapp: boolean;
  // Precio final de la cita — precarga desde servicios.precio pero es
  // editable (descuentos puntuales). Null = usar el de lista del servicio.
  precio: number | null;
  // "Valor agregado" itemizado de esta reserva (migración 94): productos
  // o extras que se suman al precio del servicio. total = precio + Σ monto.
  adicionales: AdicionalCita[];
  // OS (trabajo) creada desde el flujo "Nueva tarea → Crear Orden de
  // Servicio" en Agenda. Nullable: casi ninguna tarea tiene OS asociada.
  trabajo_id: string | null;
  origen: "manual" | "reserva_publica";
  creado_en: string;
  actualizado_en: string;
};

// Agenda Pro: catálogo de servicios (nombre, precio de lista, duración
// sugerida) — se administra en la web y se usa para precargar precio y
// duración al crear una cita, y para atar un TipoPack a un servicio.
export type Servicio = {
  id: string;
  empresa_id: string;
  nombre: string;
  precio: number;
  duracion_sugerida_min: number;
  activo: boolean;
  creado_en: string;
};

// Agenda Pro: INSTANCIA de pack comprada por un cliente puntual. NO es
// el catálogo (TipoPack) — es una copia con su propio saldo. El saldo
// restante no se guarda acá: se calcula siempre a partir de las tareas
// con este paquete_id (ver backend/src/agendaPro.ts:calcularConsumoPorPaquete).
// El descuento de sesiones apunta SIEMPRE a esta instancia, jamás al
// catálogo (el catálogo no tiene saldo).
export type PaqueteSesiones = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  // De qué TipoPack del catálogo salió esta instancia (trazabilidad /
  // reportes: "cuántos Pack Detox se vendieron este mes"). null = pack
  // "personalizado", tipeado a mano sin catálogo.
  tipo_pack_id: string | null;
  // Snapshot inmutable tomado del catálogo al momento de la venta — si
  // el negocio cambia el catálogo después, esta instancia NO se ve
  // afectada (mismo criterio que liquidaciones.detalle).
  nombre: string;
  cantidad_total: number;
  precio: number | null; // precio de lista del catálogo al vender
  servicio_id: string | null;
  vence_el: string | null; // fecha_compra + tipo_pack.vigencia_dias, o null si no vence
  // Lo realmente cobrado — puede diferir del snapshot `precio` por un
  // descuento puntual. null = se cobró el precio de lista.
  precio_pagado: number | null;
  fecha_compra: string;
  notas: string | null;
  creado_en: string;
};

export type PaqueteSesionesConSaldo = PaqueteSesiones & { saldo: number };

// Agenda Pro: CATÁLOGO de packs — la plantilla reutilizable que define
// el negocio una sola vez (ej. "Plan Reductor Básico 4 sesiones" a
// $45.000). NO tiene saldo: no se descuenta nunca de acá. Vender un pack
// crea una fila nueva en PaqueteSesiones (la instancia del cliente) con
// un snapshot de estos valores. `activo` permite dejar de ofrecerlo sin
// borrar el historial de quienes ya lo compraron.
export type TipoPack = {
  id: string;
  empresa_id: string;
  nombre: string;
  cantidad_sesiones: number;
  precio: number | null; // precio de lista del pack
  // Servicio al que está atado — permite ofrecer el pack automáticamente
  // al elegir ese servicio en Nueva reserva. Null = no atado a ninguno.
  servicio_id: string | null;
  // Días de vigencia desde la fecha de compra — se copia a
  // PaqueteSesiones.vence_el al vender, no se recalcula después.
  // null = el pack no vence.
  vigencia_dias: number | null;
  activo: boolean;
  creado_en: string;
};

// Agenda Pro — reserva online pública: horario único por empresa
// (ver backend/src/routes/reservaPublica.ts).
export type AgendaProConfig = {
  empresa_id: string;
  duracion_slot_min: number;
  anticipacion_min_horas: number;
  dias_max_adelante: number;
  // Horas de anticipación mínimas para cancelar una cita con paquete
  // sin que se descuente la sesión — default 24.
  ventana_cancelacion_horas: number;
  actualizado_en: string;
};

export type AgendaProHorario = {
  id: string;
  empresa_id: string;
  dia_semana: number; // 0=domingo .. 6=sábado
  hora_inicio: string; // "HH:MM:SS"
  hora_fin: string;
};

// Suscripción y cobro automático a empresas clientes (B2B, vía Flow).
// Estado de facturación, separado de EstadoEmpresa (que sigue siendo el
// gate de acceso general) — ver backend/src/flow.ts para la tabla completa
// de qué dispara cada transición.
export type EstadoSuscripcion = "trial" | "activa" | "pago_pendiente" | "suspendida_por_pago" | "cancelada";

export type Suscripcion = {
  empresa_id: string;
  estado: EstadoSuscripcion;
  flow_customer_id: string | null;
  flow_subscription_id: string | null;
  tarjeta_ultimos4: string | null;
  tarjeta_marca: string | null;
  proxima_fecha_cobro: string | null;
  cancelada_en: string | null;
  trial_aviso_enviado: boolean;
  plan_pendiente: "basico" | "pro" | null;
  creado_en: string;
  actualizado_en: string;
};

export type EstadoCobroSuscripcion = "exitoso" | "fallido" | "pendiente";

export type SuscripcionCobro = {
  id: string;
  empresa_id: string;
  flow_payment_id: string | null;
  monto: number;
  estado: EstadoCobroSuscripcion;
  intento_numero: number;
  error: string | null;
  creado_en: string;
};

export type OrigenCambioPlan = "empresa" | "super_admin";

export type EmpresaPlanHistorial = {
  id: string;
  empresa_id: string;
  plan_anterior: Plan;
  plan_nuevo: Plan;
  origen: OrigenCambioPlan;
  usuario_id: string | null;
  super_admin_id: string | null;
  cobro_conectado: boolean;
  creado_en: string;
};

export type RutaPlanificada = {
  id: string;
  empresa_id: string;
  responsable_id: string;
  nombre: string | null;
  punto_base_direccion: string;
  punto_base_lat: number | null;
  punto_base_lng: number | null;
  fecha_inicio: string;
  dias_semana: DiaSemana[];
  hora_inicio: string;
  hora_fin: string;
  almuerzo_inicio: string | null;
  almuerzo_fin: string | null;
  estado: EstadoRuta;
  distancia_total_km: number | null;
  duracion_total_min: number | null;
  creado_en: string;
};

export type Cliente = {
  id: string;
  empresa_id: string;
  nombre: string;
  rut: string | null;
  direccion: string;
  comuna: string | null;
  lat: number | null;
  lng: number | null;
  telefono: string | null;
  correo: string | null;
  notas: string | null;
  activo: boolean;
  // Opcional — usado para la felicitación automática de cumpleaños
  // (ver cumpleanosClientes.ts). Solo se usa mes/día, el año queda
  // ignorado a propósito.
  fecha_nacimiento: string | null;
  // Ley 21.719 — el cliente ejerció su derecho de oposición ("no recibir
  // más avisos", link en el pie de los correos).
  notificaciones_opt_out: boolean;
  creado_en: string;
};

export type EntidadPortal = "trabajo" | "cotizacion" | "factura" | "tarea";

export type PortalAcceso = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  entidad_tipo: EntidadPortal | null;
  entidad_id: string | null;
  expira_en: string;
  creado_en: string;
};

export type PortalCodigo = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  codigo_hash: string;
  expira_en: string;
  usado_en: string | null;
  creado_en: string;
};

export type MedioPago = "webpay" | "flow" | "mercadopago" | "transferencia" | "efectivo" | "otro";

export type Factura = {
  id: string;
  empresa_id: string;
  cliente: string;
  cliente_id: string | null;
  semana_facturada: string | null;
  monto: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  fecha_pago: string | null;
  medio_pago: MedioPago | null;
  link_pago: string | null;
  estado: EstadoFactura;
  trabajo_ids: string[] | null;
  viaje_ids: string[] | null;
  // Bloque J: registro de pago manual (independiente de si hay
  // pasarela real conectada) — ver "Registrar Pago" en el Panel de Acciones.
  valor_recibido: number | null;
  observaciones_pago: string | null;
  creado_en: string;
};

export type ItemChecklist = {
  item: string;
  hecho: boolean;
  hora?: string;
};

export type OrdenServicio = {
  id: string;
  empresa_id: string;
  trabajo_id: string | null;
  checklist: ItemChecklist[];
  fotos: string[] | null;
  firma_url: string | null;
  folio: number | null;
  estado_os: EstadoOS;
  firmante_nombre: string | null;
  firmante_documento: string | null;
  // Firma del técnico (migración 98) — bloque aparte del de la firma del
  // cliente. null en OS previas a la migración.
  firma_tecnico_url: string | null;
  tecnico_firmante_nombre: string | null;
  tecnico_firmante_documento: string | null;
  observaciones_cierre: string | null;
  informe_ia: string | null;
  finalizada_en: string | null;
  // Check-in / check-out geolocalizado desde la app móvil (migración
  // 64). El item en `checklist` se sigue escribiendo igual; esto es la
  // copia consultable (coordenadas + exactitud del GPS en metros).
  check_in_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_precision: number | null;
  check_out_at: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_precision: number | null;
  // true una vez que /finalizar (estado_os "firmada") generó los
  // movimientos de salida de inventario de sus ítems tipo "producto" —
  // evita descontar dos veces o revertir sin haber descontado antes.
  stock_descontado: boolean;
  // Cacheado solo una vez firmada — ver migración 57 y obtenerPdfOS en
  // backend/src/routes/trabajos.ts.
  pdf_url: string | null;
  // Factura generada automáticamente al finalizar/firmar esta OS (puente
  // OS → Cobro, migración 91). Null = todavía no se generó (o la empresa
  // tiene el cobro automático apagado). El batch "desde trabajos" avisa
  // si un trabajo ya tiene cobro para no facturar dos veces.
  cobro_id: string | null;
  creado_en: string;
};

export type OsItem = {
  id: string;
  empresa_id: string;
  trabajo_id: string;
  catalogo_item_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  creado_en: string;
};

export type Inventario = {
  id: string;
  empresa_id: string;
  nombre: string;
  stock: number;
  stock_minimo: number;
  costo: number | null;
  precio: number | null;
  actualizado_en: string;
};

export type GastoFijo = {
  id: string;
  empresa_id: string;
  categoria: string;
  tipo: TipoGasto;
  monto: number;
  dia_vencimiento: number | null;
  activo: boolean;
  creado_en: string;
};

export type Gasto = {
  id: string;
  empresa_id: string;
  categoria: string;
  categoria_gasto_id: string | null;
  centro_costo_id: string | null;
  proveedor_id: string | null;
  trabajo_id: string | null;
  comprobante_url: string | null;
  comprobante_nombre: string | null;
  descripcion: string | null;
  monto: number;
  fecha: string;
  estado: EstadoGasto;
  fecha_pago: string | null;
  editado_por: string | null;
  editado_en: string | null;
  creado_en: string;
};

export type Presupuesto = {
  id: string;
  empresa_id: string;
  cliente_id: string | null;
  descripcion: string | null;
  monto: number;
  fecha: string;
  estado: EstadoPresupuesto;
  trabajo_id: string | null;
  numero: number | null;
  subtotal: number | null;
  iva: number | null;
  fecha_vencimiento: string | null;
  pdf_url: string | null;
  creado_en: string;
};

export type PresupuestoItem = {
  id: string;
  empresa_id: string;
  presupuesto_id: string;
  catalogo_item_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  creado_en: string;
};

// cliente_id null = activo propio de la empresa (ej. flota propia de
// vehículos); no-null = activo del cliente (comportamiento de
// siempre). Vehículos ya no es tabla aparte — es categoria = "Vehículo"
// acá, con sus campos propios (patente, anio, tipo_vehiculo,
// capacidad_carga) opcionales, solo usados en esa categoría.
export type Equipo = {
  id: string;
  empresa_id: string;
  cliente_id: string | null;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  categoria: string | null;
  notas: string | null;
  activo: boolean;
  creado_en: string;
  patente: string | null;
  anio: number | null;
  tipo_vehiculo: string | null;
  capacidad_carga: string | null;
  // Vencimiento de garantía del equipo (cualquier categoría, no solo
  // Vehículo) — alimenta la métrica "garantías por vencer" del
  // dashboard de Equipos.
  garantia_vencimiento: string | null;
};

// Plan de Mantención Preventiva de un equipo — solo CRUD por ahora.
// TODO: decisión pendiente — generar automáticamente una OS cuando
// proxima_fecha se cumple. No implementado, requiere definir con qué
// datos se arma esa OS (responsable, tipo de servicio, etc.).
export type PlanMantencion = {
  id: string;
  empresa_id: string;
  equipo_id: string;
  frecuencia_dias: number;
  proxima_fecha: string;
  notas: string | null;
  activo: boolean;
  creado_en: string;
};

// Registros de mantención de flota (migración 96). Tabla propia, NO una
// OS: no requiere cliente ni dispara facturación. Inmutable una vez
// creado. `equipo_id` apunta a un equipo categoría "Vehículo".
export type TipoRegistroMantencion = "diario" | "programa";
export type OrigenRegistroMantencion = "interno" | "externo";
export type RespuestaChecklistMantencion = "si" | "no" | "na";

export type ItemChecklistMantencion = {
  seccion: string;
  item: string;
  respuesta: RespuestaChecklistMantencion;
};

export type RegistroMantencionEquipo = {
  id: string;
  empresa_id: string;
  equipo_id: string;
  // Correlativo por empresa (migración 97). Puede venir null en registros
  // creados antes de esa migración.
  folio: number | null;
  // Fecha del chequeo (migración 97) — puede diferir de creado_en.
  fecha: string;
  tipo: TipoRegistroMantencion;
  // Derivado del tipo en la UI (diario ⇒ interno, programa ⇒ externo);
  // se guarda explícito. externo ⇒ proveedor_id; interno ⇒ sin proveedor.
  origen: OrigenRegistroMantencion;
  proveedor_id: string | null;
  realizado_por: string | null;
  checklist: ItemChecklistMantencion[];
  kilometraje: number | null;
  horas_motor: number | null;
  observaciones: string | null;
  firma_url: string | null;
  pdf_url: string | null;
  creado_por: string | null;
  creado_en: string;
};

// Molde: ViajeFoto. Varias fotos por registro, misma cola offline.
// item: null = foto general; "<texto>" = respalda ese ítem del checklist.
export type RegistroMantencionFoto = {
  id: string;
  empresa_id: string;
  registro_id: string;
  foto_url: string;
  item: string | null;
  subida_por: string | null;
  creado_en: string;
};

// Cuando un ítem del checklist queda en "no", exigir al menos una foto
// que lo respalde. Flag para poder apagarlo por completo.
export const MANTENCION_EXIGE_FOTO_EN_NO = true;

export type TipoCatalogoItem = "producto" | "servicio" | "kit";

export type CatalogoItem = {
  id: string;
  empresa_id: string;
  tipo: TipoCatalogoItem;
  nombre: string;
  sku: string | null;
  categoria: string | null;
  unidad: string;
  precio_base: number;
  stock_actual: number | null;
  stock_minimo: number | null;
  activo: boolean;
  creado_en: string;
  // Derivado (join con catalogo_item_tipos_equipo), no una columna
  // propia — igual que "items" en los kits. Solo viene en GET /api/catalogo.
  tipos_equipo?: string[];
};

// Etiquetado muchos-a-muchos: a qué tipo(s) de equipo aplica un ítem
// de catálogo (ej. "Cambio de aceite" aplica a Camión y Camioneta).
// tipo_equipo es texto libre, igual criterio que equipos.categoria —
// no hay una tabla maestra de "tipos de equipo".
export type CatalogoItemTipoEquipo = {
  id: string;
  empresa_id: string;
  catalogo_item_id: string;
  tipo_equipo: string;
};

export type CatalogoKitItem = {
  id: string;
  empresa_id: string;
  kit_id: string;
  item_id: string;
  cantidad: number;
};

export type TipoMovimientoInventario = "entrada" | "salida" | "ajuste";
// Bloque B/C: distingue un movimiento manual (Configuración > Inventario)
// de uno automático (cambio de estado de una OS) — antes solo se
// diferenciaban por el texto libre de "motivo".
export type OrigenMovimientoInventario = "manual" | "automatico";

export type InventarioMovimiento = {
  id: string;
  empresa_id: string;
  catalogo_item_id: string;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  stock_resultante: number;
  motivo: string | null;
  origen: OrigenMovimientoInventario;
  creado_en: string;
};

// Bloque E: sugerencias iniciales de categorías/tipos según el rubro
// de la empresa — mecanismo genérico basado en datos.
export type TipoSugerenciaRubro = "categoria_gasto" | "categoria_catalogo" | "tipo_os" | "tipo_documento";
export type SugerenciaRubro = {
  id: string;
  rubro: Rubro;
  tipo_sugerencia: TipoSugerenciaRubro;
  valor: string;
  color: string | null;
  aplica_a: string | null;
  orden: number;
};

export type Proveedor = {
  id: string;
  empresa_id: string;
  nombre: string;
  razon_social: string | null;
  rut: string | null;
  telefono: string | null;
  correo: string | null;
  categoria_gasto_id: string | null;
  activo: boolean;
  creado_en: string;
};

export type InformeGenerado = {
  id: string;
  empresa_id: string;
  usuario_id: string | null;
  tipo: TipoInforme;
  desde: string;
  hasta: string;
  pregunta: string | null;
  resultado: string | null;
  datos_agregados: Record<string, unknown>;
  secciones: SeccionInforme[] | null;
  personalizado_id: string | null;
  nombre: string | null;
  creado_en: string;
};

export type InformePersonalizado = {
  id: string;
  empresa_id: string;
  nombre: string;
  secciones: SeccionInforme[];
  pregunta: string | null;
  creado_por: string | null;
  creado_en: string;
  actualizado_en: string;
};

export type EstadoViaje = "borrador" | "confirmado" | "facturado";
export type OrigenCapturaViaje = "manual" | "whatsapp" | "app";

export type Viaje = {
  id: string;
  empresa_id: string;
  fecha: string;
  numero_guia: string;
  cliente: string;
  cliente_id: string | null;
  chofer_id: string | null;
  equipo_id: string | null;
  origen: string;
  destino: string;
  km_inicial: number | null;
  km_final: number | null;
  subtotal: number;
  aplica_iva: boolean;
  iva: number;
  total: number;
  estado: EstadoViaje;
  origen_captura: OrigenCapturaViaje;
  factura_id: string | null;
  foto_guia_url: string | null;
  comentarios: string | null;
  creado_en: string;
};

// Ledger de idempotencia del webhook de WhatsApp — nunca se expone
// por API, solo lo usa el backend para no duplicar un viaje si Meta
// reintenta la entrega del mismo mensaje.
export type MensajeWhatsappProcesado = {
  id: string;
  procesado_en: string;
};

// Estado de una conversación en curso del bot de WhatsApp (flujo
// "nuevo viaje" del chofer). Una fila por número de teléfono => cada
// chofer tiene a lo más una conversación activa. Solo la toca el
// backend, nunca se expone por API.
export type PasoConversacionWhatsapp =
  | "cliente"
  | "cliente_elegir"
  | "guia"
  | "foto"
  | "origen"
  | "destino"
  | "equipo"
  | "equipo_elegir"
  | "km"
  | "monto"
  | "iva"
  | "confirmar";

export type ConversacionWhatsapp = {
  telefono: string;
  empresa_id: string;
  usuario_id: string;
  flujo: "viaje";
  paso: PasoConversacionWhatsapp;
  datos: Record<string, unknown>;
  creado_en: string;
  actualizado_en: string;
};

// ── Roles editables (migración 71) ──────────────────────────────────
export type RolFila = {
  slug: string;
  nombre: string;
  modulos: string[];
  acciones: string[];
  requiere_2fa: boolean;
  es_sistema: boolean;
  orden: number;
  creado_en: string;
  actualizado_en: string;
};

export type RolEmpresa = {
  rol_slug: string;
  empresa_id: string;
};

// ── Correos/dominios autorizados por empresa (migración 72) ─────────
export type EmpresaAccesoAutorizado = {
  id: string;
  empresa_id: string;
  tipo: "correo" | "dominio";
  valor: string;
  rol: string;
  creado_por: string | null;
  creado_en: string;
};

// ── Módulo Remuneraciones (opt-in) — ver liquidacionChile.ts para el
// cálculo y migraciones 67/68/69 para el esquema. ─────────────────────
export type ParametroPrevisional = {
  periodo: string; // 'YYYY-MM'
  uf: number;
  utm: number;
  ingreso_minimo: number;
  tope_imponible_uf: number;
  tope_afc_uf: number;
  tope_gratificacion_mensual: number;
  tasa_sis: number;
  tasa_mutual_base: number;
  tramos_impuesto: { desde: number; hasta: number | null; factor: number; rebaja: number }[];
  fuente: "mindicador" | "manual";
  actualizado_en: string;
  // migración 76 — rastro del último cambio manual (la tabla es global)
  actualizado_por_usuario: string | null;
  actualizado_por_empresa: string | null;
};

export type AfpParametro = {
  periodo: string;
  afp: string;
  nombre: string;
  codigo_previred: string;
  tasa_comision: number;
};

export type AsignacionFamiliarTramo = {
  periodo: string;
  tramo: number;
  renta_desde: number;
  renta_hasta: number | null;
  monto_por_carga: number;
};

export type TipoContratoLaboral = "indefinido" | "plazo_fijo" | "por_obra";
export type SistemaSaludLaboral = "fonasa" | "isapre";

export type DatosLaborales = {
  usuario_id: string;
  empresa_id: string;
  tipo_contrato: TipoContratoLaboral;
  fecha_ingreso: string | null;
  sueldo_base: number;
  gratificacion_legal: boolean;
  colacion_mensual: number;
  movilizacion_mensual: number;
  afp: string | null;
  sistema_salud: SistemaSaludLaboral;
  plan_isapre_uf: number | null;
  plan_isapre_pesos: number | null;
  cargas_familiares: number;
  tasa_mutual_empresa: number | null;
  activo: boolean;
  actualizado_en: string;
  // migración 70 — para el archivo Previred / Libro de Remuneraciones DT
  codigo_isapre: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
};

export type EstadoLiquidacion = "borrador" | "emitida";

export type Liquidacion = {
  id: string;
  empresa_id: string;
  usuario_id: string | null;
  periodo: string;
  dias_trabajados: number;
  sueldo_base: number;
  gratificacion: number;
  horas_extra: number;
  otros_imponibles: number;
  colacion: number;
  movilizacion: number;
  otros_no_imponibles: number;
  asignacion_familiar: number;
  total_haberes: number;
  base_imponible: number;
  base_tributable: number;
  cotizacion_afp: number;
  comision_afp: number;
  cotizacion_salud: number;
  salud_adicional: number;
  cotizacion_afc: number;
  impuesto_unico: number;
  otros_descuentos: number;
  total_descuentos: number;
  liquido_pagar: number;
  aporte_afc_empleador: number;
  aporte_sis: number;
  aporte_mutual: number;
  detalle: Record<string, unknown>;
  pdf_url: string | null;
  estado: EstadoLiquidacion;
  creado_por: string | null;
  emitida_en: string | null;
  creado_en: string;
  actualizado_en: string;
  // migración 76
  emitida_por: string | null;
  editado_por: string | null;
  tuvo_licencia: boolean;
};

export type RolMensajeAsistente = "user" | "assistant";

export type MensajeAsistente = {
  id: string;
  empresa_id: string;
  usuario_id: string;
  rol: RolMensajeAsistente;
  contenido: string;
  creado_en: string;
};

export type PlantillaDocumento = {
  id: string;
  empresa_id: string;
  tipo: TipoPlantilla;
  mostrar_logo: boolean;
  posicion_logo: PosicionLogo;
  color_primario: string | null;
  color_secundario: string | null;
  texto_encabezado: string | null;
  texto_pie: string | null;
  mensaje_predeterminado: string | null;
  terminos_condiciones: string | null;
  mostrar_firma: boolean;
  actualizado_en: string;
};

export type ItemChecklistPregunta = {
  texto: string;
  obligatorio: boolean;
};

export type SeccionChecklist = {
  nombre: string;
  preguntas: ItemChecklistPregunta[];
};

export type ChecklistTemplate = {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  version: number;
  secciones: SeccionChecklist[];
  creado_en: string;
  actualizado_en: string;
};

export type TipoOS = {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  checklist_template_id: string | null;
  tiempo_estimado_minutos: number | null;
  activo: boolean;
  creado_en: string;
};

export type UnidadMedida = {
  id: string;
  empresa_id: string;
  nombre: string;
  abreviatura: string | null;
  activo: boolean;
  creado_en: string;
};

// credenciales nunca viaja al frontend con valores reales — el
// backend siempre devuelve un objeto vacío/enmascarado en su lugar.
// En la base es un blob cifrado (AES-256-GCM, ver backend/src/crypto.ts),
// no JSON legible — de ahí que sea string y no Record<string, unknown>.
export type Integracion = {
  id: string;
  empresa_id: string;
  proveedor: ProveedorIntegracion;
  categoria: CategoriaIntegracion;
  credenciales: string;
  conectado: boolean;
  conectado_en: string | null;
  actualizado_en: string;
};

export type CategoriaGasto = {
  id: string;
  empresa_id: string;
  nombre: string;
  color: string;
  creado_en: string;
};

export type CentroCosto = {
  id: string;
  empresa_id: string;
  nombre: string;
  categoria_gasto_ids: string[];
  creado_en: string;
};

export type NotificacionesConfig = {
  id: string;
  empresa_id: string;
  correo_activado: boolean;
  cotizacion_creada: boolean;
  cotizacion_aprobada: boolean;
  cotizacion_rechazada: boolean;
  os_creada: boolean;
  os_completada: boolean;
  cobranza_recibida: boolean;
  cobranza_atrasada: boolean;
  cotizacion_enviada: boolean;
  cotizacion_por_vencer: boolean;
  dias_aviso_vencimiento: number;
  tecnico_en_camino: boolean;
  cobro_pendiente: boolean;
  cita_agendada: boolean;
  cita_cancelada: boolean;
  cliente_cumpleanos: boolean;
  // Solo informativo — nunca se calcula ni se aplica en la app, la
  // empresa lo honra a mano. null = no mencionar ningún descuento.
  cliente_cumpleanos_descuento_pct: number | null;
  whatsapp_activado: boolean;
  actualizado_en: string;
};

// Los 7 eventos que efectivamente le mandan un correo o WhatsApp al
// CLIENTE (distinto de TipoNotificacion, que es el feed interno del equipo).
export type TipoNotificacionCliente =
  | "cotizacion_enviada"
  | "cotizacion_por_vencer"
  | "tecnico_en_camino"
  | "os_completada"
  | "cobro_pendiente"
  | "cobro_vencido"
  | "cita_agendada"
  | "cita_cancelada"
  | "cliente_cumpleanos";

export type EntidadNotificacionCliente = "cotizacion" | "trabajo" | "factura" | "tarea" | "cliente";

export type CanalNotificacionCliente = "correo" | "whatsapp";

export type NotificacionClienteLog = {
  id: string;
  empresa_id: string;
  tipo: TipoNotificacionCliente;
  destinatario: string;
  entidad_tipo: EntidadNotificacionCliente;
  entidad_id: string;
  canal: CanalNotificacionCliente;
  exito: boolean;
  error: string | null;
  creado_en: string;
};

export type MensajePersonalizado = {
  id: string;
  empresa_id: string;
  tipo: TipoMensajePersonalizado;
  mensaje_whatsapp: string | null;
  asunto_correo: string | null;
  cuerpo_correo: string | null;
  actualizado_en: string;
};

// Categoría de una foto de la OS (migración 98) — para agrupar la
// galería del PDF. null = foto general. Los VALORES (antes/despues) no
// se tocan a propósito — ya están guardados en analisis_fotos.categoria
// en producción; solo se ajustó la ETIQUETA a pedido de la usuaria
// (2026-09-11): "antes"/"despues" ahora se muestran como "Inicio"/
// "Término" en mobile y en el PDF, sin migración ni backfill.
export const CATEGORIAS_FOTO_OS = ["equipo", "antes", "durante", "despues"] as const;
export type CategoriaFotoOS = (typeof CATEGORIAS_FOTO_OS)[number];
export const ETIQUETA_CATEGORIA_FOTO_OS: Record<CategoriaFotoOS, string> = {
  equipo: "Equipo a intervenir",
  antes: "Inicio",
  durante: "Durante",
  despues: "Término",
};

export type AnalisisFoto = {
  id: string;
  empresa_id: string;
  orden_servicio_id: string | null;
  foto_url: string;
  categoria: string | null;
  subida_por: string | null;
  estado: EstadoAnalisisFoto;
  resumen: string | null;
  alerta: boolean;
  detalle_alerta: string | null;
  creado_en: string;
};

// ---------- Ventas (migración 95) ----------
// Una venta nace SIEMPRE de una cita o de una OS (hereda cliente y
// servicio); no hay venta libre. Queda pagada al instante — no genera
// cobro pendiente. El historial de dinero del cliente = facturas +
// ventas pagadas.
export type MedioPagoVenta = "efectivo" | "transferencia" | "tarjeta";
export type TipoLineaVenta = "servicio" | "producto" | "pack";

export type Venta = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  origen_tipo: "cita" | "os";
  origen_id: string;
  neto: number;
  iva: number;
  total: number;
  medio_pago: MedioPagoVenta;
  estado: "pagada" | "anulada";
  pagada_en: string;
  registrada_por: string | null;
  creado_en: string;
};

export type VentaLinea = {
  id: string;
  empresa_id: string;
  venta_id: string;
  tipo: TipoLineaVenta;
  // servicios.id | catalogo_items.id | tipos_pack.id según `tipo`.
  referencia_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  heredada: boolean;
  paquete_sesiones_id: string | null;
  creado_en: string;
};

export type VentaConLineas = Venta & { lineas: VentaLinea[] };

// Foto adjunta a un viaje (migración 95) — sube por la misma cola
// offline que la firma y el gasto. El admin las ve en el detalle del
// viaje (web + móvil).
export type ViajeFoto = {
  id: string;
  empresa_id: string;
  viaje_id: string;
  foto_url: string;
  subida_por: string | null;
  creado_en: string;
};

// Forma mínima de la base de datos para tipar al cliente de Supabase.
// Sustituir por el tipo generado con `supabase gen types typescript`
// cuando el CLI pueda correr contra este proyecto (requiere Docker).
type Tabla<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      empresas: Tabla<Empresa>;
      usuarios: Tabla<Usuario>;
      tipos_trabajo: Tabla<TipoTrabajo>;
      trabajos: Tabla<Trabajo>;
      clientes: Tabla<Cliente>;
      facturas: Tabla<Factura>;
      ordenes_servicio: Tabla<OrdenServicio>;
      inventario: Tabla<Inventario>;
      gastos_fijos: Tabla<GastoFijo>;
      analisis_fotos: Tabla<AnalisisFoto>;
      rutas_planificadas: Tabla<RutaPlanificada>;
      os_items: Tabla<OsItem>;
      gastos: Tabla<Gasto>;
      presupuestos: Tabla<Presupuesto>;
      informes_generados: Tabla<InformeGenerado>;
      plantillas_documento: Tabla<PlantillaDocumento>;
      checklist_templates: Tabla<ChecklistTemplate>;
      tipos_os: Tabla<TipoOS>;
      integraciones: Tabla<Integracion>;
      categorias_gasto: Tabla<CategoriaGasto>;
      centros_costo: Tabla<CentroCosto>;
      notificaciones_config: Tabla<NotificacionesConfig>;
      mensajes_personalizados: Tabla<MensajePersonalizado>;
      informes_personalizados: Tabla<InformePersonalizado>;
      asistente_mensajes: Tabla<MensajeAsistente>;
      viajes: Tabla<Viaje>;
      whatsapp_mensajes_procesados: Tabla<MensajeWhatsappProcesado>;
      whatsapp_conversaciones: Tabla<ConversacionWhatsapp>;
      auditoria_usuarios: Tabla<AuditoriaUsuario>;
      accesos_usuario: Tabla<AccesoUsuario>;
      unidades_medida: Tabla<UnidadMedida>;
      notificaciones_cliente_log: Tabla<NotificacionClienteLog>;
      portal_accesos: Tabla<PortalAcceso>;
      portal_codigos: Tabla<PortalCodigo>;
      tipos_documento: Tabla<TipoDocumento>;
      documentos: Tabla<Documento>;
      vehiculo_asignaciones: Tabla<VehiculoAsignacion>;
      notificaciones: Tabla<Notificacion>;
      notificaciones_preferencias: Tabla<NotificacionPreferencia>;
      equipos: Tabla<Equipo>;
      planes_mantencion: Tabla<PlanMantencion>;
      registros_mantencion_equipo: Tabla<RegistroMantencionEquipo>;
      registro_mantencion_fotos: Tabla<RegistroMantencionFoto>;
      sugerencias_rubro: Tabla<SugerenciaRubro>;
      catalogo_items: Tabla<CatalogoItem>;
      catalogo_kit_items: Tabla<CatalogoKitItem>;
      catalogo_item_tipos_equipo: Tabla<CatalogoItemTipoEquipo>;
      inventario_movimientos: Tabla<InventarioMovimiento>;
      proveedores: Tabla<Proveedor>;
      presupuesto_items: Tabla<PresupuestoItem>;
      tareas: Tabla<Tarea>;
      super_admins: Tabla<SuperAdmin>;
      super_admin_auditoria: Tabla<SuperAdminAuditoria>;
      superadmin_metricas_cache: Tabla<SuperadminMetricasCache>;
      empresa_feature_flags: Tabla<EmpresaFeatureFlag>;
      ia_uso: Tabla<IaUso>;
      errores_backend: Tabla<ErrorBackend>;
      requests_lentos: Tabla<RequestLento>;
      idempotencia: Tabla<Idempotencia>;
      consentimientos: Tabla<Consentimiento>;
      empresa_modulos: Tabla<EmpresaModulo>;
      empresa_rol_modulos: Tabla<EmpresaRolModulo>;
      paquetes_sesiones: Tabla<PaqueteSesiones>;
      tipos_pack: Tabla<TipoPack>;
      servicios: Tabla<Servicio>;
      agenda_pro_config: Tabla<AgendaProConfig>;
      agenda_pro_horarios: Tabla<AgendaProHorario>;
      suscripciones: Tabla<Suscripcion>;
      suscripcion_cobros: Tabla<SuscripcionCobro>;
      empresa_plan_historial: Tabla<EmpresaPlanHistorial>;
      mfa_totp_secretos: Tabla<MfaTotpSecreto>;
      mfa_codigo_pendiente: Tabla<MfaCodigoPendiente>;
      login_2fa_pendiente: Tabla<Login2faPendiente>;
      roles: Tabla<RolFila>;
      rol_empresas: Tabla<RolEmpresa>;
      empresa_accesos_autorizados: Tabla<EmpresaAccesoAutorizado>;
      parametros_previsionales: Tabla<ParametroPrevisional>;
      afp_parametros: Tabla<AfpParametro>;
      asignacion_familiar_tramos: Tabla<AsignacionFamiliarTramo>;
      datos_laborales: Tabla<DatosLaborales>;
      liquidaciones: Tabla<Liquidacion>;
      ventas: Tabla<Venta>;
      venta_lineas: Tabla<VentaLinea>;
      viaje_fotos: Tabla<ViajeFoto>;
    };
    Views: Record<string, never>;
    Functions: {
      generar_factura: {
        Args: {
          p_empresa_id: string;
          p_cliente: string;
          p_semana: string;
          p_trabajo_ids: string[];
          p_dias_plazo?: number;
        };
        Returns: string; // uuid de la factura creada
      };
      siguiente_folio_os: {
        Args: { p_empresa_id: string };
        Returns: number;
      };
      siguiente_folio_mantencion: {
        Args: { p_empresa_id: string };
        Returns: number;
      };
      incrementar_storage_usado: {
        Args: { p_empresa_id: string; p_bytes: number };
        Returns: void;
      };
      siguiente_numero_cotizacion: {
        Args: { p_empresa_id: string };
        Returns: number;
      };
      superadmin_metricas_calcular: {
        Args: Record<string, never>;
        Returns: MetricasSuperAdmin;
      };
      trabajos_del_dia: {
        Args: {
          p_empresa_id: string;
          p_responsable_id: string;
          p_fecha: string;
        };
        Returns: {
          trabajo_id: string;
          cliente_nombre: string;
          direccion: string;
          lat: number | null;
          lng: number | null;
        }[];
      };
    };
  };
};
