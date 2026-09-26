// Clasificación de errores del manejador global (server.ts). Un error sin
// `.status` es un bug → 500 y se reporta (Sentry + errores_backend). Uno
// que trae su propio `.status` fue lanzado a propósito (freno de negocio,
// backpressure) → no se reporta aunque sea 5xx.
export function clasificarError(err: unknown): { status: number; mensaje: string; reportar: boolean; esperado: boolean } {
  const mensaje = err instanceof Error ? err.message : "Error interno";
  const posibleStatus = err instanceof Error ? (err as unknown as { status?: unknown }).status : undefined;
  const esperado = typeof posibleStatus === "number";
  const status = esperado ? (posibleStatus as number) : 500;
  return { status, mensaje, reportar: status >= 500 && !esperado, esperado };
}
