import { StatusBadge, type TonoEstado } from "@bitacora/ui/web";

// Estados de Super-Admin que no están en el mapa compartido de StatusBadge
// (o que acá se leen distinto): mismo tono que tenían con el Badge antiguo.
// Lo usan el listado y la ficha de empresa, para que no difieran.
const TONO_ESTADO: Record<string, TonoEstado> = {
  suspendida: "advertencia",
  dada_de_baja: "peligro",
  trial: "en_progreso",
  pago_pendiente: "advertencia",
  suspendida_por_pago: "peligro",
  pendiente: "advertencia",
  fallido: "peligro",
  cancelada: "peligro",
  correo: "en_progreso",
  dominio: "en_progreso",
};

export function EstadoSuperAdmin({ estado, etiqueta }: { estado: string; etiqueta?: string }) {
  return <StatusBadge estado={estado} etiqueta={etiqueta} tonoForzado={TONO_ESTADO[estado]} />;
}
