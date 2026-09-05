-- PASO 0 del rediseño de navegación — puente OS firmada → Cobro.
-- Hasta ahora finalizar/firmar una OS no generaba ningún documento por
-- cobrar: había que crearlo a mano en Cobros (suelto o "desde trabajos").
-- Tampoco había forma de saber si una OS ya se cobró.
--
-- Ver diseño acordado en el chat:
--   - Al finalizar (/finalizar → estado_os "firmada"), si la empresa
--     tiene cobro_automatico_al_firmar y el trabajo tiene monto > 0 y la
--     orden no tiene cobro todavía, se crea una factura "pendiente" con
--     ese trabajo, y se guarda su id acá.
--   - El batch manual "desde trabajos" avisa si algún trabajo ya tiene
--     cobro (no factura dos veces).
--   - Si en el futuro se agrega "reabrir OS": cobro pendiente se anula,
--     cobro pagado bloquea la reapertura. Hoy no existe reabrir.

alter table ordenes_servicio add column cobro_id uuid references facturas(id) on delete set null;

-- Flag por empresa — default true. Las que facturan por fuera (ej.
-- contra guía semanal) lo apagan y siguen usando "desde trabajos".
alter table empresas add column cobro_automatico_al_firmar boolean not null default true;
