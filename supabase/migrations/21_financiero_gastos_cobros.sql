-- BITÁCORA — Financiero: Gastos y Cobros (evoluciona "facturas").

-- Gastos: vínculos reales a Categorías de Gastos, Centros de Costo,
-- Proveedores (todos ya existen como catálogos), y comprobante
-- adjunto (imagen o PDF).
alter table gastos add column categoria_gasto_id uuid references categorias_gasto(id) on delete set null;
alter table gastos add column centro_costo_id uuid references centros_costo(id) on delete set null;
alter table gastos add column proveedor_id uuid references proveedores(id) on delete set null;
alter table gastos add column comprobante_url text;
alter table gastos add column comprobante_nombre text;

-- Cobros (la tabla sigue llamándose "facturas" — la usan el
-- Dashboard, el Informe IA y generar_factura(); solo cambia el
-- nombre visible). Se suma cliente_id real (antes solo texto),
-- fecha de pago y medio de pago/link de una pasarela.
alter table facturas add column cliente_id uuid references clientes(id) on delete set null;
alter table facturas add column fecha_pago date;
alter table facturas add column medio_pago text;
alter table facturas add column link_pago text;
