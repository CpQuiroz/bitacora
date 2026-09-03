-- ============================================================
-- BITÁCORA — Perfiles por empresa: el Admin de cada empresa ajusta qué
-- módulos ve cada rol DENTRO de su empresa, sin tocar la plantilla
-- global del rol (tabla `roles`, que edita solo el Super-Admin).
--
-- Modelo: override por (empresa, rol, módulo). Si no hay fila, el rol
-- usa lo que dice `roles.modulos`. Una fila con activado=true suma un
-- módulo que la plantilla no tenía; activado=false lo quita.
--
-- El gating de plan (empresa_modulos) sigue aplicando después: activar
-- aquí un módulo que la empresa no tiene contratado no lo hace visible.
--
-- El rol `admin` no se togglea nunca (acceso total). Los módulos
-- `configuracion` y `gestion_control` tampoco se delegan desde acá
-- (evita que un colaborador se auto-promueva) — eso lo valida el
-- backend, no la tabla.
-- ============================================================
create table empresa_rol_modulos (
  empresa_id     uuid not null references empresas(id) on delete cascade,
  rol_slug       text not null references roles(slug) on delete cascade,
  modulo         text not null,
  activado       boolean not null,
  actualizado_en timestamptz not null default now(),
  primary key (empresa_id, rol_slug, modulo)
);

create index empresa_rol_modulos_empresa_idx on empresa_rol_modulos (empresa_id);

-- Solo la toca el backend (service role). Mismo criterio que
-- empresa_modulos / roles / rol_empresas (ver migración 73).
alter table empresa_rol_modulos enable row level security;
revoke all on empresa_rol_modulos from anon, authenticated;

-- Default: el rol `colaborador` pasa a ver la Agenda (su calendario y
-- tareas asignadas). Hasta ahora `colaborador` no veía ningún módulo en
-- la web. Se aplica a las empresas que YA existen sumándolo directo a la
-- plantilla del rol de sistema; las nuevas lo heredan del seed del
-- backend (PERMISOS_POR_ROL.colaborador).
update roles
set modulos = (select array(select distinct unnest(modulos || array['agenda'])) ),
    actualizado_en = now()
where slug = 'colaborador'
  and not (modulos @> array['agenda']);
