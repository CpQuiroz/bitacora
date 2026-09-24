-- ============================================================
-- BITÁCORA — Supervisor y Contador con el mismo perfil (tarea 138,
-- 24-sep-2026, decisión de la usuaria: "para mí sería el mismo perfil;
-- si algún día alguien lo pide distinto lo programamos").
--
-- roles.modulos / roles.acciones son snapshots por fila (migración 71):
-- se deja a los dos roles de sistema con la UNIÓN de lo que hoy tiene
-- cada uno en la tabla, así se conserva cualquier ajuste hecho desde el
-- Panel de Super-Admin. requiere_2fa NO cambia: el Supervisor lo sigue
-- exigiendo y el Contador lo tiene opcional (decisión de la usuaria).
--
-- No toca empresa_rol_modulos: si una empresa apagó un módulo para uno
-- de estos roles, sigue apagado. El gating por plan tampoco cambia.
-- Idempotente: correrla dos veces deja lo mismo.
-- ============================================================

with union_perfil as (
  select
    array(select distinct m from roles r, unnest(r.modulos) m where r.slug in ('supervisor', 'contador') order by m) as modulos,
    array(select distinct a from roles r, unnest(r.acciones) a where r.slug in ('supervisor', 'contador') order by a) as acciones
)
update roles
set modulos = union_perfil.modulos,
    acciones = union_perfil.acciones,
    actualizado_en = now()
from union_perfil
where roles.slug in ('supervisor', 'contador');
