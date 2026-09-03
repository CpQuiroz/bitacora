-- ============================================================
-- BITÁCORA — Módulo Remuneraciones: auditoría y controles (auditoría
-- de código sept-2026, docs/AUDITORIA_REMUNERACIONES.md).
--
-- 1. `parametros_previsionales` es una tabla GLOBAL (sin empresa_id).
--    Cualquier empresa con el módulo podía reescribir la UF/UTM/topes
--    de un período para todas. Se agrega rastro de quién y de qué
--    empresa fue el último cambio; el backend además restringe qué
--    campos puede tocar una empresa (solo uf/utm/tope_gratificacion,
--    lo verdaderamente por-período; los topes/tramos legales quedan
--    de solo lectura desde la app).
-- 2. `liquidaciones`: faltaba saber QUIÉN emitió y QUIÉN editó un
--    borrador (solo había `creado_por` y timestamps). Y no había forma
--    de marcar que un período tuvo licencia médica (cálculo fuera de
--    alcance) para frenar la emisión.
-- ============================================================

alter table parametros_previsionales
  add column actualizado_por_usuario uuid,   -- usuarios.id (sin FK: la tabla es global)
  add column actualizado_por_empresa uuid;   -- empresas.id — qué empresa hizo el último cambio manual

alter table liquidaciones
  add column emitida_por uuid references usuarios(id) on delete set null,
  add column editado_por uuid references usuarios(id) on delete set null,
  -- El período tuvo licencia médica: el cálculo no la modela (subsidio
  -- lo paga la entidad de salud, no es remuneración imponible normal).
  -- Con esto en true, el backend exige confirmación explícita para
  -- emitir ("revisé y ajusté a mano").
  add column tuvo_licencia boolean not null default false;
