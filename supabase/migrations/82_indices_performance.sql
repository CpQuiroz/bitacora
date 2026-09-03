-- ============================================================
-- BITÁCORA — Índices de performance (AUDITORIA_PERFORMANCE_COSTOS.md §2)
--
-- Tablas de tenant que se filtran por empresa_id (o responsable_id /
-- cliente_id) en endpoints muy usados y que hoy hacían seq scan.
-- Con el volumen actual (1 cliente piloto) no se nota; se agregan ahora
-- que las tablas están vacías para no tener que hacerlo con la tabla
-- llena después.
--
-- `if not exists` por si alguna se agregó a mano en el ínterin.
-- ============================================================
create index if not exists usuarios_empresa_id_idx on usuarios (empresa_id);
create index if not exists inventario_empresa_id_idx on inventario (empresa_id);
create index if not exists inventario_movimientos_empresa_creado_idx on inventario_movimientos (empresa_id, creado_en desc);
create index if not exists accesos_usuario_empresa_creado_idx on accesos_usuario (empresa_id, creado_en desc);

-- trabajos: el scope de colaborador (.eq("responsable_id", userId)) y la
-- ficha de cliente (.eq("cliente_id", ...)) corren seguido y hoy no
-- tienen índice propio (solo (empresa_id, fecha) y (empresa_id, equipo_id)).
create index if not exists trabajos_responsable_id_idx on trabajos (responsable_id) where responsable_id is not null;
create index if not exists trabajos_cliente_id_idx on trabajos (cliente_id) where cliente_id is not null;

-- facturas / viajes: filtros por cliente_id (ficha, Portal) y chofer_id.
create index if not exists facturas_cliente_id_idx on facturas (cliente_id) where cliente_id is not null;
create index if not exists viajes_chofer_id_idx on viajes (chofer_id) where chofer_id is not null;
