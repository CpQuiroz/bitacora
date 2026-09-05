-- Packs de sesiones — precisar catálogo (tipos_pack) vs. instancia por
-- cliente (paquetes_sesiones). Ver el prompt "Packs de sesiones:
-- catálogo vs. instancia por cliente".
--
-- La separación ya existía (84_tipos_pack.sql / 88); esto agrega:
--   1. Snapshot de precio en la instancia: al vender un pack, se copian
--      cantidad y precio del catálogo a la fila del cliente y NO se
--      vuelven a mirar — si el negocio cambia el catálogo después, los
--      packs ya vendidos no se ven afectados (mismo criterio que
--      liquidaciones.detalle).
--   2. precio_pagado separado: lo realmente cobrado, editable al asignar
--      (para descuentos puntuales). null = se cobró el precio de lista.
--   3. Vigencia en días y OPCIONAL: null = el pack no vence. Reemplaza
--      vigencia_meses (que era NOT NULL default 6).

-- Instancia: snapshot de precio + precio efectivamente cobrado.
alter table paquetes_sesiones add column precio numeric;         -- precio de lista del catálogo al momento de la venta (snapshot)
alter table paquetes_sesiones add column precio_pagado numeric;  -- lo realmente cobrado (null = igual al de lista)

-- Catálogo: vigencia en días, opcional.
alter table tipos_pack add column vigencia_dias integer check (vigencia_dias is null or vigencia_dias > 0);
update tipos_pack set vigencia_dias = vigencia_meses * 30 where vigencia_meses is not null;
alter table tipos_pack drop column vigencia_meses;
