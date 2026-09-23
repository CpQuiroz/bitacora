import { test, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";

// ============================================================
// Smoke test de arranque del backend (tarea #4).
//
// Arranca la app REAL (server.ts, con su app.listen real) — no mockea
// express ni las rutas. Lo único fabricado son los valores de las
// variables de entorno que env.ts exige con requerido() para poder
// cargar el módulo: son strings dummy, nunca credenciales reales, y
// ninguna de las 3 rutas que este smoke ejercita las usa de verdad
// (confirmado leyendo cada handler antes de escribir esto):
//   - GET /health                no toca Supabase/S3/Anthropic.
//   - GET /api/me sin token       requiereAuth corta antes de llamar a
//                                 supabase.auth.getUser (401 inmediato).
//   - GET /api/whatsapp/webhook   compara solo contra
//                                 WHATSAPP_VERIFY_TOKEN, sin DB.
// PORT=0 para que el SO asigne un puerto libre (evita choques si algo
// más ya está escuchando en el 8080 de dev/CI).
process.env.PORT ??= "0";
process.env.SUPABASE_URL ??= "https://smoke-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "smoke-test-service-role-key";
process.env.STORAGE_ENDPOINT ??= "https://smoke-test.supabase.co/storage/v1/s3";
process.env.STORAGE_ACCESS_KEY ??= "smoke-test-access-key";
process.env.STORAGE_SECRET_KEY ??= "smoke-test-secret-key";
process.env.STORAGE_BUCKET ??= "smoke-test-bucket";
process.env.ANTHROPIC_API_KEY ??= "smoke-test-anthropic-key";
process.env.INTEGRACIONES_ENCRYPTION_KEY ??= "smoke-test-integraciones-key";
process.env.PORTAL_TOKEN_SECRET ??= "smoke-test-portal-secret";
process.env.SUPERADMIN_TOKEN_SECRET ??= "smoke-test-superadmin-token-secret";
process.env.SUPERADMIN_ENCRYPTION_KEY ??= "smoke-test-superadmin-encryption-key";
process.env.USUARIOS_MFA_ENCRYPTION_KEY ??= "smoke-test-mfa-key";
process.env.WHATSAPP_VERIFY_TOKEN ??= "smoke-test-verify-token";

// tsx transpila este archivo a CJS (backend no es ESM) — no se puede usar
// top-level await. El import dinámico de server.ts (necesario para que
// las env vars de arriba ya existan cuando env.ts las lee) queda
// memoizado acá y cada test lo espera antes de pegarle al puerto real.
let arranque: Promise<{ baseUrl: string; httpServer: Server }> | null = null;

function arrancar(): Promise<{ baseUrl: string; httpServer: Server }> {
  if (!arranque) {
    arranque = (async () => {
      const { httpServer } = await import("./server");
      if (!httpServer.listening) {
        await new Promise<void>((resolve, reject) => {
          httpServer.once("listening", resolve);
          httpServer.once("error", reject);
        });
      }
      const direccion = httpServer.address();
      if (!direccion || typeof direccion === "string") {
        throw new Error("El server no quedó escuchando en un puerto TCP.");
      }
      return { baseUrl: `http://127.0.0.1:${direccion.port}`, httpServer };
    })();
  }
  return arranque;
}

after(async () => {
  const { httpServer } = await arrancar();
  httpServer.close();
});

test("GET /health — 200 sin tocar la base", async () => {
  const { baseUrl } = await arrancar();
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test("GET /api/me sin token — 401 (ruta protegida real)", async () => {
  const { baseUrl } = await arrancar();
  const res = await fetch(`${baseUrl}/api/me`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.match(body.error, /Authorization/);
});

test("GET /api/whatsapp/webhook — verificación feliz (sin DB)", async () => {
  const { baseUrl } = await arrancar();
  const url =
    `${baseUrl}/api/whatsapp/webhook` +
    `?hub.mode=subscribe&hub.verify_token=${process.env.WHATSAPP_VERIFY_TOKEN}&hub.challenge=bitacora-smoke-1234`;
  const res = await fetch(url);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "bitacora-smoke-1234");
});

test("GET /api/whatsapp/webhook — token equivocado, 403", async () => {
  const { baseUrl } = await arrancar();
  const res = await fetch(`${baseUrl}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=x`);
  assert.equal(res.status, 403);
});

// Bug real (23-sep-2026): "Marcar cotizado externamente" en
// Levantamientos siempre mostraba el mensaje genérico de servidor
// iniciando/desconectado — la causa raíz estaba en el retry del
// frontend (ver web/src/lib/api.ts), no en esta ruta, pero no había
// NINGÚN test que confirmara que /:id/cotizado sigue existiendo y
// exigiendo auth — si alguien la renombra o la borra por error a
// futuro, este test lo detecta al toque (401 real de requiereAuth,
// sin tocar Supabase, mismo criterio que /api/me arriba).
test("PATCH /api/levantamientos/:id/cotizado sin token — 401 (la ruta existe y exige auth)", async () => {
  const { baseUrl } = await arrancar();
  const res = await fetch(`${baseUrl}/api/levantamientos/00000000-0000-0000-0000-000000000000/cotizado`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ referencia_externa: "test" }),
  });
  assert.equal(res.status, 401);
});

// Fase 2 (23-sep-2026): Clientes ahora filtra por rol — sin token
// sigue siendo 401 antes de llegar a ese filtro (requiereAuth corta
// primero). El filtro en sí (visibilidad de Colaborador) necesita
// datos reales de empresa_id/responsable_id — se verificó a mano
// contra dev con un script de servicio, no acá (este archivo no toca
// Supabase de verdad, ver comentario de arriba).
test("GET /api/clientes sin token — 401", async () => {
  const { baseUrl } = await arrancar();
  const res = await fetch(`${baseUrl}/api/clientes`);
  assert.equal(res.status, 401);
});

// Fase 2.2: Asistente IA exclusivo de Admin — requiereRol("admin") va
// ANTES de requiereEmpresa en la cadena de middlewares reales, así que
// sin token esto sigue siendo 401 (requiereAuth), no 403 — confirma
// que la ruta no se rompió al agregar el nuevo requiereRol.
test("GET /api/asistente sin token — 401 (la ruta sigue montada tras agregar requiereRol)", async () => {
  const { baseUrl } = await arrancar();
  const res = await fetch(`${baseUrl}/api/asistente`);
  assert.equal(res.status, 401);
});
