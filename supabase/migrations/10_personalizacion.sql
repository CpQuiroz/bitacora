-- ============================================================
-- BITÁCORA — Personalización de marca: color secundario y
-- tipografía (color primario y moneda ya existían desde 09).
-- Se ejecuta después de 09_dashboard_branding_ia.sql
-- ============================================================
alter table empresas add column color_secundario text;
alter table empresas add column fuente text;
