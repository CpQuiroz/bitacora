-- ============================================================
-- Sugerencias por rubro para los 4 rubros (tarea 144, 25-sep-2026).
--
-- Decisión de la usuaria: una empresa nueva parte SIN servicios, tipos de
-- pack, ítems de catálogo, tipos de OS, categorías de gasto ni tipos de
-- documento (solo transporte sigue con sus checklists de flota). Cada
-- pantalla de creación muestra estas sugerencias según empresas.rubro
-- para crearlas con un clic.
--
-- - rubro: se agrega 'cosmetologia' (existía en la app, no en la tabla).
-- - tipo_sugerencia: se agregan 'servicio' (Agenda Pro) y 'tipo_pack'.
-- - datos: valores para precargar el formulario
--     servicio  → { "duracion_min": 60 }
--     tipo_pack → { "sesiones": 5, "vigencia_dias": 90 }
--
-- Tabla de solo backend (RLS sin políticas, migración 73). Aditiva e
-- idempotente: no duplica filas si se corre dos veces.
-- ============================================================

alter table sugerencias_rubro drop constraint if exists sugerencias_rubro_rubro_check;
alter table sugerencias_rubro add constraint sugerencias_rubro_rubro_check
  check (rubro in ('transporte', 'servicio_tecnico', 'cosmetologia', 'otro'));

alter table sugerencias_rubro drop constraint if exists sugerencias_rubro_tipo_sugerencia_check;
alter table sugerencias_rubro add constraint sugerencias_rubro_tipo_sugerencia_check
  check (tipo_sugerencia in ('categoria_gasto', 'categoria_catalogo', 'tipo_os', 'tipo_documento', 'servicio', 'tipo_pack'));

alter table sugerencias_rubro add column if not exists datos jsonb;

