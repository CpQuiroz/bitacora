/**
 * Contrato compartido de las primitivas. Las implementaciones web
 * (src/web) y native (src/native) exponen EXACTAMENTE estas props.
 * Nombres en español, igual que el dominio del repo.
 */
import type { ReactNode } from "react";

export type Tamano = "sm" | "md" | "lg";

// ── Button ────────────────────────────────────────────────────────
export type VarianteBoton = "primario" | "secundario" | "ghost" | "peligro";

export type PropsBoton = {
  children: ReactNode;
  onPress?: () => void;
  variante?: VarianteBoton;
  tamano?: Tamano;
  /** Ancho completo del contenedor. */
  bloque?: boolean;
  cargando?: boolean;
  deshabilitado?: boolean;
  iconoIzq?: ReactNode;
  iconoDer?: ReactNode;
  /** Para <button type> en web; ignorado en native. */
  tipo?: "button" | "submit";
  /** Etiqueta accesible si el contenido no es texto. */
  etiquetaAccesible?: string;
};

// ── Alturas por tamaño (px) ───────────────────────────────────────
// Web: 36 / 44 / 52. Native: nunca por debajo de 44.
export const ALTURA_WEB: Record<Tamano, number> = { sm: 36, md: 44, lg: 52 };
export const ALTURA_NATIVE: Record<Tamano, number> = { sm: 44, md: 48, lg: 52 };

// ── Campos de formulario ───────────────────────────────────────────
export type PropsCampoBase = {
  etiqueta?: string;
  error?: string | null;
  ayuda?: string;
  deshabilitado?: boolean;
};

// "codigo": texto con teclado numérico (OTP/2FA) — a diferencia de
// "numero" (<input type=number>, con flechas y que puede comerse ceros
// a la izquierda), esto es <input type=text inputMode=numeric> / RN
// keyboardType="number-pad". Agregado al migrar el login (Paso 6): el
// campo de código de 6 dígitos lo necesitaba y no había una forma
// correcta de pedirlo con el contrato anterior.
export type TipoInput = "texto" | "numero" | "codigo" | "email" | "password" | "tel" | "hora";

export type PropsInput = PropsCampoBase & {
  valor: string;
  onCambio: (texto: string) => void;
  placeholder?: string;
  tipo?: TipoInput;
  /** Tope de caracteres (ej. código de 6 dígitos). */
  maxLongitud?: number;
  /** Mínimo de caracteres — validación nativa del navegador (ej. contraseña). */
  minLongitud?: number;
  /** Validación nativa del navegador: bloquea el submit si está vacío. */
  requerido?: boolean;
  iconoIzq?: ReactNode;
  autoFoco?: boolean;
  /**
   * false para correo/usuario — evita la mayúscula automática de la
   * primera letra (RN: autoCapitalize; web: no aplica, autoCapitalize del
   * navegador no interfiere igual). Default true.
   */
  autoCapitalizar?: boolean;
  /** Se llama al presionar "siguiente/ir" en el teclado (RN) o Enter (web). */
  onSubmit?: () => void;
};

export type PropsTextarea = PropsCampoBase & {
  valor: string;
  onCambio: (texto: string) => void;
  placeholder?: string;
  /** Alto sugerido en líneas visibles (web: rows; native: minHeight ≈ filas·20). */
  filas?: number;
};

export type OpcionSelect = { valor: string; etiqueta: string };

export type PropsSelect = PropsCampoBase & {
  valor: string | null;
  onCambio: (valor: string) => void;
  opciones: OpcionSelect[];
  placeholder?: string;
};

export type PropsDatePicker = PropsCampoBase & {
  valor: Date | null;
  onCambio: (fecha: Date | null) => void;
  placeholder?: string;
  minimo?: Date;
  maximo?: Date;
};

// ── Card ────────────────────────────────────────────────────────────
export type Elevacion = "sm" | "md" | "lg";

export type PropsCard = {
  children: ReactNode;
  onPress?: () => void;
  elevacion?: Elevacion;
  /** Sin padding interno (para envolver una tabla, por ejemplo). */
  sinRelleno?: boolean;
};

/** radius.lg (28) × 1.15 — solo para Card, no es un token de tokens.json. */
export const RADIO_CARD = 32;

// ── Tag / Badge (tonal, de uso libre) ──────────────────────────────
export type TonoTag = "accent" | "accent2" | "neutral" | "outline";

export type PropsTag = {
  children: ReactNode;
  tono?: TonoTag;
};

