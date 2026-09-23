-- BITÁCORA — Descripción opcional por foto de Levantamiento (pedido
-- explícito: "las imágenes que subo debiera tener una cajita para
-- agregar descripción de la imagen"). Mismo criterio que el resto de
-- los campos de texto libre del módulo (descripcion_tecnico, etc.):
-- nullable, sin default.
alter table levantamiento_fotos add column descripcion text;
