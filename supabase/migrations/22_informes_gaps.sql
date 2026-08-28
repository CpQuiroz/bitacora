-- BITÁCORA — Cierra 3 huecos de datos que el módulo de Informes dejó
-- en evidencia: un gasto no podía vincularse a una OS específica, una
-- OS no podía clasificarse por Tipo de OS, y un cliente no tenía
-- comuna registrada.

-- Informes → Gastos en OS: gastos vinculados a una Orden de Servicio
-- específica (Financiero → Gastos ya permite elegirla al crear/editar).
alter table gastos add column trabajo_id uuid references trabajos(id) on delete set null;

-- Informes → Servicios: distribución de OS por Tipo de OS
-- (Configuración → Tipos de OS). Se completa desde "Nueva OS".
alter table trabajos add column tipo_os_id uuid references tipos_os(id) on delete set null;

-- Informes → Clientes: distribución por comuna.
alter table clientes add column comuna text;
