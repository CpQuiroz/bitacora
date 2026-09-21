-- ============================================================
-- Orden de compra del cliente (pedido 21-sep-2026: "el OS debe tener
-- la opcion de agregar numero de orden de compra que genero cliente").
-- Referencia libre, sin validar formato (cada cliente numera distinto)
-- — solo para que quede impresa en la OS y el cliente pueda conciliarla
-- con su propio sistema de compras. Vive en ordenes_servicio (no en
-- trabajos): es documentación de la OS, no del trabajo de terreno.
-- ============================================================

alter table ordenes_servicio add column orden_compra_cliente text;
