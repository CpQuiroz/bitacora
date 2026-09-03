// ============================================================
// BITÁCORA — Middleware de idempotencia (AUDITORIA_RESILIENCIA.md R3).
//
// Para operaciones que crean plata (crear cobro). El cliente manda
// `Idempotency-Key: <uuid>`; si la misma clave llega dos veces, la
// segunda devuelve la MISMA respuesta que la primera en vez de crear
// otro registro. Se reintenta si el primer intento NO se aplicó
// (5xx o corte de red antes de responder) — nunca se duplica.
//
// Sin el header, el middleware no hace nada (comportamiento normal).
// Si la tabla `idempotencia` falla por cualquier motivo → fail-open
// (deja pasar la request): no queremos que un problema de la tabla
// bloquee crear cobros.
// ============================================================
import { supabase } from "./supabase";
import type { RequestConEmpresa } from "./empresa";
import { ah } from "./asyncHandler";

const CLAVE_RE = /^[A-Za-z0-9_-]{8,128}$/;

export function idempotente() {
  return ah<RequestConEmpresa>(async (req, res, next) => {
    const raw = req.header("Idempotency-Key");
    if (!raw) return next();
    if (!CLAVE_RE.test(raw)) {
      res.status(400).json({ error: "Idempotency-Key inválida" });
      return;
    }
    const clave = `${req.empresaId ?? "sin-empresa"}:${raw}`;

    // 1. Reclamar la clave: insert con status_code null ("en curso").
    const { error: errClaim } = await supabase
      .from("idempotencia")
      .insert({ clave, empresa_id: req.empresaId ?? null, metodo: req.method, ruta: req.path });

    if (errClaim) {
      // 23505 = la clave ya existe → esto es un reintento.
      if ((errClaim as { code?: string }).code === "23505") {
        // El primer intento puede estar recién terminando (la escritura
        // de la respuesta es asíncrona) — poll corto antes de rendirse.
        for (let i = 0; i < 8; i++) {
          const { data: prev } = await supabase.from("idempotencia").select("status_code, respuesta").eq("clave", clave).maybeSingle();
          if (prev?.status_code != null) {
            res.status(prev.status_code).json(prev.respuesta ?? {});
            return;
          }
          await new Promise((r) => setTimeout(r, 300));
        }
        // Sigue "en curso" tras ~2,4s → otra request idéntica está
        // procesándose de verdad, o quedó trabada. No procesar en paralelo.
        res.status(409).json({ error: "Esta operación ya se está procesando. Espera unos segundos y reintenta." });
        return;
      }
      // Otro error de la tabla → fail-open.
      console.error("idempotencia: no se pudo reclamar la clave, se sigue sin protección:", errClaim.message);
      return next();
    }

    // 2. Somos dueños de la clave. Capturar la respuesta para guardarla.
    // OJO: el query builder de supabase-js es lazy — ejecuta recién con
    // .then()/await. Por eso NO se usa `void supabase...` acá.
    const liberar = () =>
      supabase
        .from("idempotencia")
        .delete()
        .eq("clave", clave)
        .then(({ error }) => error && console.error("idempotencia: no se pudo liberar la clave:", error.message));

    const jsonOriginal = res.json.bind(res);
    let capturado = false;
    res.json = (body: unknown) => {
      capturado = true;
      const code = res.statusCode;
      if (code < 500) {
        // Respuesta final (éxito o error de validación): guardarla.
        supabase
          .from("idempotencia")
          .update({ status_code: code, respuesta: body as never })
          .eq("clave", clave)
          .then(({ error }) => error && console.error("idempotencia: no se pudo guardar la respuesta:", error.message));
      } else {
        // 5xx: el intento NO se aplicó de forma confiable → liberar la
        // clave para que un reintento pueda volver a intentar.
        void liberar();
      }
      return jsonOriginal(body);
    };
    // Si la request termina sin pasar por res.json (raro) y la clave
    // quedó "en curso", liberarla para no dejarla trabada.
    res.on("finish", () => {
      if (!capturado) void liberar();
    });

    // Limpieza perezosa (sin cron): de vez en cuando borra las viejas.
    if (Math.random() < 0.02) {
      supabase
        .from("idempotencia")
        .delete()
        .lt("creado_en", new Date(Date.now() - 7 * 24 * 3600_000).toISOString())
        .then(({ error }) => error && console.error("idempotencia: limpieza falló:", error.message));
    }

    next();
  });
}
