-- ============================================================
-- Planes nuevos (tarea 124, decisión de la usuaria 24-sep-2026):
-- Esencial (clave `basico`, se mantiene), Operación, Pro y Empresa,
-- más la prueba (`trial`). Ver packages/shared/src/planes.ts.
--
--  1. Los checks de plan aceptan `operacion` y `empresa`.
--  2. `empresas.plan` gana un check (hasta ahora era texto libre).
--  3. `empresas.pack_rubro`: pack que eligió una empresa en Operación.
--  4. La prueba pasa a traer todo, como Pro: las empresas que están
--     hoy en prueba reciben los módulos que antes eran opt-in.
--     Las empresas Básico/Pro existentes NO cambian de módulos.
-- Aditiva e idempotente. Sin tablas nuevas (no requiere RLS nueva).
-- ============================================================

alter table empresa_plan_historial drop constraint if exists empresa_plan_historial_plan_anterior_check;
alter table empresa_plan_historial add constraint empresa_plan_historial_plan_anterior_check
  check (plan_anterior in ('trial','basico','operacion','pro','empresa'));

alter table empresa_plan_historial drop constraint if exists empresa_plan_historial_plan_nuevo_check;
alter table empresa_plan_historial add constraint empresa_plan_historial_plan_nuevo_check
  check (plan_nuevo in ('trial','basico','operacion','pro','empresa'));

alter table suscripciones drop constraint if exists suscripciones_plan_pendiente_check;
alter table suscripciones add constraint suscripciones_plan_pendiente_check
  check (plan_pendiente in ('basico','operacion','pro','empresa'));

alter table empresas drop constraint if exists empresas_plan_check;
alter table empresas add constraint empresas_plan_check
  check (plan in ('trial','basico','operacion','pro','empresa'));

alter table empresas add column if not exists pack_rubro text;
alter table empresas drop constraint if exists empresas_pack_rubro_check;
alter table empresas add constraint empresas_pack_rubro_check
  check (pack_rubro is null or pack_rubro in ('transporte','mantencion','agenda'));

-- La prueba trae todo (MODULOS_GESTIONADOS_POR_PLAN de planes.ts).
-- Remuneraciones no: es un adicional y no depende del plan.
insert into empresa_modulos (empresa_id, modulo, activado, actualizado_en)
select e.id, m.modulo, true, now()
from empresas e
cross join (values
  ('agenda'), ('ordenes_servicio'), ('cotizaciones'), ('cobros'), ('financiero'), ('informes'),
  ('configuracion'), ('gestion_control'),
  ('viajes'), ('registros'), ('rutas'), ('flota'), ('levantamientos'), ('agenda_pro'),
  ('informe_ia'), ('asistente')
) as m(modulo)
where e.plan = 'trial'
on conflict (empresa_id, modulo) do update set activado = true, actualizado_en = now();
