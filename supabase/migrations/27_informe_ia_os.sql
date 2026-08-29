-- BITÁCORA — Informe técnico con IA para una Orden de Servicio
-- puntual (distinto del "Informe IA" de negocio, que agrega datos de
-- muchas OS). Redacta un informe a partir de los campos personalizados
-- del tipo de trabajo (ej. pH, cloro, turbidez para mantención de
-- tratamiento de agua), el checklist y el análisis de las fotos.
alter table ordenes_servicio add column informe_ia text;
