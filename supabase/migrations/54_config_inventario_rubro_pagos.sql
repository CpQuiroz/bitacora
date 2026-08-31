-- Bloque B: inventario configurable por empresa (antes: descuento
-- hardcodeado al estado "firmada" en backend/src/inventario.ts).
alter table empresas add column inventario_descontar_en_estado text not null default 'firmada'
  check (inventario_descontar_en_estado in ('pendiente', 'enviada', 'en_proceso', 'completada', 'firmada'));
alter table empresas add column inventario_permitir_negativo boolean not null default true;
alter table empresas add column inventario_descontar_una_vez boolean not null default true;

-- Distingue movimientos manuales (Configuración > Inventario, ya
-- existía el endpoint) de los automáticos generados al cambiar el
-- estado de una OS — antes solo se diferenciaban por el texto libre
-- de "motivo".
alter table inventario_movimientos add column origen text not null default 'manual' check (origen in ('manual', 'automatico'));

-- Bloque E: sugerencias iniciales de categorías/tipos según el rubro
-- de la empresa (empresas.rubro ya existía) — mecanismo genérico
-- basado en datos, reemplaza las listas "SUGERIDOS" hardcodeadas que
-- hoy viven repetidas en 4 pantallas de Configuración/Catálogo.
-- Sin empresa_id / sin RLS a propósito: es catálogo de referencia
-- global (no multi-tenant), solo lo toca el backend con service role
-- — mismo criterio que otras tablas de referencia del proyecto.
--
-- TODO: decisión pendiente — solo se cargó contenido real para el
-- rubro "transporte" (ejemplo mínimo, 2-3 sugerencias por tipo). Falta
-- que se defina el contenido de "servicio_tecnico" y "otro" antes de
-- dar esto por terminado.
create table sugerencias_rubro (
  id uuid primary key default gen_random_uuid(),
  rubro text not null check (rubro in ('transporte', 'servicio_tecnico', 'otro')),
  tipo_sugerencia text not null check (tipo_sugerencia in ('categoria_gasto', 'categoria_catalogo', 'tipo_os', 'tipo_documento')),
  valor text not null,
  color text,
  aplica_a text,
  orden int not null default 0
);
create index on sugerencias_rubro (rubro, tipo_sugerencia, orden);

insert into sugerencias_rubro (rubro, tipo_sugerencia, valor, orden) values
  ('transporte', 'categoria_gasto', 'Combustible', 1),
  ('transporte', 'categoria_gasto', 'Peajes', 2),
  ('transporte', 'categoria_gasto', 'Mantención de flota', 3),
  ('transporte', 'categoria_catalogo', 'Flete', 1),
  ('transporte', 'categoria_catalogo', 'Carga y descarga', 2),
  ('transporte', 'tipo_os', 'Transporte de carga', 1),
  ('transporte', 'tipo_os', 'Traslado de pasajeros', 2);
insert into sugerencias_rubro (rubro, tipo_sugerencia, valor, aplica_a, orden) values
  ('transporte', 'tipo_documento', 'Revisión técnica', 'vehiculo', 1),
  ('transporte', 'tipo_documento', 'Permiso de circulación', 'vehiculo', 2),
  ('transporte', 'tipo_documento', 'Licencia de conducir', 'colaborador', 3);

-- Bloque J: registro de pago manual de un Cobro — funciona
-- independiente de si hay una pasarela de pago real conectada.
alter table facturas add column valor_recibido numeric(12, 2);
alter table facturas add column observaciones_pago text;
