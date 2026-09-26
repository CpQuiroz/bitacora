import type { Accion, FuncionColaborador, Modulo } from "@bitacora/shared";
import { FUNCIONES_LEVANTAMIENTOS } from "@bitacora/shared";

// Qué entradas del menú mobile se muestran según los módulos (tarea 152).
// Misma fuente que el backend, sin listas aparte (/api/me):
//   · visibles: módulos del rol (roles + empresa_rol_modulos) ∩ módulos
//     activos de la empresa ∩ plan — lo mismo que exige requiereModulo.
//   · deshabilitados: módulos apagados en la empresa (empresa_modulos).
// Dos niveles, porque el rol colaborador (técnicos, choferes) no trae
// ordenes_servicio/viajes/flota/levantamientos y aun así trabaja lo que le
// asignan (el backend no exige esos módulos en /api/trabajos,
// /api/mis-viajes ni /api/levantamientos):
//   · Gestión → el rol tiene que ver el módulo.
//   · Trabajo propio → basta con que la empresa tenga el módulo activo
//     (y la función que corresponda).
export type EntradaAcceso = {
  visibles: readonly Modulo[];
  deshabilitados: readonly Modulo[];
  funcion: FuncionColaborador | null;
  rol: string | null;
  acciones: readonly Accion[];
};

export function accesoModulos({ visibles, deshabilitados, funcion, rol, acciones }: EntradaAcceso) {
  const rolVe = (m: Modulo) => visibles.includes(m);
  const empresaTiene = (m: Modulo) => !deshabilitados.includes(m);
  const esChofer = funcion === "chofer";
  return {
    rolVe,
    empresaTiene,
    // OS asignadas a cualquier colaborador: basta con que la empresa tenga el módulo.
    ordenesServicio: rolVe("ordenes_servicio") || empresaTiene("ordenes_servicio"),
    viajes: rolVe("viajes") || (esChofer && empresaTiene("viajes")),
    // Mantención de flota: gestión con Flota, o el chofer con su camión.
    mantencion: rolVe("flota") || (esChofer && empresaTiene("flota")),
    miVehiculo: esChofer && empresaTiene("flota"),
    levantamientos: empresaTiene("levantamientos") && (rol === "admin" || (funcion != null && FUNCIONES_LEVANTAMIENTOS.includes(funcion))),
    clientes: rolVe("registros"),
    // Una venta usa ítems del Catálogo o servicios de Agenda Pro.
    registrarVenta: acciones.includes("registrar_venta") && (rolVe("catalogo") || rolVe("agenda_pro")),
  };
}

// Atajo desde el contexto de sesión (useAuth()).
export function accesoDesdeAuth(auth: {
  fase: string;
  modulosVisibles?: Modulo[];
  modulosDeshabilitados?: Modulo[];
  acciones?: Accion[];
  usuario?: { funcion?: FuncionColaborador | null; rol?: string };
}) {
  const listo = auth.fase === "listo";
  return accesoModulos({
    visibles: listo ? (auth.modulosVisibles ?? []) : [],
    deshabilitados: listo ? (auth.modulosDeshabilitados ?? []) : [],
    funcion: listo ? (auth.usuario?.funcion ?? null) : null,
    rol: listo ? (auth.usuario?.rol ?? null) : null,
    acciones: listo ? (auth.acciones ?? []) : [],
  });
}
