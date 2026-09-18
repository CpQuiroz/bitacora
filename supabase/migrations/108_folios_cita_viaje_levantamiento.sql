-- ============================================================
-- BITÁCORA — Folios propios para Cita/Viaje/Levantamiento.
--
-- Pedido: distinguir de un vistazo el tipo de cada ítem en la Pizarra
-- (Hoy) y darle a cada uno un identificador propio y citable
-- (CIT-0001, VIA-0001, LEV-0001) — mismo mecanismo que ya existe para
-- OS (siguiente_folio_os, migración 08) y Cotizaciones
-- (siguiente_numero_cotizacion, migración 20): un contador por empresa
-- + una función atómica que entrega el siguiente número sin choques
-- aunque dos personas guarden al mismo tiempo. OS no necesita nada acá
-- — ya tiene folio desde que se crea el trabajo (crearOrdenServicio,
-- backend/src/ordenes.ts) — esta migración solo cubre los 3 que
-- todavía no tenían uno.
--
-- El prefijo ("OS-", "CIT-", "VIA-", "LEV-") se agrega solo al
-- mostrarlo (formatearFolio, packages/shared) — acá se guarda el
-- número plano, igual que folio/numero en las tablas existentes.
--
-- Filas ya existentes quedan con folio null (mismo criterio que las OS
-- creadas antes de que existiera el folio eager, ver el comentario en
-- backend/src/ordenes.ts) — no se backfillea histórico.
-- ============================================================

alter table empresas add column siguiente_folio_cita int not null default 1;
alter table empresas add column siguiente_folio_viaje int not null default 1;
alter table empresas add column siguiente_folio_levantamiento int not null default 1;

create or replace function siguiente_folio_cita(p_empresa_id uuid)
returns int as $$
declare
  v_folio int;
begin
  update empresas
  set siguiente_folio_cita = siguiente_folio_cita + 1
  where id = p_empresa_id
  returning siguiente_folio_cita - 1 into v_folio;

  return v_folio;
end;
$$ language plpgsql;

create or replace function siguiente_folio_viaje(p_empresa_id uuid)
returns int as $$
declare
  v_folio int;
begin
  update empresas
  set siguiente_folio_viaje = siguiente_folio_viaje + 1
  where id = p_empresa_id
  returning siguiente_folio_viaje - 1 into v_folio;

  return v_folio;
end;
$$ language plpgsql;

create or replace function siguiente_folio_levantamiento(p_empresa_id uuid)
returns int as $$
declare
  v_folio int;
begin
  update empresas
  set siguiente_folio_levantamiento = siguiente_folio_levantamiento + 1
  where id = p_empresa_id
  returning siguiente_folio_levantamiento - 1 into v_folio;

  return v_folio;
end;
$$ language plpgsql;

alter table tareas add column folio int;
alter table viajes add column folio int;
alter table levantamientos add column folio int;
