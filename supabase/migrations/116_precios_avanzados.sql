-- ============================================================
-- BITÁCORA — Costo, precio mayorista y precio minorista, opcional
-- por empresa (Cotización y OS).
--
-- Pedido (21-sep-2026): algunas empresas venden a 2 tarifas (mayorista/
-- minorista) y quieren ver el costo interno para calcular margen. Es
-- opt-in a propósito ("será solo para algunas empresas") — mismo
-- criterio que Inventario (empresas.inventario_activado): un switch en
-- Configuración > Empresa que solo muestra los 3 campos nuevos si la
-- empresa los pidió; el resto de las empresas no ve nada distinto.
--
-- Igual que precio_base en catalogo_items ya se copia como
-- precio_unitario al agregar un ítem a una OS/Cotización desde el
-- Catálogo (CatalogoSelectorModal), estos 3 campos se definen una vez
-- por ítem de Catálogo y se copian solos al armar el documento — no
-- hay que retipearlos cada vez. Todos nullable: no son obligatorios
-- ítem por ítem aunque la empresa tenga la función activada.
--
-- Solo internos: nunca se imprimen en el PDF que ve el cliente
-- (generarPdfOS.ts / generarPdfCotizacion.ts siguen mostrando nomás
-- precio_unitario) — costo/mayorista/minorista son para uso interno
-- de quien arma el documento, no para el cliente final.
-- ============================================================

alter table empresas add column precios_avanzados_activado boolean not null default false;

alter table catalogo_items add column costo numeric(12,2);
alter table catalogo_items add column precio_mayorista numeric(12,2);
alter table catalogo_items add column precio_minorista numeric(12,2);

alter table os_items add column costo numeric(12,2);
alter table os_items add column precio_mayorista numeric(12,2);
alter table os_items add column precio_minorista numeric(12,2);

alter table presupuesto_items add column costo numeric(12,2);
alter table presupuesto_items add column precio_mayorista numeric(12,2);
alter table presupuesto_items add column precio_minorista numeric(12,2);
