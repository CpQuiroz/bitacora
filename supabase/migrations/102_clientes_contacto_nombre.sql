-- ============================================================
-- BITÁCORA — Persona de contacto en Clientes
--
-- `clientes.nombre` sigue siendo el nombre que se muestra en todos
-- lados (persona o empresa, sin cambio de significado) — no se toca
-- ni se migran datos. Se agrega un solo campo nuevo, opcional:
-- `contacto_nombre` ("persona de contacto o responsable"), pensado
-- para cuando el cliente es una empresa. Nullable, sin default,
-- reversible con un simple `drop column` si hace falta.
--
-- Aditiva pura: no afecta el matching de facturas por nombre exacto
-- ni a trabajos_del_dia() (migración 74) — ninguno de los dos lee ni
-- necesita esta columna.
-- ============================================================

alter table public.clientes add column if not exists contacto_nombre text;
