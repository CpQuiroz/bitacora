-- BITÁCORA — Portal del cliente: control de qué secciones se le muestran
-- al cliente final.
--
-- El portal (citas, órdenes, cotizaciones, cobros con acceso propio del
-- cliente) mostraba las 4 secciones siempre. Ahora cada empresa decide
-- cuáles expone desde el dashboard (Clientes → Portal del cliente). El
-- backend del portal filtra por estas columnas; el default `true`
-- mantiene el comportamiento actual para todas las empresas existentes.

alter table empresas add column if not exists portal_muestra_ordenes      boolean not null default true;
alter table empresas add column if not exists portal_muestra_citas        boolean not null default true;
alter table empresas add column if not exists portal_muestra_cotizaciones boolean not null default true;
alter table empresas add column if not exists portal_muestra_cobros       boolean not null default true;