// ── Estados de pantalla: vacío / cargando / error ──────────────────
export type PropsSkeleton = {
  ancho?: number | string;
  alto?: number;
  radio?: number;
};

export type PropsEmptyState = {
  titulo: string;
  mensaje?: string;
  /** CTA primario (normalmente un <Button variante="primario">). */
  accion?: ReactNode;
  icono?: ReactNode;
};

export type PropsErrorState = {
  titulo?: string;
  /**
   * Quien llama decide el texto: distinguí error de red ("no hay
   * conexión, reintentá") de error de permiso ("no tenés acceso a esto")
   * — el primitivo no lo adivina.
   */
  mensaje?: string;
  /**
   * Quien llama es responsable de que reintentar conserve los filtros
   * activos (ej. volver a pedir con el mismo período/búsqueda).
   */
  onReintentar?: () => void;
  icono?: ReactNode;
};

export type PropsLoadingState = {
  /** Esqueletos a medida del contenido real. Sin children: 3 líneas genéricas. */
  children?: ReactNode;
};

// ── Dialog / Sheet ──────────────────────────────────────────────────
// Web: modal centrado. Mobile: SIEMPRE bottom sheet (mismo componente,
// no hay variante "centrada" en mobile — ver prompt del sistema de diseño).
export type PropsDialog = {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
};

// ── Toast ───────────────────────────────────────────────────────────
export type MostrarToast = (mensaje: string) => void;

// ── Cifra: montos, cantidades, fechas, folios ──────────────────────
// font-variant-numeric: tabular-nums, para que las columnas alineen.
export type PropsCifra = { children: ReactNode };

// ── StatusBadge (semántico, un estado de dominio → un tono fijo) ──
// Solo 4 tonos, tal como los define el prompt. Para roles, prioridad o
// canal (que no son "estados" en el sentido de ciclo de vida) usá <Tag>
// con el tono que corresponda — no fuerces esos casos en este mapa.
export type TonoEstado = "en_progreso" | "completado" | "cerrado" | "cancelado";

export type PropsStatusBadge = {
  /** Valor crudo del dominio (ej. "en_curso", "firmada", "cancelada"). */
  estado: string;
  /** Texto a mostrar; por defecto `estado` con "_" → " ". */
  etiqueta?: string;
  /**
   * Fuerza el tono cuando `estado` no está en MAPA_ESTADO_TONO (evita que
   * un valor no mapeado caiga en el fallback "cerrado" por descuido).
   */
  tonoForzado?: TonoEstado;
};

/**
 * Fuente única del mapa estado→tono. Consolida lo que antes estaba
 * repetido en 5 lugares (web ui.tsx TONO_DE_ESTADO, EstadoCitaRiel,
 * mobile ui/Badge.tsx POR_ESTADO, TareaDetalleScreen,
 * DetalleReservaCosmetologia — ver docs/design-audit.md §3).
 *
 * Solo entran acá los estados de CICLO DE VIDA que caen sin forzar en uno
 * de los 4 tonos. Roles (admin/colaborador…), prioridad (alta/media/baja)
 * y canal (correo/whatsapp) NO son estados — quedan para <Tag>. Un estado
 * ambiguo (ej. "pendiente", "borrador") tampoco entra: usá `tonoForzado`
 * en el call-site en vez de adivinar.
 */
export const MAPA_ESTADO_TONO: Record<string, TonoEstado> = {
  // en_progreso — accentRamp.200/800
  en_curso: "en_progreso",
  en_proceso: "en_progreso",
  agendado: "en_progreso",
  // completado — accent2Ramp.200/800
  completado: "completado",
  completada: "completado",
  firmada: "completado",
  pagada: "completado",
  pagado: "completado",
  aprobado: "completado",
  confirmado: "completado",
  confirmada: "completado",
  vigente: "completado",
  exitoso: "completado",
  exito: "completado",
  disponible: "completado",
  activo: "completado",
  activa: "completado",
  entrada: "completado",
  // cerrado — neutral.300/900
  convertido: "cerrado",
  cerrado: "cerrado",
  inactivo: "cerrado",
  dada_de_baja: "cerrado",
  expirado: "cerrado",
  // cancelado — neutral.200/700
  cancelado: "cancelado",
  cancelada: "cancelado",
  rechazado: "cancelado",
  vencida: "cancelado",
  vencido: "cancelado",
  no_asistio: "cancelado",
  cancelada_anticipada: "cancelado",
  sin_stock: "cancelado",
  fallido: "cancelado",
  agotado: "cancelado",
  salida: "cancelado",
};
