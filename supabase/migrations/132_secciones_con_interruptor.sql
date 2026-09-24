-- ============================================================
-- Secciones con interruptor propio (tarea 124, rediseño 24-sep-2026).
--
-- Mismo criterio que la migración 123 (división de "financiero"): las
-- claves viejas NO se renombran, se acota su significado y nacen
-- claves nuevas con el MISMO estado que tenía la vieja, para que
-- ninguna empresa ni rol gane o pierda nada con esta migración.
--   registros → pasa a ser solo Clientes; nacen equipos, inventario,
--               catalogo, proveedores (un interruptor por ítem del menú;
--               las pestañas internas, como Rendiciones dentro de Gastos,
--               siguen con su sección).
--
-- También deja el Informe con IA disponible en todos los planes (solo
-- Admin): se activa donde la empresa no tiene fila (el default de
-- informe_ia era apagado). Una empresa con informe_ia apagado a mano
-- se respeta.
--
-- Idempotente. Sin tablas nuevas (no requiere RLS nueva).
-- `empresas.pack_rubro` (migración 131) queda sin uso: se borra en una
-- migración aparte cuando esto esté estable en prod.
-- ============================================================

-- 1. Estado por empresa (empresa_modulos). Sin fila = default del
--    código (moduloActivadoPorDefecto): las nuevas quedan activadas por
--    defecto igual que registros, así que solo se copian las filas
--    explícitas.
insert into empresa_modulos (empresa_id, modulo, activado, actualizado_en)
select em.empresa_id, nuevo.modulo, em.activado, now()
from empresa_modulos em
cross join (values ('equipos'), ('inventario'), ('catalogo'), ('proveedores')) as nuevo(modulo)
where em.modulo = 'registros'
on conflict (empresa_id, modulo) do nothing;

-- 2. Plantilla global de roles (roles.modulos es un snapshot text[]).
update roles
set modulos = (
  select array_agg(distinct x order by x)
  from unnest(modulos || array['equipos', 'inventario', 'catalogo', 'proveedores']) as x
)
where 'registros' = any(modulos)
  and not ('equipos' = any(modulos) and 'inventario' = any(modulos) and 'catalogo' = any(modulos) and 'proveedores' = any(modulos));

-- 3. Ajustes de roles por empresa (empresa_rol_modulos, migración 75).
insert into empresa_rol_modulos (empresa_id, rol_slug, modulo, activado, actualizado_en)
select erm.empresa_id, erm.rol_slug, nuevo.modulo, erm.activado, now()
from empresa_rol_modulos erm
cross join (values ('equipos'), ('inventario'), ('catalogo'), ('proveedores')) as nuevo(modulo)
where erm.modulo = 'registros'
on conflict (empresa_id, rol_slug, modulo) do nothing;

-- 4. Informe con IA en todos los planes (solo Admin; tope por plan en
--    el backend). Solo donde no hay fila: respeta un apagado a mano.
insert into empresa_modulos (empresa_id, modulo, activado, actualizado_en)
select e.id, 'informe_ia', true, now()
from empresas e
on conflict (empresa_id, modulo) do nothing;
