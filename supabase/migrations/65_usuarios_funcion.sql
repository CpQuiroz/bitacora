-- BITÁCORA — Función / especialidad del colaborador.
--
-- El ROL (admin/supervisor/contador/colaborador) decide QUÉ VE cada
-- persona dentro de su empresa. La FUNCIÓN es más fina y solo aplica a
-- colaboradores: qué HACE en terreno. La usa la app móvil para
-- mostrarle exactamente sus herramientas (un chofer no ve la pestaña de
-- Órdenes de Servicio si no hace OS; un técnico no ve "Mis viajes") y,
-- a futuro, para asignar trabajos por especialidad desde el web.
--
-- Nullable: los usuarios existentes quedan sin función hasta que un
-- admin la setee en "Grupo y usuario" o en la ficha del colaborador
-- (Flota). Sin función, la app cae al default por rubro de la empresa.
alter table usuarios add column funcion text
  check (funcion is null or funcion in ('tecnico', 'chofer', 'instalador', 'administrativo', 'otro'));
