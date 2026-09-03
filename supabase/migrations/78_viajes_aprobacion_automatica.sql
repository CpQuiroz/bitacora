-- ============================================================
-- Aprobación automática de viajes registrados desde la app.
-- Por defecto FALSE: el viaje del chofer entra como 'borrador' y
-- el admin lo aprueba (comportamiento actual). En TRUE, entra
-- directo como 'confirmado'.
-- ============================================================

alter table empresas
  add column if not exists viajes_aprobacion_automatica boolean not null default false;
