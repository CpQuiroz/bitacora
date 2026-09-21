-- ============================================================
-- BITÁCORA — Unificar "Tipo de OS" y "Tipo de Trabajo" en un solo
-- catálogo: "Tipo de OS/Trabajo".
--
-- Pedido (21-sep-2026): en el formulario de Nueva OS aparecían 2
-- selectores casi idénticos uno debajo del otro ("Tipo de servicio" y
-- "Tipo de OS (opcional)") — redundante a la vista, aunque hasta hoy
-- servían cosas distintas: tipos_trabajo define los campos dinámicos
-- del formulario (custom por rubro); tipos_os define color + checklist
-- predeterminado + tiempo estimado para el listado/agenda. La
-- migración 15 los separó a propósito en su momento ("un concepto
-- distinto aunque el nombre se parezca") — a la luz del uso real, el
-- pedido de la usuaria es correcto: un tipo de OS debería poder tener
-- AMBAS cosas a la vez (sus propios campos Y su propio color/checklist/
-- duración), no dos catálogos aparte.
--
-- Estado real en prod antes de esta migración (verificado read-only):
-- 6 filas en tipos_trabajo, 5 en tipos_os, CERO nombres repetidos entre
-- ambas tablas para una misma empresa — no hace falta fusionar dos
-- filas en una, cada una pasa tal cual a la tabla nueva. Solo 1 trabajo
-- en toda la base tenía AMBOS ids seteados (a filas distintas) — para
-- ese caso puntual se prioriza tipo_trabajo_id (define trabajo.datos,
-- dato real ya cargado; tipo_os_id ahí era solo clasificación visual,
-- se pierde sin romper nada real).
-- ============================================================

-- 1. tipos_trabajo gana las columnas de tipos_os (mismo default que
--    tenían allá, así una fila migrada de tipos_trabajo queda con el
--    mismo comportamiento neutro de antes: sin descripción, color por
--    defecto, sin checklist ni tiempo estimado).
alter table tipos_trabajo add column descripcion text;
alter table tipos_trabajo add column color text not null default '#4338ca';
alter table tipos_trabajo add column checklist_template_id uuid references checklist_templates(id) on delete set null;
alter table tipos_trabajo add column tiempo_estimado_minutos integer;

-- 2. Cada fila de tipos_os pasa a ser una fila nueva de tipos_trabajo
--    (campos = '[]' — ningún tipos_os tenía ese nombre en tipos_trabajo,
--    verificado antes de escribir esto).
insert into tipos_trabajo (empresa_id, nombre, campos, activo, creado_en, descripcion, color, checklist_template_id, tiempo_estimado_minutos)
select empresa_id, nombre, '[]'::jsonb, activo, creado_en, descripcion, color, checklist_template_id, tiempo_estimado_minutos
from tipos_os;

-- 3. trabajos: un solo tipo_id en vez de tipo_trabajo_id + tipo_os_id.
alter table trabajos add column tipo_id uuid references tipos_trabajo(id) on delete set null;

update trabajos set tipo_id = tipo_trabajo_id where tipo_trabajo_id is not null;

-- Los trabajos que solo tenían tipo_os_id (y no tipo_trabajo_id) se
-- reconectan por nombre+empresa a la fila que insertó el paso 2.
update trabajos t
set tipo_id = nuevo.id
from tipos_os viejo
join tipos_trabajo nuevo on nuevo.empresa_id = viejo.empresa_id and nuevo.nombre = viejo.nombre
where t.tipo_os_id = viejo.id
  and t.tipo_id is null;

alter table trabajos drop column tipo_trabajo_id;
alter table trabajos drop column tipo_os_id;
drop table tipos_os;

-- 4. Renombrar para reflejar el concepto unificado. La policy RLS
--    ("acceso por empresa") y el índice de la tabla siguen atados por
--    OID, no por nombre — sobreviven el rename sin recrearlos.
alter table tipos_trabajo rename to tipos_os_trabajo;

create index if not exists idx_trabajos_tipo_id on public.trabajos (tipo_id);
