// Diagnóstico puntual (14-sep-2026) para la tarea 20/29 — foto atorada en
// la cola, "Reintentar ahora" sin ningún efecto, sin excepción visible
// (ver ultimoErrorGlobal en services/sync/queue.ts, que tampoco mostró
// nada). Sin acceso a logs nativos del teléfono, esta es la forma de
// aislar la variable: comparar un archivo CHICO de prueba (bytes
// triviales, mismo mecanismo multipart, mismo endpoint) contra la foto
// REAL que está atorada. Si el chico también cuelga, el problema es el
// mecanismo multipart en sí (RN/Android) — no la foto puntual. Si el
// chico anda bien y el real cuelga, el problema es específico del
// archivo real (tamaño, o cómo lo produce expo-image-manipulator +
// persistirFoto).
import { File, Paths } from "expo-file-system";
import { apiFetch } from "../services/api";

const TIMEOUT_PRUEBA_MS = 20000; // más corto que TIMEOUT_MULTIPART_MS (90s) — es solo diagnóstico.

type ResultadoPrueba = { nombre: string; ok: boolean; ms: number; detalle: string };

async function medir(nombre: string, fn: () => Promise<Response>): Promise<ResultadoPrueba> {
  const t0 = Date.now();
  try {
    const res = await fn();
    return { nombre, ok: res.ok, ms: Date.now() - t0, detalle: `HTTP ${res.status}` };
  } catch (e) {
    return { nombre, ok: false, ms: Date.now() - t0, detalle: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

/**
 * `path` y `campo`: los de la acción atorada (ej. "/api/mis-viajes/ID/foto-guia", "foto").
 * `fotoUriReal`: la uri del archivo real que está atorado en la cola, si hay una.
 */
export async function diagnosticarSubida(path: string, campo: string, fotoUriReal: string | undefined): Promise<ResultadoPrueba[]> {
  const resultados: ResultadoPrueba[] = [];

  const archivoChico = new File(Paths.cache, `diagnostico-bitacora-${Date.now()}.jpg`);
  try {
    archivoChico.create({ overwrite: true });
    archivoChico.write("prueba-diagnostico-bitacora");
    resultados.push(
      await medir("Archivo chico (mismo endpoint)", () => {
        const fd = new FormData();
        fd.append(campo, new File(archivoChico.uri));
        return apiFetch(path, { method: "POST", body: fd }, TIMEOUT_PRUEBA_MS);
      })
    );
  } finally {
    try {
      if (archivoChico.exists) archivoChico.delete();
    } catch {
      /* best-effort */
    }
  }

  if (fotoUriReal) {
    resultados.push(
      await medir("Foto real atorada", () => {
        const fd = new FormData();
        fd.append(campo, new File(fotoUriReal));
        return apiFetch(path, { method: "POST", body: fd }, TIMEOUT_PRUEBA_MS);
      })
    );
  }

  return resultados;
}

export function resumenDiagnostico(resultados: ResultadoPrueba[]): string {
  return resultados.map((r) => `${r.nombre}: ${r.ok ? "OK" : "FALLÓ"} en ${r.ms} ms — ${r.detalle}`).join("\n\n");
}
