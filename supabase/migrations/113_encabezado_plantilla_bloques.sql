-- ============================================================
-- BITÁCORA — "Texto de encabezado" de Plantillas pasa de texto plano
-- a una lista de bloques con nivel (Título/Subtítulo/Texto chico/
-- Párrafo).
--
-- Pedido (20-sep-2026): hoy es un <input> de una sola línea — ni
-- siquiera admite cortar renglones — y en el PDF/vista previa todo
-- sale del mismo tamaño, sin jerarquía. Pasa a
-- `jsonb`: array de `{ nivel: "titulo"|"subtitulo"|"chico"|"parrafo",
-- texto: string }`. Aplica a los 4 tipos de plantilla (cotizacion,
-- orden_servicio, cobranza, terminos_aceptacion) — comparten la misma
-- fila/columna.
--
-- Sin perder lo que ya haya escrito cada empresa: se agrega la
-- columna nueva, se backfillea cada valor existente como un único
-- bloque "parrafo", se borra la columna vieja y se renombra la nueva
-- al mismo nombre — la API sigue leyendo/escribiendo `texto_encabezado`
-- sin que el resto del código note el cambio de nombre de columna.
-- ============================================================

alter table plantillas_documento add column texto_encabezado_nuevo jsonb;

update plantillas_documento
set texto_encabezado_nuevo = case
  when texto_encabezado is not null and texto_encabezado <> ''
    then jsonb_build_array(jsonb_build_object('nivel', 'parrafo', 'texto', texto_encabezado))
  else null
end;

alter table plantillas_documento drop column texto_encabezado;
alter table plantillas_documento rename column texto_encabezado_nuevo to texto_encabezado;
