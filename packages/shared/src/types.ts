// ============================================================
// Tipos compartidos — reflejan el esquema de Supabase después de
// aplicar, en orden, supabase/migrations/01..05 (ver ese folder).
// La tabla "trabajos" reemplaza a "viajes" (ver 04_generalizacion.sql).
//
// Nota: los "Row" son `type`, no `interface`, a propósito — el
// cliente tipado de supabase-js exige que cada Row/Insert/Update
// sea estructuralmente compatible con Record<string, unknown>, y
// TypeScript solo infiere eso para `type`, no para `interface`
// (mismo patrón que usa `supabase gen types typescript`).
// ============================================================

export type Rol = "admin" | "contador" | "chofer";
export type Rubro = "transporte" | "servicio_tecnico" | "otro";
export type Plan = "trial" | "basico" | "pro";
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

export type Empresa = {
  id: string;
  nombre: string;
  rubro: Rubro;
  plan: Plan;
  logo_url: string | null;
  creado_en: string;
};

export type Usuario = {
  id: string; // = auth.users.id
  empresa_id: string;
  nombre: string;
  rol: Rol;
  creado_en: string;
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
  direccion: string;
  lat: number | null;
  lng: number | null;
  telefono: string | null;
  notas: string | null;
  creado_en: string;
};

export type Factura = {
  id: string;
  empresa_id: string;
  cliente: string;
  semana_facturada: string | null;
  monto: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: EstadoFactura;
  trabajo_ids: string[] | null;
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
