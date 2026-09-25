import { test } from "node:test";
import assert from "node:assert/strict";
import { esRuta, rutaPermitidaConPruebaVencida } from "./empresaOperativa";

test("con la prueba vencida quedan abiertos Plan/pago y Mi cuenta", () => {
  for (const url of [
    "/api/plan",
    "/api/plan/cambiar",
    "/api/suscripcion/tarjeta",
    "/api/modulos",
    "/api/usuarios/me",
    "/api/usuarios/me/",
    "/api/usuarios/me?x=1",
    "/api/usuarios/me/datos",
    "/api/usuarios/me/accesos",
    "/api/usuarios/me/foto",
    "/api/usuarios/me/mfa",
    "/api/usuarios/me/mfa/totp/iniciar",
    "/api/notificaciones-feed/preferencias/cobro",
  ]) {
    assert.equal(rutaPermitidaConPruebaVencida(url), true, url);
  }
});

test("todo lo demás queda bloqueado, incluidos los prefijos parecidos", () => {
  for (const url of [
    "/api/trabajos",
    "/api/trabajos?x=/api/plan",
    "/api/plantillas",
    "/api/planes-mantencion",
    "/api/usuarios",
    "/api/usuarios/meX",
    "/api/usuarios/me/vehiculo",
    "/api/usuarios/me/vehiculo/registros-mantencion",
    "/API/PLAN",
    "/api/empresa",
    "/api/notificaciones-feed",
    "/api/integraciones",
  ]) {
    assert.equal(rutaPermitidaConPruebaVencida(url), false, url);
  }
});

test("esRuta compara por segmento", () => {
  assert.equal(esRuta("/api/plan/cambiar", "/api/plan"), true);
  assert.equal(esRuta("/api/plantillas", "/api/plan"), false);
});
