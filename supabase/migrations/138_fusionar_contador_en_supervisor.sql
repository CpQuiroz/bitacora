-- ============================================================
-- BITÁCORA — Contador se fusiona en Supervisor (tarea 138, 24-sep-2026).
-- Decisión de la usuaria: "dejar solo uno y que ese uno contenga al
-- otro". Queda Supervisor, con 2FA OPCIONAL (también decisión suya).
--
-- 1. Supervisor queda con la UNIÓN de módulos y acciones que hoy tienen
--    los dos roles en la tabla (conserva los ajustes hechos desde el
--    Panel de Super-Admin).
-- 2. Los usuarios Contador pasan a Supervisor: no pierden acceso a nada.
-- 3. Accesos autorizados por correo/dominio con rol Contador → Supervisor.
-- 4. Se borra el rol Contador. empresa_rol_modulos y rol_empresas del
--    Contador se van por ON DELETE CASCADE (los del Supervisor se
--    mantienen).
-- Todo en una transacción; idempotente (correrla de nuevo no cambia nada).
-- ============================================================
begin;

with union_perfil as (
  select
    array(select distinct m from roles r, unnest(r.modulos) m where r.slug in ('supervisor', 'contador') order by m) as modulos,
    array(select distinct a from roles r, unnest(r.acciones) a where r.slug in ('supervisor', 'contador') order by a) as acciones
)
update roles
set modulos = union_perfil.modulos,
    acciones = union_perfil.acciones,
    requiere_2fa = false,
    actualizado_en = now()
from union_perfil
where roles.slug = 'supervisor';

update usuarios set rol = 'supervisor' where rol = 'contador';

update empresa_accesos_autorizados set rol = 'supervisor' where rol = 'contador';

delete from roles where slug = 'contador';

commit;
