-- Módulos/funcionalidades contratadas por empresa — eje distinto del
-- rol (PERMISOS_POR_ROL sigue decidiendo qué ve cada persona DENTRO
-- de una empresa; esto decide qué está contratado por esa empresa en
-- primer lugar). Sin fila = comportamiento por defecto: los módulos
-- base quedan activados (no rompe a nadie hoy), los nuevos opt-in
-- (ej. "agenda_pro") quedan desactivados — el default vive en código
-- (backend/src/permisos.ts), no acá.
create table empresa_modulos (
  empresa_id uuid not null references empresas(id) on delete cascade,
  modulo text not null,
  activado boolean not null default true,
  actualizado_en timestamptz not null default now(),
  primary key (empresa_id, modulo)
);
