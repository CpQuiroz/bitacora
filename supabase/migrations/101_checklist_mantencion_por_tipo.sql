-- ============================================================
-- BITÁCORA — Checklist distinto para mantención "diario" vs. "programa"
-- (250h/6 meses). Pedido real de la usuaria (12-sep-2026): hasta ahora
-- ambos tipos usaban LA MISMA plantilla en checklist_templates (36
-- ítems, 7 secciones) — el chequeo diario del chofer antes de salir a
-- ruta necesita ser mucho más corto que el Programa de Mantención en
-- taller.
--
-- No hay FK de registros_mantencion_equipo a checklist_templates (las
-- respuestas quedan copiadas en registros_mantencion_equipo.checklist
-- jsonb) — renombrar/agregar templates NO afecta registros ya creados.
--
-- 1) La plantilla existente ("Mantención de flota", 36 ítems) pasa a
--    llamarse "Mantención de flota - Programa" — sigue siendo la del
--    Programa de 250h/6 meses, sin cambios de contenido.
-- 2) Se agrega "Mantención de flota - Diario", más corta (11 ítems, 4
--    secciones) — pensada para un chequeo visual/funcional rápido
--    antes de salir a ruta, no un service completo. Es un punto de
--    partida razonable: cada empresa puede editarla libremente desde
--    Configuración → Checklists (CRUD genérico ya existente, sin
--    código nuevo — ver backend/src/routes/checklists.ts).
--
-- Idempotente: no duplica "- Diario" si ya existe (reintento seguro).
-- ============================================================

update checklist_templates
set nombre = 'Mantención de flota - Programa',
    actualizado_en = now()
where nombre = 'Mantención de flota';

insert into checklist_templates (empresa_id, nombre, descripcion, secciones)
select
  e.id,
  'Mantención de flota - Diario',
  'Chequeo visual/funcional antes de salir a ruta — más corto que el Programa de Mantención (250 h / 6 meses).',
  '[
    {"nombre":"Niveles y fluidos","preguntas":[
      {"texto":"Aceite de motor","obligatorio":true},
      {"texto":"Refrigerante de motor","obligatorio":true},
      {"texto":"Líquido limpiaparabrisas","obligatorio":true}
    ]},
    {"nombre":"Neumáticos y luces","preguntas":[
      {"texto":"Presión de neumáticos","obligatorio":true},
      {"texto":"Estado llanta de repuesto","obligatorio":true},
      {"texto":"Batería y terminales","obligatorio":true},
      {"texto":"Luces y señalización","obligatorio":true}
    ]},
    {"nombre":"Frenos y dirección","preguntas":[
      {"texto":"Sistema de frenos de aire / válvulas","obligatorio":true},
      {"texto":"Terminal de dirección","obligatorio":true}
    ]},
    {"nombre":"Seguridad y documentación","preguntas":[
      {"texto":"Extintor vigente","obligatorio":true},
      {"texto":"Botiquín / kit de emergencia","obligatorio":true},
      {"texto":"Triángulos y conos de seguridad","obligatorio":true}
    ]}
  ]'::jsonb
from empresas e
where exists (
  -- Solo empresas que ya usan Mantención de flota (tienen la de
  -- Programa) — no le crea el módulo a una empresa que nunca lo usó.
  select 1 from checklist_templates ct
  where ct.empresa_id = e.id and ct.nombre = 'Mantención de flota - Programa'
)
and not exists (
  select 1 from checklist_templates ct2
  where ct2.empresa_id = e.id and ct2.nombre = 'Mantención de flota - Diario'
);
