-- Informe con IA y Asistente pasan de módulos base a exclusivos de
-- Pro (packages/shared/src/permisos.ts, MODULOS_OPCIONALES). Sin fila
-- en empresa_modulos, el default en código para un módulo opt-in es
-- "desactivado" — así que sin este backfill, toda empresa existente
-- (independiente de su plan) perdería acceso de golpe al aplicarse el
-- código nuevo. Este backfill deja el estado explícito y coherente
-- con el plan real de cada empresa al momento de la migración.
insert into empresa_modulos (empresa_id, modulo, activado)
select id, 'informe_ia', (plan = 'pro')
from empresas
on conflict (empresa_id, modulo) do nothing;

insert into empresa_modulos (empresa_id, modulo, activado)
select id, 'asistente', (plan = 'pro')
from empresas
on conflict (empresa_id, modulo) do nothing;
