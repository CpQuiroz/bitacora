// ============================================================
// BITÁCORA — Siembra inicial por rubro al crear una empresa.
//
// Tarea 144 (25-sep-2026, decisión de la usuaria): una empresa nueva
// parte SIN servicios, tipos de pack, ítems de catálogo, tipos de OS,
// categorías de gasto ni tipos de documento. Cada pantalla de creación
// muestra las sugerencias de su rubro (tabla sugerencias_rubro, GET
// /api/sugerencias-rubro) para crearlas con un clic. Lo único que se
// sigue precargando son los checklists de "Mantención de flota" de las
// empresas de transporte.
//
// NUNCA lanza: si algo falla se loguea y la creación de la empresa
// sigue. Idempotente — chequea qué ya existe antes de insertar.
// ============================================================
import type { Rubro } from "@bitacora/shared";
import { supabase } from "./supabase";

// Checklists "Mantención de flota" (migración 96, separados por tipo
// desde la migración 101) — para empresas de transporte nuevas. Las
// migraciones ya los sembraron en las existentes. Idempotente: no
// duplica si ya hay uno con ese nombre. El diario es deliberadamente
// más corto que el Programa (chequeo antes de salir a ruta, no un
// service completo) — cada empresa puede editar cualquiera de los dos
// desde Configuración → Checklists.
function seccionesDe(lista: { nombre: string; preguntas: string[] }[]) {
  return lista.map((s) => ({ nombre: s.nombre, preguntas: s.preguntas.map((texto) => ({ texto, obligatorio: true })) }));
}

const CHECKLIST_MANTENCION_PROGRAMA = {
  nombre: "Mantención Flota",
  descripcion: "Service preventivo cada 6 meses / 250h, por sistema del camión.",
  secciones: seccionesDe([
    { nombre: "Motor y lubricación", preguntas: ["Cambio de aceite y filtro de motor", "Filtro de combustible", "Filtro de aire", "Correas y mangueras"] },
    { nombre: "Enfriamiento", preguntas: ["Refrigerante (nivel y estado)", "Radiador y manguitos"] },
    { nombre: "Transmisión y embrague", preguntas: ["Nivel de aceite de transmisión", "Ajuste y desgaste del embrague"] },
    { nombre: "Diferenciales y ejes", preguntas: ["Nivel de aceite diferencial", "Rodamientos de cubo"] },
    { nombre: "Dirección y suspensión", preguntas: ["Terminales y rótulas de dirección", "Muelles y amortiguadores"] },
    { nombre: "Frenos", preguntas: ["Guarniciones / pastillas", "Compresor y secador de aire", "Cámaras de freno"] },
    { nombre: "Neumáticos", preguntas: ["Rotación y alineación", "Torque de pernos de rueda"] },
    { nombre: "Eléctrico", preguntas: ["Batería y alternador"] },
    { nombre: "Escape", preguntas: ["Sistema de escape completo"] },
    { nombre: "Seguridad", preguntas: ["Extintor recargado", "Botiquín completo"] },
  ]),
};

const CHECKLIST_MANTENCION_DIARIO = {
  nombre: "Checklist diario",
  descripcion: "Chequeo antes de salir a ruta — solo lo que compromete seguridad o deja el camión botado.",
  secciones: seccionesDe([
    { nombre: "Motor y niveles", preguntas: ["Aceite de motor", "Refrigerante", "Fugas visibles (aceite / combustible / refrigerante)"] },
    { nombre: "Frenos", preguntas: ["Presión de aire alcanza régimen", "Freno de estacionamiento"] },
    { nombre: "Neumáticos y ruedas", preguntas: ["Presión de neumáticos", "Estado visual (cortes, desgaste irregular)", "Pernos de rueda"] },
    { nombre: "Luces", preguntas: ["Luces delanteras y traseras", "Direccionales y baliza"] },
    { nombre: "Eléctrico", preguntas: ["Batería (terminales)"] },
    { nombre: "Cabina", preguntas: ["Cinturón de seguridad"] },
    { nombre: "Seguridad", preguntas: ["Extintor vigente"] },
  ]),
};

async function sembrarUnChecklist(empresaId: string, plantilla: typeof CHECKLIST_MANTENCION_PROGRAMA): Promise<void> {
  const { data: existente } = await supabase
    .from("checklist_templates")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("nombre", plantilla.nombre)
    .maybeSingle();
  if (existente) return;
  const { error } = await supabase.from("checklist_templates").insert({
    empresa_id: empresaId,
    nombre: plantilla.nombre,
    descripcion: plantilla.descripcion,
    secciones: plantilla.secciones,
  });
  if (error) console.error(`Error sembrando checklist "${plantilla.nombre}":`, error);
}

async function sembrarChecklistMantencion(empresaId: string): Promise<void> {
  try {
    await Promise.all([
      sembrarUnChecklist(empresaId, CHECKLIST_MANTENCION_PROGRAMA),
      sembrarUnChecklist(empresaId, CHECKLIST_MANTENCION_DIARIO),
    ]);
  } catch (err) {
    console.error("Error en sembrarChecklistMantencion():", err);
  }
}

export async function sembrarSugerenciasRubro(empresaId: string, rubro: Rubro): Promise<void> {
  try {
    if (rubro === "transporte") await sembrarChecklistMantencion(empresaId);
  } catch (err) {
    console.error("Error en sembrarSugerenciasRubro():", err);
  }
}
