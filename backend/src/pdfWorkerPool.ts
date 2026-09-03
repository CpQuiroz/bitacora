// ============================================================
// Único punto que arma un PDF fuera del proceso principal — ver
// workers/pdfWorker.ts. Un Worker por pedido (no hay volumen para
// justificar un pool persistente todavía); se referencia el archivo
// sin asumir extensión fija porque en dev corre bajo tsx (.ts, que
// tsx sabe cargar en un worker_thread sin config extra) y en
// producción corre compilado (.js, tsc -p → dist/).
//
// Concurrencia acotada (AUDITORIA_PERFORMANCE_COSTOS.md #4): cada Worker
// pesa ~10-30 MB. En Render (512 MB) un pico de PDFs concurrentes puede
// hacer OOM. Se limita a 3 simultáneos; el resto espera en cola.
// ============================================================
import { Worker } from "worker_threads";
import path from "path";
import { crearLimitadorConcurrencia } from "./concurrencia";

const CORRIENDO_EN_TS = __filename.endsWith(".ts");
const EXTENSION = CORRIENDO_EN_TS ? ".ts" : ".js";
const WORKER_PATH = path.join(__dirname, "workers", `pdfWorker${EXTENSION}`);
// En dev (tsx watch), un worker_thread nuevo no hereda el loader de
// tsx del proceso principal — hay que registrarlo explícito en el
// propio worker. En producción (node dist/server.js, ya compilado a
// .js) no hace falta nada de esto.
const EXECARGV_DEV = CORRIENDO_EN_TS ? ["--require", require.resolve("tsx/cjs")] : [];

type TipoPdf = "os" | "cotizacion" | "informe";

const MAX_PDF_SIMULTANEOS = Number(process.env.MAX_PDF_SIMULTANEOS ?? 3);
const limitarPdf = crearLimitadorConcurrencia(MAX_PDF_SIMULTANEOS);

function generarUno<T>(tipo: TipoPdf, datos: T): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH, { workerData: { tipo, datos }, execArgv: EXECARGV_DEV });
    worker.once("message", (msg: { ok: true; pdf: Buffer } | { ok: false; error: string }) => {
      worker.terminate();
      if (msg.ok) resolve(Buffer.from(msg.pdf));
      else reject(new Error(msg.error));
    });
    worker.once("error", (err) => {
      worker.terminate();
      reject(err);
    });
  });
}

export function generarPdfEnWorker<T>(tipo: TipoPdf, datos: T): Promise<Buffer> {
  return limitarPdf(() => generarUno(tipo, datos));
}