insert into sugerencias_rubro (rubro, tipo_sugerencia, valor, aplica_a, datos, orden)
select v.rubro, v.tipo, v.valor, v.aplica_a, v.datos::jsonb, v.orden
from (values
  -- Transporte (ya tenía: Combustible, Peajes, Mantención de flota; Flete,
  -- Carga y descarga; Transporte de carga, Traslado de pasajeros; Revisión
  -- técnica, Permiso de circulación, Licencia de conducir).
  ('transporte', 'categoria_gasto', 'Neumáticos', null, null, 4),
  ('transporte', 'categoria_gasto', 'Estacionamiento', null, null, 5),
  ('transporte', 'categoria_gasto', 'Lavado', null, null, 6),
  ('transporte', 'categoria_catalogo', 'Mudanza', null, null, 3),
  ('transporte', 'tipo_os', 'Mudanza', null, null, 3),
  ('transporte', 'tipo_os', 'Distribución', null, null, 4),
  ('transporte', 'tipo_documento', 'SOAP', 'vehiculo', null, 4),
  ('transporte', 'tipo_documento', 'Seguro de carga', 'vehiculo', null, 5),
  ('transporte', 'tipo_documento', 'Hoja de vida del conductor', 'colaborador', null, 6),
  ('transporte', 'servicio', 'Flete local', null, '{"duracion_min": 180}', 1),
  ('transporte', 'servicio', 'Mudanza', null, '{"duracion_min": 240}', 2),
  ('transporte', 'servicio', 'Carga y descarga', null, '{"duracion_min": 60}', 3),
  ('transporte', 'tipo_pack', 'Pack 4 fletes al mes', null, '{"sesiones": 4, "vigencia_dias": 30}', 1),

  -- Servicio técnico / mantención
  ('servicio_tecnico', 'categoria_gasto', 'Repuestos', null, null, 1),
  ('servicio_tecnico', 'categoria_gasto', 'Materiales e insumos', null, null, 2),
  ('servicio_tecnico', 'categoria_gasto', 'Herramientas', null, null, 3),
  ('servicio_tecnico', 'categoria_gasto', 'Combustible', null, null, 4),
  ('servicio_tecnico', 'categoria_gasto', 'Peajes y estacionamiento', null, null, 5),
  ('servicio_tecnico', 'categoria_catalogo', 'Repuestos', null, null, 1),
  ('servicio_tecnico', 'categoria_catalogo', 'Insumos', null, null, 2),
  ('servicio_tecnico', 'categoria_catalogo', 'Mano de obra', null, null, 3),
  ('servicio_tecnico', 'categoria_catalogo', 'Visita técnica', null, null, 4),
  ('servicio_tecnico', 'tipo_os', 'Mantención preventiva', null, null, 1),
  ('servicio_tecnico', 'tipo_os', 'Reparación', null, null, 2),
  ('servicio_tecnico', 'tipo_os', 'Instalación', null, null, 3),
  ('servicio_tecnico', 'tipo_os', 'Diagnóstico', null, null, 4),
  ('servicio_tecnico', 'tipo_os', 'Garantía', null, null, 5),
  ('servicio_tecnico', 'tipo_documento', 'Licencia de conducir', 'colaborador', null, 1),
  ('servicio_tecnico', 'tipo_documento', 'Certificación SEC', 'colaborador', null, 2),
  ('servicio_tecnico', 'tipo_documento', 'Revisión técnica', 'vehiculo', null, 3),
  ('servicio_tecnico', 'tipo_documento', 'Permiso de circulación', 'vehiculo', null, 4),
  ('servicio_tecnico', 'servicio', 'Visita técnica y diagnóstico', null, '{"duracion_min": 60}', 1),
  ('servicio_tecnico', 'servicio', 'Mantención preventiva', null, '{"duracion_min": 90}', 2),
  ('servicio_tecnico', 'servicio', 'Instalación', null, '{"duracion_min": 120}', 3),
  ('servicio_tecnico', 'servicio', 'Reparación', null, '{"duracion_min": 120}', 4),
  ('servicio_tecnico', 'tipo_pack', 'Plan de mantención trimestral', null, '{"sesiones": 4, "vigencia_dias": 365}', 1),
  ('servicio_tecnico', 'tipo_pack', 'Pack 3 visitas técnicas', null, '{"sesiones": 3, "vigencia_dias": 180}', 2),

  -- Cosmetología / belleza
  ('cosmetologia', 'categoria_gasto', 'Insumos y productos', null, null, 1),
  ('cosmetologia', 'categoria_gasto', 'Arriendo', null, null, 2),
  ('cosmetologia', 'categoria_gasto', 'Servicios básicos', null, null, 3),
  ('cosmetologia', 'categoria_gasto', 'Publicidad', null, null, 4),
  ('cosmetologia', 'categoria_gasto', 'Mantención de equipos', null, null, 5),
  ('cosmetologia', 'categoria_catalogo', 'Productos de venta', null, null, 1),
  ('cosmetologia', 'categoria_catalogo', 'Insumos', null, null, 2),
  ('cosmetologia', 'categoria_catalogo', 'Tratamientos faciales', null, null, 3),
  ('cosmetologia', 'categoria_catalogo', 'Tratamientos corporales', null, null, 4),
  ('cosmetologia', 'tipo_os', 'Tratamiento facial', null, null, 1),
  ('cosmetologia', 'tipo_os', 'Tratamiento corporal', null, null, 2),
  ('cosmetologia', 'tipo_os', 'Depilación', null, null, 3),
  ('cosmetologia', 'tipo_os', 'Manicure y pedicure', null, null, 4),
  ('cosmetologia', 'tipo_documento', 'Título o certificado profesional', 'colaborador', null, 1),
  ('cosmetologia', 'tipo_documento', 'Contrato de trabajo', 'colaborador', null, 2),
  ('cosmetologia', 'servicio', 'Limpieza facial', null, '{"duracion_min": 60}', 1),
  ('cosmetologia', 'servicio', 'Manicure', null, '{"duracion_min": 45}', 2),
  ('cosmetologia', 'servicio', 'Pedicure', null, '{"duracion_min": 60}', 3),
  ('cosmetologia', 'servicio', 'Depilación', null, '{"duracion_min": 30}', 4),
  ('cosmetologia', 'servicio', 'Masaje reductivo', null, '{"duracion_min": 60}', 5),
  ('cosmetologia', 'servicio', 'Lifting de pestañas', null, '{"duracion_min": 60}', 6),
  ('cosmetologia', 'tipo_pack', 'Pack 5 limpiezas faciales', null, '{"sesiones": 5, "vigencia_dias": 90}', 1),
  ('cosmetologia', 'tipo_pack', 'Pack 10 sesiones reductivas', null, '{"sesiones": 10, "vigencia_dias": 120}', 2),
  ('cosmetologia', 'tipo_pack', 'Pack 4 manicures', null, '{"sesiones": 4, "vigencia_dias": 60}', 3),

  -- Otro
  ('otro', 'categoria_gasto', 'Materiales', null, null, 1),
  ('otro', 'categoria_gasto', 'Combustible', null, null, 2),
  ('otro', 'categoria_gasto', 'Arriendo', null, null, 3),
  ('otro', 'categoria_gasto', 'Servicios básicos', null, null, 4),
  ('otro', 'categoria_gasto', 'Publicidad', null, null, 5),
  ('otro', 'categoria_catalogo', 'Productos', null, null, 1),
  ('otro', 'categoria_catalogo', 'Servicios', null, null, 2),
  ('otro', 'categoria_catalogo', 'Insumos', null, null, 3),
  ('otro', 'tipo_os', 'Visita', null, null, 1),
  ('otro', 'tipo_os', 'Servicio', null, null, 2),
  ('otro', 'tipo_os', 'Instalación', null, null, 3),
  ('otro', 'tipo_documento', 'Contrato de trabajo', 'colaborador', null, 1),
  ('otro', 'tipo_documento', 'Licencia de conducir', 'colaborador', null, 2),
  ('otro', 'servicio', 'Visita', null, '{"duracion_min": 60}', 1),
  ('otro', 'servicio', 'Asesoría', null, '{"duracion_min": 60}', 2),
  ('otro', 'tipo_pack', 'Pack 5 sesiones', null, '{"sesiones": 5, "vigencia_dias": 90}', 1)
) as v(rubro, tipo, valor, aplica_a, datos, orden)
where not exists (
  select 1 from sugerencias_rubro s where s.rubro = v.rubro and s.tipo_sugerencia = v.tipo and s.valor = v.valor
);
