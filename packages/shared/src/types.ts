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
export type EstadoFactura = "pendiente" | "pagada" | "vencida";
export type EstadoAnalisisFoto = "procesando" | "listo" | "error";
export type TipoGasto = "negocio" | "personal";

export type Empresa = {
  id: string;
  nombre: string;
  rubro: Rubro;
  plan: Plan;
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
    };
  };
};
