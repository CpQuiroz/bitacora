-- ============================================================
-- BITÁCORA — Divide el módulo "financiero" (bundleaba Cotizaciones +
-- Cobros + Gastos/Rendiciones, todo o nada) en 3 activables por
-- separado. "financiero" NO se renombra — pasa a significar solo
-- Gastos/Rendiciones; "cobros" y "cotizaciones" nacen nuevos (ver
-- packages/shared/src/permisos.ts).
--
-- empresa_modulos NO necesita backfill: sin fila para un módulo nuevo,
-- backend/src/permisos.ts (empresaTieneModulo) cae a
-- moduloActivadoPorDefecto(), y "cobros"/"cotizaciones" quedan fuera
-- de MODULOS_OPCIONALES → activados por defecto para toda empresa,
-- igual que "financiero" siempre lo estuvo.
--
-- roles SÍ necesita backfill: `roles.modulos` es un snapshot (text[])
-- guardado en la fila de cada rol (migración 71), no se recalcula
-- solo — admin no pasa por esta tabla (roles.ts: esAdmin siempre
-- true), pero cualquier otro rol (de sistema o creado a mano por una
-- empresa desde el Panel de Super-Admin / Configuración > Perfiles)
-- que ya tenía "financiero" pierde silenciosamente Cobros y
-- Cotizaciones si no se le suman acá. Idempotente (distinct + solo
-- toca filas a las que realmente les falta alguno de los dos).
update roles
set modulos = (
  select array_agg(distinct x order by x)
  from unnest(modulos || array['cobros', 'cotizaciones']) as x
)
where 'financiero' = any(modulos)
  and not ('cobros' = any(modulos) and 'cotizaciones' = any(modulos));
