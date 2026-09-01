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

export async function sembrarSugerenciasRubro(empresaId: string, rubro: Rubro): Promise<void> {
  try {
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
