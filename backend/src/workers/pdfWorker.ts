// ============================================================
// Entry point del worker_thread que genera PDFs — ver
// generarPdfEnWorker() en ../pdfWorkerPool.ts, único lugar que lo
// invoca. pdfkit dibuja de forma síncrona/CPU-bound; correrlo acá en
// vez del proceso principal evita que una generación pesada bloquee
// el event loop que atiende el resto del tráfico (checklist, login,
// etc.) mientras se genera.
// ============================================================
import { parentPort, workerData } from "worker_threads";
import { generarPdfOS } from "../generarPdfOS";
import { generarPdfCotizacion } from "../generarPdfCotizacion";
import { generarPdfInforme } from "../generarPdfInforme";

type TipoPdf = "os" | "cotizacion" | "informe";

async function main() {
  const { tipo, datos } = workerData as { tipo: TipoPdf; datos: unknown };
  let pdf: Buffer;
  if (tipo === "os") pdf = await generarPdfOS(datos as Parameters<typeof generarPdfOS>[0]);
  else if (tipo === "cotizacion") pdf = await generarPdfCotizacion(datos as Parameters<typeof generarPdfCotizacion>[0]);
  else pdf = await generarPdfInforme(datos as Parameters<typeof generarPdfInforme>[0]);
  parentPort!.postMessage({ ok: true, pdf });
}

main().catch((err) => {
  parentPort!.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
});
