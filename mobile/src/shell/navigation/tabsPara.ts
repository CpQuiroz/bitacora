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
  modulosDeshabilitados: Modulo[]
): { tabs: TabKey[]; inicial: TabKey } {
  // "colaborador" es el rol de terreno puro; cualquier otro rol (admin,
  // supervisor, o un rol custom del Panel) se trata como gestión.
  const esGestion = usuario.rol !== "colaborador";
  const funcion = usuario.funcion;
  const empresaHaceViajes = !modulosDeshabilitados.includes("viajes");
  const rubroTransporte = empresa.rubro === "transporte";

  const verTrabajos = esGestion || funcion !== "chofer";
  const verViajes = empresaHaceViajes && (esGestion || funcion === "chofer" || rubroTransporte);

  const tabs: TabKey[] = [];
  if (verTrabajos) tabs.push("Trabajos");
  tabs.push("Ruta");
  if (verViajes) tabs.push("Viajes");
  tabs.push("Perfil");

  // Pestaña inicial: para transporte, arrancar en Viajes (o Ruta);
  // para el resto, Trabajos.
  let inicial: TabKey = "Trabajos";
  if (!verTrabajos || rubroTransporte || funcion === "chofer") {
    inicial = verViajes ? "Viajes" : "Ruta";
  }
  if (!tabs.includes(inicial)) inicial = tabs[0];

  return { tabs, inicial };
}
