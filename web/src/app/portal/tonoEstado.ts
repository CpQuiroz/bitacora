import type { TonoEstado } from "@bitacora/ui/web";

// Estados que se ven en el portal y NO están en MAPA_ESTADO_TONO (por
// ambiguos en general). Acá sí tienen un sentido claro para el cliente,
// y conservan el tono que tenían con el Badge antiguo (tarea 157):
// "pendiente" (visita, cita por confirmar, cobro por pagar) = aviso;
// "enviado"/"enviada" (cotización u OS en curso) = en progreso;
// "borrador" = neutro. El resto lo resuelve el mapa de @bitacora/ui.
const TONO_PORTAL: Record<string, TonoEstado> = {
  pendiente: "advertencia",
  enviado: "en_progreso",
  enviada: "en_progreso",
  borrador: "cerrado",
};

export function tonoPortal(estado: string): TonoEstado | undefined {
  return TONO_PORTAL[estado];
}
