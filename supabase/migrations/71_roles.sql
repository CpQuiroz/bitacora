-- BITÁCORA — Roles editables desde el Panel de Super-Admin.
--
-- Hasta ahora los roles (admin/supervisor/contador/colaborador) y su
-- matriz rol→módulos vivían hardcodeados en @bitacora/shared. Ahora son
-- filas: el Super-Admin edita qué módulos y qué "acciones" (capacidades
-- sensibles delegables) tiene cada rol, crea roles nuevos, y puede
-- restringir un rol a empresas puntuales.
--
-- Los 4 roles de sistema se siembran desde el backend en el primer
-- arranque (asegurarRolesSeed en backend/src/roles.ts) usando las
-- constantes de @bitacora/shared como fuente de verdad — así no se
-- duplica el listado de módulos acá.
--
-- `usuarios.rol` sigue siendo texto libre (nunca tuvo CHECK); un rol
-- borrado deja a sus usuarios apuntando a un slug inexistente → el
-- backend los trata como sin acceso (se ve en el Panel).
create table roles (
  slug         text primary key,               -- 'admin', ..., o custom 'jefe_taller'
  nombre       text not null,
  modulos      text[] not null default '{}',
  acciones     text[] not null default '{}',   -- capacidades delegables (facturar, gestionar_plan, ...)
  requiere_2fa boolean not null default false,
  es_sistema   boolean not null default false, -- built-in: no se borra, el slug no se renombra
  orden        int not null default 100,
  creado_en    timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Rol restringido a empresas puntuales. Sin filas para un slug =
-- disponible para TODAS las empresas.
create table rol_empresas (
  rol_slug   text not null references roles(slug) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  primary key (rol_slug, empresa_id)
);

-- Sin RLS: solo las toca el backend (service role) y el Panel de
-- Super-Admin — igual criterio que empresa_modulos / empresa_feature_flags.
