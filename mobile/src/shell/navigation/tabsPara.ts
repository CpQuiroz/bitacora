import type { Empresa, Modulo, Usuario } from "@bitacora/shared";
import type { TabKey } from "./types";

// Calcula qué pestañas ve este usuario y cuál abre primero.
//
// Ejes:
//  - rol: supervisor/admin ven más (trabajos del equipo se maneja
//    dentro de la pantalla Trabajos, no como pestaña aparte).
//  - funcion (colaborador): un chofer puro no ve Trabajos; un técnico
//    no ve Viajes.
//  - módulos de la empresa: si "viajes" está deshabilitado, sin pestaña.
//  - rubro: define qué pestaña abre primero.
export function tabsPara(
  usuario: Pick<Usuario, "rol" | "funcion">,
  empresa: Pick<Empresa, "rubro">,
  modulosDeshabilitados: Modulo[],
  modulosVisibles: Modulo[] = []
): { tabs: TabKey[]; inicial: TabKey } {
  // "colaborador" es el rol de terreno puro; cualquier otro rol (admin,
  // supervisor, o un rol custom del Panel) se trata como gestión.
  const esGestion = usuario.rol !== "colaborador";
  const funcion = usuario.funcion;
  const empresaHaceViajes = !modulosDeshabilitados.includes("viajes");
  const rubroTransporte = empresa.rubro === "transporte";

  const verTrabajos = esGestion || funcion !== "chofer";
  const verViajes = empresaHaceViajes && (esGestion || funcion === "chofer" || rubroTransporte);
  // La Agenda (tareas/citas asignadas) aparece si el rol la ve — se
  // resuelve en el backend con la matriz de perfiles por empresa.
  const verAgenda = modulosVisibles.includes("agenda");

  const tabs: TabKey[] = [];
  if (verTrabajos) tabs.push("Trabajos");
  if (verAgenda) tabs.push("Agenda");
  // "Ruta" (ruta del día) es una vista de terreno — un rol de gestión no
  // la usa y quedó como panel estático. Solo para no-gestión.
  if (!esGestion) tabs.push("Ruta");
  // Clientes y "Gestión" (cobros, asistente) son solo para roles que no
  // son de terreno puro. El detalle de qué ve adentro se resuelve por módulo.
  if (esGestion) tabs.push("Clientes");
  if (verViajes) tabs.push("Viajes");
  if (esGestion) tabs.push("Gestion");
  tabs.push("Perfil");

  // Pestaña inicial: transporte arranca en Viajes; si la empresa no
  // tiene Viajes, cae a Trabajos (nunca a Ruta como landing — Ruta es
  // secundaria y su mapa puede no estar disponible).
  let inicial: TabKey = "Trabajos";
  if (rubroTransporte || funcion === "chofer") {
    inicial = verViajes ? "Viajes" : verTrabajos ? "Trabajos" : "Ruta";
  }
  if (!verTrabajos && !verViajes) inicial = tabs[0];
  if (!tabs.includes(inicial)) inicial = tabs[0];

  return { tabs, inicial };
}
