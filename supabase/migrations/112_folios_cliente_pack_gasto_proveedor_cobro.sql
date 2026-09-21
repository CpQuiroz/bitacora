-- ============================================================
-- BITÁCORA — Folios propios para Cliente/Pack de sesiones/Gasto/
-- Proveedor/Cobro.
--
-- Pedido (20-sep-2026): mismo mecanismo ya usado para OS
-- (siguiente_folio_os, migración 08) y para Cita/Viaje/Levantamiento
-- (migración 108) — un contador por empresa + una función atómica que
-- entrega el siguiente número sin choques aunque dos personas guarden
-- al mismo tiempo. El prefijo (CLI-/PACK-/GTO-/PROV-/COB-) se agrega
-- solo al mostrarlo (formatearFolio, packages/shared) — acá se guarda
-- el número plano.
--
-- "Cobro" usa el prefijo COB- (no FAC-) a propósito: esto es un
-- registro interno de Bitácora (tabla `facturas`), no una factura
-- tributaria real con folio SII/CAF — el prefijo evita esa confusión.
--
-- "Persona" (usuarios) queda deliberadamente AFUERA — ya tiene RUT
-- como identificador único real (migración 70, Previred); un folio
-- correlativo encima sería redundante (decisión de la usuaria).
--
-- Filas ya existentes quedan con folio null (mismo criterio que las
-- migraciones anteriores) — no se backfillea histórico.
-- ============================================================

alter table empresas add column siguiente_folio_cliente int not null default 1;
alter table empresas add column siguiente_folio_pack int not null default 1;
alter table empresas add column siguiente_folio_gasto int not null default 1;
alter table empresas add column siguiente_folio_proveedor int not null default 1;
alter table empresas add column siguiente_folio_cobro int not null default 1;

create or replace function siguiente_folio_cliente(p_empresa_id uuid)
returns int as $$
declare
  v_folio int;
begin
  update empresas
  set siguiente_folio_cliente = siguiente_folio_cliente + 1
  where id = p_empresa_id
  returning siguiente_folio_cliente - 1 into v_folio;

  return v_folio;
end;
$$ language plpgsql;

create or replace function siguiente_folio_pack(p_empresa_id uuid)
returns int as $$
declare
  v_folio int;
begin
  update empresas
  set siguiente_folio_pack = siguiente_folio_pack + 1
  where id = p_empresa_id
  returning siguiente_folio_pack - 1 into v_folio;

  return v_folio;
end;
$$ language plpgsql;

create or replace function siguiente_folio_gasto(p_empresa_id uuid)
returns int as $$
declare
  v_folio int;
begin
  update empresas
  set siguiente_folio_gasto = siguiente_folio_gasto + 1
  where id = p_empresa_id
  returning siguiente_folio_gasto - 1 into v_folio;

  return v_folio;
end;
$$ language plpgsql;

create or replace function siguiente_folio_proveedor(p_empresa_id uuid)
returns int as $$
declare
  v_folio int;
begin
  update empresas
  set siguiente_folio_proveedor = siguiente_folio_proveedor + 1
  where id = p_empresa_id
  returning siguiente_folio_proveedor - 1 into v_folio;

  return v_folio;
end;
$$ language plpgsql;

create or replace function siguiente_folio_cobro(p_empresa_id uuid)
returns int as $$
declare
  v_folio int;
begin
  update empresas
  set siguiente_folio_cobro = siguiente_folio_cobro + 1
  where id = p_empresa_id
  returning siguiente_folio_cobro - 1 into v_folio;

  return v_folio;
end;
$$ language plpgsql;

alter table clientes add column folio int;
alter table paquetes_sesiones add column folio int;
alter table gastos add column folio int;
alter table proveedores add column folio int;
alter table facturas add column folio int;
