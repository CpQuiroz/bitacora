import type { useAuth } from "../auth/AuthContext";

// Permisos de Equipos en mobile (tarea 146) — espejo de lo que exige el
// backend (equipos.ts, documentos.ts, planesMantencion.ts); la verdad la
// tiene el servidor, esto solo evita ofrecer botones que darían 403.
//   · Vehículo: editar, plan, asignar y todos sus documentos → módulo "flota".
//   · Otro equipo: editar y plan → "equipos" o "flota".
//   · Chofer: ve, sube y edita los documentos de su vehículo asignado.
export function permisosEquipos(auth: ReturnType<typeof useAuth>) {
  const visibles = auth.fase === "listo" ? auth.modulosVisibles : [];
  const flota = visibles.includes("flota");
  const equipos = visibles.includes("equipos");
  return {
    flota,
    verLista: flota || equipos,
    editarEquipo: (vehiculo: boolean) => flota || (!vehiculo && equipos),
    documentos: (asignadoAMi: boolean) => flota || asignadoAMi,
    borrarDocumento: flota,
    asignar: flota,
  };
}
