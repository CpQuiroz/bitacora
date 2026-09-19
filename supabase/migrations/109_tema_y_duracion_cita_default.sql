-- ============================================================
-- BITÁCORA — empresas.tema (tema visual "Taller") +
-- empresas.duracion_cita_default_min (duración por defecto de cita).
--
-- 1) tema: hoy solo "faena" (el sistema de diseño actual) o "taller"
--    (alternativa, ver packages/design-tokens — tokens.colorTaller /
--    fontTaller, bloque CSS [data-tema="taller"]). Mismo patrón que
--    color_primario/color_secundario/fuente: personalización por
--    tenant, no un flag global. Default 'faena' = comportamiento
--    idéntico al de hoy para toda empresa existente.
--
-- 2) duracion_cita_default_min: hasta ahora el campo "Duración en
--    minutos" de una cita nueva se pedía a mano en el formulario
--    (mobile NuevaCitaScreen, web agenda/page.tsx con "60" fijo a
--    fuego). Pasa a ser una preferencia de empresa configurable en
--    Configuración > Empresa, que ambas plataformas leen en vez de
--    preguntar. Default 60 = mismo valor que hoy estaba hardcodeado.
-- ============================================================

alter table empresas
  add column tema text not null default 'faena'
    check (tema in ('faena', 'taller'));

alter table empresas
  add column duracion_cita_default_min int not null default 60
    check (duracion_cita_default_min > 0);
