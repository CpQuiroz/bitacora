-- BITÁCORA — Financiero: Cotizaciones.
-- Evoluciona la tabla "presupuestos" ya existente (usada también por
-- el dashboard y el informe IA, que se dejan intactos) agregándole
-- número correlativo, desglose de IVA y fecha de vencimiento; y suma
-- una tabla de ítems de línea que se completan desde el Catálogo.

alter table empresas add column siguiente_numero_cotizacion int not null default 1;

create or replace function siguiente_numero_cotizacion(p_empresa_id uuid)
returns int as $$
declare
  v_numero int;
begin
  update empresas
  set siguiente_numero_cotizacion = siguiente_numero_cotizacion + 1
  where id = p_empresa_id
  returning siguiente_numero_cotizacion - 1 into v_numero;

  return v_numero;
end;
$$ language plpgsql;

alter table presupuestos add column numero int;
alter table presupuestos add column subtotal numeric(12,2);
alter table presupuestos add column iva numeric(12,2);
alter table presupuestos add column fecha_vencimiento date;

-- "Borrador" se suma como estado inicial de una cotización antes de
-- enviarla; "vencida" NO se guarda como estado — se calcula al vuelo
-- (enviado + fecha_vencimiento < hoy), mismo patrón ya usado en
-- gastos.estado "vencido", para no depender de un cron.
alter table presupuestos drop constraint presupuestos_estado_check;
alter table presupuestos add constraint presupuestos_estado_check
  check (estado in ('borrador', 'enviado', 'aprobado', 'rechazado', 'expirado'));

create table presupuesto_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  presupuesto_id uuid not null references presupuestos(id) on delete cascade,
  catalogo_item_id uuid references catalogo_items(id) on delete set null,
  descripcion text not null,
  cantidad numeric(10,2) not null default 1,
  precio_unitario numeric(12,2) not null default 0,
  creado_en timestamptz not null default now()
);
alter table presupuesto_items enable row level security;
create policy "acceso por empresa" on presupuesto_items
  for all using (empresa_id = empresa_actual());
create index presupuesto_items_presupuesto_idx on presupuesto_items(presupuesto_id);
