import type { Request, Response, NextFunction } from "express";
import { supabase } from "./supabase";

// AUDITORIA_PERFORMANCE_COSTOS.md §8 — mide cada request y, solo si pasa
// el umbral, deja una fila en `requests_lentos` (ruta, ms, status,
// empresa, y el tamaño del array si la respuesta era un listado). En el
// caso feliz no toca la base.

const UMBRAL_MS = Number(process.env.LATENCIA_UMBRAL_MS ?? 2000);

export function medirLatencia(req: Request, res: Response, next: NextFunction): void {
  const inicio = Date.now();

  // Envolver res.json para poder contar las filas de un listado sin
  // pagar el costo si la request fue rápida (se decide en 'finish').
  let filas: number | null = null;
  const jsonOriginal = res.json.bind(res);
  res.json = (body: unknown) => {
    if (Array.isArray(body)) filas = body.length;
    return jsonOriginal(body);
  };

  res.on("finish", () => {
    const ms = Date.now() - inicio;
    if (ms < UMBRAL_MS) return;
    const empresaId = (req as Request & { empresaId?: string }).empresaId ?? null;
    supabase
      .from("requests_lentos")
      .insert({
        empresa_id: empresaId,
        // req.route?.path da el patrón ('/:id') en vez del valor concreto
        // — agrupa mejor. Fallback a req.path si no hay route.
        ruta: (req.baseUrl || "") + ((req.route as { path?: string } | undefined)?.path ?? req.path),
        metodo: req.method,
        ms,
        status_code: res.statusCode,
        filas_devueltas: filas,
      })
      .then(({ error }) => {
        if (error) console.error("medirLatencia:", error.message);
      });
  });

  next();
}
