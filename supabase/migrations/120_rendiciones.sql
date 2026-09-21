-- ============================================================
-- Rendiciones (fondo por rendir / caja chica) — pedido 21-sep-2026:
-- seguimiento de plata entregada en efectivo a un colaborador (chofer/
-- técnico) para gastos de terreno, contra la que se reconcilian sus
-- gastos reales al terminar el período. Mismo mecanismo de folio,
-- multi-tenant y RLS ya usado en OS/Cita/Viaje/Levantamiento/Cliente/
-- Pack/Gasto/Proveedor/Cobro — nada nuevo a nivel de patrón.
--
-- categorias_gasto/centros_costo/proveedores NO se tocan — un gasto de
-- rendición sigue siendo un gasto normal (misma tabla, mismo endpoint),
-- solo gana un `rendicion_id` que lo agrupa.
-- ============================================================

alter table empresas add column siguiente_folio_rendicion int not null default 1;

create or replace function siguiente_folio_rendicion(p_empresa_id uuid)
returns int as $$
declare
  v_folio int;
begin
  update empresas
  set siguiente_folio_rendicion = siguiente_folio_rendicion + 1
  where id = p_empresa_id
  returning siguiente_folio_rendicion - 1 into v_folio;

  return v_folio;
end;
$$ language plpgsql;

create table rendiciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  folio int,
  colaborador_id uuid not null references usuarios(id) on delete restrict,
  periodo text not null check (periodo in ('diario', 'semanal')),
  fecha_inicio date not null,
  fecha_termino date not null,
  monto_entregado numeric(12,2) not null,
  -- borrador: el colaborador todavía puede agregar/quitar gastos.
  -- enviada: bloqueada para el colaborador, esperando revisión.
  -- aprobada/rechazada: terminal — rechazada vuelve a 'borrador' para
  -- que el colaborador corrija (no es un 5º estado, ver backend).
  estado text not null default 'borrador' check (estado in ('borrador', 'enviada', 'aprobada', 'rechazada')),
  aprobado_por uuid references usuarios(id) on delete set null,
  fecha_aprobacion timestamptz,
  motivo_rechazo text,
  -- Informativo, no dispara ninguna pasarela de pago real (mismo
  -- criterio que Cobros) — el saldo (monto_entregado - total gastado)
  -- se calcula en el backend, nunca se guarda en una columna.
  saldo_liquidado boolean not null default false,
  fecha_liquidacion date,
  creado_en timestamptz not null default now()
);

alter table rendiciones enable row level security;
create policy "acceso por empresa" on rendiciones
  for all using (empresa_id = empresa_actual());

create index idx_rendiciones_empresa on rendiciones(empresa_id);
create index idx_rendiciones_colaborador on rendiciones(empresa_id, colaborador_id);

-- Un gasto puede pertenecer a una rendición Y a una OS/viaje al mismo
-- tiempo (ej. el técnico compró bencina para una OS puntual, y ese
-- gasto también es parte de su rendición semanal) — sin restricción
-- entre ambos campos, a propósito.
alter table gastos add column rendicion_id uuid references rendiciones(id) on delete set null;
alter table gastos add column viaje_id uuid references viajes(id) on delete set null;

create index idx_gastos_rendicion on gastos(rendicion_id);
create index idx_gastos_viaje on gastos(viaje_id);
