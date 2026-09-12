-- ============================================================
-- BITÁCORA — Checklist distinto para mantención "diario" vs. "programa"
-- (250h/6 meses). Pedido real de la usuaria (12-sep-2026): hasta ahora
-- ambos tipos usaban LA MISMA plantilla en checklist_templates (36
-- ítems, 7 secciones) — el chequeo diario del chofer antes de salir a
-- ruta necesita ser mucho más corto que el de la mantención cada 6
-- meses/250h en taller. Nombres finales: "Checklist diario" y
-- "Mantención Flota".
--
-- Contenido (tercera vuelta, 12-sep): curado para un tractor de
-- carretera 6x4 con frenos de aire (tipo International 9200) — pre-trip
-- inspection para el diario (13 ítems, 7 secciones, solo lo que cambia
-- día a día y compromete seguridad o deja el camión botado en ruta) y
-- service preventivo real por sistema para Mantención Flota (21 ítems,
-- 10 secciones, cada sección = un sistema del camión). Ninguna de las
-- dos listas es la ficha técnica oficial del fabricante — es un punto
-- de partida razonable, confirmado con la usuaria; se sigue pudiendo
-- editar libremente desde Configuración → Checklists.
--
-- No hay FK de registros_mantencion_equipo a checklist_templates (las
-- respuestas quedan copiadas en registros_mantencion_equipo.checklist
-- jsonb) — renombrar/actualizar templates NO afecta registros ya
-- creados.
--
-- Idempotente en el sentido de "se puede reintentar sin duplicar filas"
-- (insert condicional por nombre). El contenido SÍ se pisa sin
-- condición cada vez que corre — aceptable acá porque esta es la
-- primera vez que existe contenido bajo estos 2 nombres (nunca llegó a
-- prod todavía); si una empresa edita su checklist después de que esta
-- migración corra una vez, esta migración no se vuelve a correr, así
-- que esa edición queda intacta.
-- ============================================================

-- 1) Renombra "Mantención de flota" (si alguna empresa quedó en el
--    nombre original, de antes de la primera vuelta de esta tarea) y
--    fija el contenido de "Mantención Flota" al service reducido de
--    21 ítems.
update checklist_templates
set nombre = 'Mantención Flota',
    actualizado_en = now()
where nombre = 'Mantención de flota';

update checklist_templates
set secciones = '[
    {"nombre":"Motor y lubricación","preguntas":[
      {"texto":"Cambio de aceite y filtro de motor","obligatorio":true},
      {"texto":"Filtro de combustible","obligatorio":true},
      {"texto":"Filtro de aire","obligatorio":true},
      {"texto":"Correas y mangueras","obligatorio":true}
    ]},
    {"nombre":"Enfriamiento","preguntas":[
      {"texto":"Refrigerante (nivel y estado)","obligatorio":true},
      {"texto":"Radiador y manguitos","obligatorio":true}
    ]},
    {"nombre":"Transmisión y embrague","preguntas":[
      {"texto":"Nivel de aceite de transmisión","obligatorio":true},
      {"texto":"Ajuste y desgaste del embrague","obligatorio":true}
    ]},
    {"nombre":"Diferenciales y ejes","preguntas":[
      {"texto":"Nivel de aceite diferencial","obligatorio":true},
      {"texto":"Rodamientos de cubo","obligatorio":true}
    ]},
    {"nombre":"Dirección y suspensión","preguntas":[
      {"texto":"Terminales y rótulas de dirección","obligatorio":true},
      {"texto":"Muelles y amortiguadores","obligatorio":true}
    ]},
    {"nombre":"Frenos","preguntas":[
      {"texto":"Guarniciones / pastillas","obligatorio":true},
      {"texto":"Compresor y secador de aire","obligatorio":true},
      {"texto":"Cámaras de freno","obligatorio":true}
    ]},
    {"nombre":"Neumáticos","preguntas":[
      {"texto":"Rotación y alineación","obligatorio":true},
      {"texto":"Torque de pernos de rueda","obligatorio":true}
    ]},
    {"nombre":"Eléctrico","preguntas":[
      {"texto":"Batería y alternador","obligatorio":true}
    ]},
    {"nombre":"Escape","preguntas":[
      {"texto":"Sistema de escape completo","obligatorio":true}
    ]},
    {"nombre":"Seguridad","preguntas":[
      {"texto":"Extintor recargado","obligatorio":true},
      {"texto":"Botiquín completo","obligatorio":true}
    ]}
  ]'::jsonb,
  descripcion = 'Service preventivo cada 6 meses / 250h, por sistema del camión.',
  actualizado_en = now()
where nombre = 'Mantención Flota';

-- 2) "Checklist diario": inserta la fila si no existe (empresa que
--    nunca lo tuvo) y fija el contenido al pre-trip reducido de 13
--    ítems.
insert into checklist_templates (empresa_id, nombre, descripcion, secciones)
select
  e.id,
  'Checklist diario',
  'Chequeo antes de salir a ruta — solo lo que compromete seguridad o deja el camión botado.',
  '[]'::jsonb
from empresas e
where exists (
  select 1 from checklist_templates ct
  where ct.empresa_id = e.id and ct.nombre = 'Mantención Flota'
)
and not exists (
  select 1 from checklist_templates ct2
  where ct2.empresa_id = e.id and ct2.nombre = 'Checklist diario'
);

update checklist_templates
set secciones = '[
    {"nombre":"Motor y niveles","preguntas":[
      {"texto":"Aceite de motor","obligatorio":true},
      {"texto":"Refrigerante","obligatorio":true},
      {"texto":"Fugas visibles (aceite / combustible / refrigerante)","obligatorio":true}
    ]},
    {"nombre":"Frenos","preguntas":[
      {"texto":"Presión de aire alcanza régimen","obligatorio":true},
      {"texto":"Freno de estacionamiento","obligatorio":true}
    ]},
    {"nombre":"Neumáticos y ruedas","preguntas":[
      {"texto":"Presión de neumáticos","obligatorio":true},
      {"texto":"Estado visual (cortes, desgaste irregular)","obligatorio":true},
      {"texto":"Pernos de rueda","obligatorio":true}
    ]},
    {"nombre":"Luces","preguntas":[
      {"texto":"Luces delanteras y traseras","obligatorio":true},
      {"texto":"Direccionales y baliza","obligatorio":true}
    ]},
    {"nombre":"Eléctrico","preguntas":[
      {"texto":"Batería (terminales)","obligatorio":true}
    ]},
    {"nombre":"Cabina","preguntas":[
      {"texto":"Cinturón de seguridad","obligatorio":true}
    ]},
    {"nombre":"Seguridad","preguntas":[
      {"texto":"Extintor vigente","obligatorio":true}
    ]}
  ]'::jsonb,
  descripcion = 'Chequeo antes de salir a ruta — solo lo que compromete seguridad o deja el camión botado.',
  actualizado_en = now()
where nombre = 'Checklist diario';
