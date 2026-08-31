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
export type Rubro = "transporte" | "servicio_tecnico" | "otro";
export type Plan = "trial" | "basico" | "pro";
export type EstadoEmpresa = "activa" | "suspendida" | "dada_de_baja";
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
export type EstadoOS = "pendiente" | "enviada" | "en_proceso" | "completada" | "firmada";
export type EstadoGasto = "pagado" | "pendiente";
export type EstadoPresupuesto = "borrador" | "enviado" | "aprobado" | "rechazado" | "expirado";
export type TipoInforme = "financiero" | "operativo" | "clientes" | "colaboradores" | "personalizado";
export type SeccionInforme = "financiero" | "ventas" | "operaciones" | "servicios" | "clientes" | "gastos";

export type TipoCuenta = "corriente" | "vista" | "ahorro";
export type TipoPlantilla = "cotizacion" | "orden_servicio" | "cobranza" | "terminos_aceptacion";
export type PosicionLogo = "izquierda" | "centro" | "derecha";
export type ProveedorIntegracion = "webpay" | "flow" | "mercadopago" | "whatsapp" | "anthropic" | "google_document_ai";
export type CategoriaIntegracion = "pagos" | "comunicacion" | "ia";
export type TipoMensajePersonalizado = "cotizacion" | "orden_servicio" | "cobranza" | "tecnico_en_camino" | "cita_agendada" | "cumpleanos";

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
  // Contador aproximado, incrementado por la app en cada subida (ver
  // migración 56 y backend/src/limites.ts) — no un total exacto
  // recalculado, para no tener que escanear los buckets S3 en cada
  // subida de archivo (eso sí lo hace medirUsoStorage, para el Panel
  // de Super-Admin, con costo de latencia asumido para ese caso).
  storage_bytes_usado: number;
  estado: EstadoEmpresa;
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

export type ErrorBackend = {
  id: string;
  empresa_id: string | null;
  ruta: string;
  metodo: string;
  mensaje: string;
  creado_en: string;
};

export type EmpresaModulo = {
  empresa_id: string;
  modulo: string;
  activado: boolean;
  actualizado_en: string;
};

export type Usuario = {
  id: string; // = auth.users.id
  empresa_id: string;
  nombre: string;
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

// Tabla vehiculos: ya sin uso activo — los vehículos viven en equipos
// (categoria = "Vehículo") desde la migración 52_fusion_vehiculos_equipos.
// Se mantiene el tipo porque la tabla física sigue existiendo (por si
// hace falta rollback), pero nada nuevo debería escribir acá.
export type Vehiculo = {
  id: string;
  empresa_id: string;
  patente: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  tipo: string | null;
  capacidad_carga: string | null;
  activo: boolean;
  creado_en: string;
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
  campo: "rol" | "activo";
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
  | "cita_cancelada";

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
  origen: "manual" | "reserva_publica";
  creado_en: string;
  actualizado_en: string;
};

// Agenda Pro: pack de N sesiones comprado por un cliente (ej. 5 o 10).
// El saldo restante no se guarda acá — se calcula siempre a partir de
// las tareas con este paquete_id (ver backend/src/routes/paquetesSesiones.ts).
export type PaqueteSesiones = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  nombre: string;
  cantidad_total: number;
  fecha_compra: string;
  notas: string | null;
  creado_en: string;
};

export type PaqueteSesionesConSaldo = PaqueteSesiones & { saldo: number };

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
  observaciones_cierre: string | null;
  informe_ia: string | null;
  finalizada_en: string | null;
  // true una vez que /finalizar (estado_os "firmada") generó los
  // movimientos de salida de inventario de sus ítems tipo "producto" —
  // evita descontar dos veces o revertir sin haber descontado antes.
  stock_descontado: boolean;
  // Cacheado solo una vez firmada — ver migración 57 y obtenerPdfOS en
  // backend/src/routes/trabajos.ts.
  pdf_url: string | null;
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
export type OrigenCapturaViaje = "manual" | "whatsapp";

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

export type AnalisisFoto = {
  id: string;
  empresa_id: string;
  orden_servicio_id: string | null;
  foto_url: string;
  subida_por: string | null;
  estado: EstadoAnalisisFoto;
  resumen: string | null;
  alerta: boolean;
  detalle_alerta: string | null;
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
      auditoria_usuarios: Tabla<AuditoriaUsuario>;
      accesos_usuario: Tabla<AccesoUsuario>;
      unidades_medida: Tabla<UnidadMedida>;
      notificaciones_cliente_log: Tabla<NotificacionClienteLog>;
      portal_accesos: Tabla<PortalAcceso>;
      portal_codigos: Tabla<PortalCodigo>;
      tipos_documento: Tabla<TipoDocumento>;
      documentos: Tabla<Documento>;
      vehiculos: Tabla<Vehiculo>;
      vehiculo_asignaciones: Tabla<VehiculoAsignacion>;
      notificaciones: Tabla<Notificacion>;
      notificaciones_preferencias: Tabla<NotificacionPreferencia>;
      equipos: Tabla<Equipo>;
      planes_mantencion: Tabla<PlanMantencion>;
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
      ia_uso: Tabla<IaUso>;
      errores_backend: Tabla<ErrorBackend>;
      empresa_modulos: Tabla<EmpresaModulo>;
      paquetes_sesiones: Tabla<PaqueteSesiones>;
      agenda_pro_config: Tabla<AgendaProConfig>;
      agenda_pro_horarios: Tabla<AgendaProHorario>;
      suscripciones: Tabla<Suscripcion>;
      suscripcion_cobros: Tabla<SuscripcionCobro>;
      empresa_plan_historial: Tabla<EmpresaPlanHistorial>;
      mfa_totp_secretos: Tabla<MfaTotpSecreto>;
      mfa_codigo_pendiente: Tabla<MfaCodigoPendiente>;
      login_2fa_pendiente: Tabla<Login2faPendiente>;
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
      incrementar_storage_usado: {
        Args: { p_empresa_id: string; p_bytes: number };
        Returns: void;
      };
      siguiente_numero_cotizacion: {
        Args: { p_empresa_id: string };
        Returns: number;
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
