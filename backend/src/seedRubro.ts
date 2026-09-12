// ============================================================
// BITÁCORA — Siembra inicial por rubro al crear una empresa.
//
// Una empresa nueva arranca completamente vacía: sin tipos de documento,
// sin categorías de gasto, sin tipos de OS. El admin tiene que descubrir
// cada pantalla de Configuración y cargarlas a mano, y hasta que lo hace
// hay flujos bloqueados (ej. "adjuntar documento" a un colaborador o
// vehículo — no hay ningún tipo para elegir).
//
// Esto toma las sugerencias del rubro elegido (tabla sugerencias_rubro,
// ver Bloque E / migración 54) y las deja como filas reales y activas.
// Hoy solo hay contenido para rubro = 'transporte'; para los demás no
// hace nada (y no rompe).
//
// NUNCA lanza: si algo falla se loguea y la creación de la empresa
// sigue. Idempotente — chequea qué ya existe antes de insertar.
// ============================================================
import type { Rubro } from "@bitacora/shared";
import { supabase } from "./supabase";

const APLICA_VALIDO = new Set(["colaborador", "vehiculo", "ambos"]);

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
  nombre: "Mantención de flota - Programa",
  descripcion: "Programa de Mantención (250 h / 6 meses), en taller externo o interno.",
  secciones: seccionesDe([
    { nombre: "Motor y filtros", preguntas: ["Aceite de motor", "Filtro de aceite del motor", "Filtro de combustible", "Filtro de aire", "Filtro decantador de agua", "Correa de accesorios"] },
    { nombre: "Niveles y fluidos", preguntas: ["Refrigerante de motor", "Aceite de dirección", "Aceite de diferenciales", "Aceite de mazas ejes direccional", "Aceite de mazas ejes traseros", "Aceite de transmisión", "Líquido limpiaparabrisas"] },
    { nombre: "Embrague y transmisión", preguntas: ["Ajuste de embrague", "Engrasado de embrague", "Rodamiento de embrague", "Collarín del embrague"] },
    { nombre: "Dirección y suspensión", preguntas: ["Terminal de dirección", "Rótulas de brazo viajero", "Rótulas de barra estabilizadora", "Pernos de muelle", "Cruceta flecha de dirección", "Crucetas de flecha intereje", "Flechas deslizables"] },
    { nombre: "Frenos", preguntas: ["Ajustadores de freno delantero", "Ajustadores de frenos traseros", "Sistema de frenos de aire / válvulas"] },
    { nombre: "Neumáticos y eléctrico", preguntas: ["Presión de neumáticos", "Profundidad banda de rodado", "Estado llanta de repuesto", "Batería y terminales", "Luces y señalización"] },
    { nombre: "Seguridad y documentación", preguntas: ["Extintor vigente", "Botiquín / kit de emergencia", "Triángulos y conos de seguridad"] },
  ]),
};

const CHECKLIST_MANTENCION_DIARIO = {
  nombre: "Mantención de flota - Diario",
  descripcion: "Chequeo visual/funcional antes de salir a ruta — más corto que el Programa de Mantención.",
  secciones: seccionesDe([
    { nombre: "Niveles y fluidos", preguntas: ["Aceite de motor", "Refrigerante de motor", "Líquido limpiaparabrisas"] },
    { nombre: "Neumáticos y luces", preguntas: ["Presión de neumáticos", "Estado llanta de repuesto", "Batería y terminales", "Luces y señalización"] },
    { nombre: "Frenos y dirección", preguntas: ["Sistema de frenos de aire / válvulas", "Terminal de dirección"] },
    { nombre: "Seguridad y documentación", preguntas: ["Extintor vigente", "Botiquín / kit de emergencia", "Triángulos y conos de seguridad"] },
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

    const { data: sugerencias } = await supabase
      .from("sugerencias_rubro")
      .select("tipo_sugerencia, valor, aplica_a")
      .eq("rubro", rubro);
    if (!sugerencias || sugerencias.length === 0) return;

    const nombresDe = (tipo: string) => sugerencias.filter((s) => s.tipo_sugerencia === tipo).map((s) => s.valor);

    // Filtra contra lo que ya existe (idempotencia sin depender de que
    // cada tabla tenga un unique(empresa_id, nombre)).
    async function nuevos(tabla: "tipos_documento" | "categorias_gasto" | "tipos_os", candidatos: string[]): Promise<Set<string>> {
      if (candidatos.length === 0) return new Set();
      const { data: existentes } = await supabase.from(tabla).select("nombre").eq("empresa_id", empresaId);
      const yaHay = new Set((existentes ?? []).map((r) => r.nombre));
      return new Set(candidatos.filter((n) => !yaHay.has(n)));
    }

    const [docsNuevos, catsNuevas, osNuevos] = await Promise.all([
      nuevos("tipos_documento", nombresDe("tipo_documento")),
      nuevos("categorias_gasto", nombresDe("categoria_gasto")),
      nuevos("tipos_os", nombresDe("tipo_os")),
    ]);

    const filasDocs = sugerencias
      .filter((s) => s.tipo_sugerencia === "tipo_documento" && docsNuevos.has(s.valor))
      .map((s) => ({
        empresa_id: empresaId,
        nombre: s.valor,
        aplica_a: s.aplica_a && APLICA_VALIDO.has(s.aplica_a) ? s.aplica_a : "ambos",
        activo: true,
      }));
    const filasCats = [...catsNuevas].map((nombre) => ({ empresa_id: empresaId, nombre }));
    const filasOs = [...osNuevos].map((nombre) => ({ empresa_id: empresaId, nombre }));

    const resultados = await Promise.all([
      filasDocs.length ? supabase.from("tipos_documento").insert(filasDocs) : Promise.resolve({ error: null }),
      filasCats.length ? supabase.from("categorias_gasto").insert(filasCats) : Promise.resolve({ error: null }),
      filasOs.length ? supabase.from("tipos_os").insert(filasOs) : Promise.resolve({ error: null }),
    ]);
    for (const r of resultados) {
      if (r.error) console.error("Error sembrando sugerencias de rubro:", r.error);
    }
  } catch (err) {
    console.error("Error en sembrarSugerenciasRubro():", err);
  }
}
