-- BITÁCORA — Módulo Levantamientos.
--
-- Flujo: el Admin crea una Orden de Levantamiento para que un técnico
-- visite a un cliente, evalúe qué se necesita y qué materiales usar, y
-- suba fotos. El Admin revisa el levantamiento y cotiza FUERA de
-- Bitácora (ERP externo, ej. Defontana — no se construye ni integra esa
-- cotización acá). Cuando el cliente aprueba, el Admin lo marca y nace
-- automáticamente una Orden de Servicio que hereda los materiales que
-- indicó el técnico. El stock de inventario se descuenta recién en ESE
-- momento — pero no hace falta ningún gancho nuevo para eso: la OS nace
-- igual que cualquier OS manual (misma tabla os_items) y el descuento ya
-- existente (aplicarDescuentoInventarioSiCorresponde, backend/src/
-- inventario.ts) se dispara solo, por transición de estado_os, exactamente
-- como para cualquier otra OS.
--
-- Módulo opt-in por empresa (empresa_modulos, ver packages/shared/src/
-- permisos.ts — MODULOS_OPCIONALES), apagado por defecto.
--
-- Auditoría previa (Paso 0, sin código): confirmado con la usuaria que
-- solo Admin crea/aprueba (no Supervisor); cotizar/aprobar es solo web
-- (el técnico en terreno no ve ni necesita esos estados); no existe hoy
-- ninguna matriz de perfiles mobile — usuarios.funcion (tecnico/chofer/
-- instalador/administrativo/otro) hoy es solo texto informativo, se
-- repurpose acá como el eje real de visibilidad de esta sección
-- (packages/shared: FUNCIONES_LEVANTAMIENTOS, array extensible).

-- ------------------------------------------------------------
-- 1. levantamientos
-- ------------------------------------------------------------
create table levantamientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete restrict,
  -- Nullable: el Admin normalmente asigna técnico al crear (pasa
  -- directo a 'asignado'), pero se deja abierta la puerta a crear sin
  -- asignar todavía (queda en 'creado').
  tecnico_id uuid references usuarios(id) on delete set null,
  -- Nullable + set null (no "not null"): mismo criterio que el resto
  -- del proyecto para "quién lo hizo" — borrar un usuario no debe
  -- bloquear ni arrastrar el historial de levantamientos.
  creado_por uuid references usuarios(id) on delete set null,
  estado text not null default 'creado' check (
    estado in ('creado', 'asignado', 'en_terreno', 'completado_tecnico', 'cotizado_externo', 'aprobado', 'rechazado')
  ),
  -- Lo que el Admin anota al crear: qué necesita evaluar el técnico.
  descripcion_requerimiento text,
  -- Lo que el técnico observa en terreno — se completa junto con los
  -- materiales y las fotos.
  descripcion_tecnico text,
  -- Folio/número del ERP externo (Defontana u otro) donde se cotizó.
  -- Texto libre a propósito: no hay integración, es solo referencia
  -- para que el Admin ubique la cotización externa.
  referencia_externa text,
  -- Se llena recién al aprobar. on delete set null: si la OS resultante
  -- se elimina (caso raro, condicional por FK como el resto del
  -- proyecto), el levantamiento no debe desaparecer, solo perder el link.
  orden_servicio_id uuid references ordenes_servicio(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
alter table levantamientos enable row level security;
create policy "acceso por empresa" on levantamientos
  for all using (empresa_id = empresa_actual());
create index on levantamientos (empresa_id, estado);
create index on levantamientos (empresa_id, tecnico_id);
create index on levantamientos (empresa_id, cliente_id);
create index on levantamientos (orden_servicio_id);

-- ------------------------------------------------------------
-- 2. levantamiento_materiales
--    Lo que el técnico indica en terreno — NO afecta stock acá. Se
--    copia a os_items recién cuando el Admin aprueba y nace la OS.
-- ------------------------------------------------------------
create table levantamiento_materiales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  levantamiento_id uuid not null references levantamientos(id) on delete cascade,
  -- Siempre del Catálogo (nunca texto libre) — mismo selector que ya
  -- usan Cotizaciones y Órdenes de servicio (CatalogoSelectorModal).
  -- on delete restrict: mismo criterio que el resto del proyecto
  -- (catalogo_items se desactiva, no se borra, si está referenciado).
  catalogo_item_id uuid not null references catalogo_items(id) on delete restrict,
  cantidad numeric(10,2) not null check (cantidad > 0),
  creado_en timestamptz not null default now()
);
alter table levantamiento_materiales enable row level security;
create policy "acceso por empresa" on levantamiento_materiales
  for all using (empresa_id = empresa_actual());
create index on levantamiento_materiales (levantamiento_id);
create index on levantamiento_materiales (catalogo_item_id);

-- ------------------------------------------------------------
-- 3. levantamiento_fotos
--    Molde: registro_mantencion_fotos (migración 96) — varias fotos
--    por levantamiento, subidas por la cola offline de mobile.
-- ------------------------------------------------------------
create table levantamiento_fotos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  levantamiento_id uuid not null references levantamientos(id) on delete cascade,
  foto_url text not null,
  subida_por uuid references usuarios(id) on delete set null,
  creado_en timestamptz not null default now()
);
alter table levantamiento_fotos enable row level security;
create policy "acceso por empresa" on levantamiento_fotos
  for all using (empresa_id = empresa_actual());
create index on levantamiento_fotos (levantamiento_id);

-- ------------------------------------------------------------
-- 4. Sembrar "levantamientos" en el rol admin ya existente.
--    El seed de `roles` (backend/src/roles.ts, asegurarSeed()) SOLO
--    corre si la tabla está vacía — en una base ya sembrada, sumar un
--    módulo nuevo a MODULOS (packages/shared/src/permisos.ts) no lo
--    agrega solo a las filas existentes. Gotcha ya documentado en
--    CONTEXTO_PROYECTO.md §7. Idempotente (solo si no está ya).
--    Los demás roles de sistema no lo llevan por defecto (decisión:
--    solo Admin crea/aprueba levantamientos).
-- ------------------------------------------------------------
update roles
set modulos = array_append(modulos, 'levantamientos')
where slug = 'admin' and not ('levantamientos' = any(modulos));
