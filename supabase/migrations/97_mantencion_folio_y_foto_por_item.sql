-- BITÁCORA — Registros de mantención de flota, ajustes de fase 1.5:
--   1. Folio correlativo por empresa (para el PDF impreso/archivable).
--   2. Foto asociada a un ítem puntual del checklist — permite exigir
--      una foto cuando un ítem quedó en "no" (regla detrás de flag en
--      el backend; ver MANTENCION_EXIGE_FOTO_EN_NO).

-- ---------- 1. Folio ----------
alter table empresas add column siguiente_folio_mantencion int not null default 1;

create or replace function siguiente_folio_mantencion(p_empresa_id uuid)
returns int as $$
declare
  v_folio int;
begin
  update empresas
  set siguiente_folio_mantencion = siguiente_folio_mantencion + 1
  where id = p_empresa_id
  returning siguiente_folio_mantencion - 1 into v_folio;
  return v_folio;
end;
$$ language plpgsql;

alter table registros_mantencion_equipo add column folio int;
create index on registros_mantencion_equipo (empresa_id, folio);

-- ---------- Fecha del chequeo (puede diferir del creado_en) ----------
-- El chequeo pudo hacerse ayer y registrarse hoy. Los registros ya
-- existentes toman la fecha en que se crearon.
alter table registros_mantencion_equipo add column fecha date not null default current_date;
update registros_mantencion_equipo set fecha = creado_en::date where fecha = current_date and creado_en::date <> current_date;
create index on registros_mantencion_equipo (empresa_id, equipo_id, fecha desc);

-- ---------- 2. Foto por ítem ----------
-- item = null → foto general del registro. item = "<texto del ítem>" →
-- foto que respalda ese punto del checklist.
alter table registro_mantencion_fotos add column item text;
