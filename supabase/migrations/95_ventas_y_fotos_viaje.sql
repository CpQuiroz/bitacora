-- BITÁCORA — Registrar venta con líneas mixtas + fotos por viaje.
-- (Refresco móvil, puntos 6 y 11. Confirmado en el chat antes de migrar.)
--
-- 1. `ventas` / `venta_lineas`: una venta nace SIEMPRE de una cita o de
--    una OS (hereda cliente y servicio), tiene líneas de tipo
--    servicio / producto / pack, y queda PAGADA al instante — no genera
--    cobro pendiente en `facturas`. El historial de dinero del cliente
--    pasa a ser la unión de `facturas` + `ventas` pagadas.
--    - producto: descuenta stock de `catalogo_items` + `inventario_movimientos`
--    - pack: crea la fila en `paquetes_sesiones` (se cobra completo, luego solo se consume)
--    - el precio viene del catálogo y es de solo lectura salvo para
--      perfiles con la acción `facturar` (se resuelve en el backend, sin columna).
--
-- 2. `viaje_fotos`: varias fotos por viaje, subidas por la MISMA cola
--    offline que la firma y el gasto. `viajes.km_inicial` / `km_final`
--    (odómetro) ya existían — no se tocan.

-- ---------- Ventas ----------
create table ventas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete restrict,
  -- Origen obligatorio: no hay venta libre.
  origen_tipo text not null check (origen_tipo in ('cita', 'os')),
  origen_id uuid not null,
  neto numeric not null default 0 check (neto >= 0),
  iva numeric not null default 0 check (iva >= 0),
  total numeric not null default 0 check (total >= 0),
  medio_pago text not null check (medio_pago in ('efectivo', 'transferencia', 'tarjeta')),
  estado text not null default 'pagada' check (estado in ('pagada', 'anulada')),
  pagada_en timestamptz not null default now(),
  registrada_por uuid references usuarios(id) on delete set null,
  creado_en timestamptz not null default now()
);
alter table ventas enable row level security;
create policy "acceso por empresa" on ventas for all using (empresa_id = empresa_actual());
create index on ventas (empresa_id);
create index on ventas (cliente_id);
create index on ventas (origen_tipo, origen_id);

create table venta_lineas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  venta_id uuid not null references ventas(id) on delete cascade,
  tipo text not null check (tipo in ('servicio', 'producto', 'pack')),
  -- servicios.id | catalogo_items.id | tipos_pack.id (según `tipo`).
  referencia_id uuid not null,
  nombre text not null,
  cantidad numeric not null default 1 check (cantidad > 0),
  precio_unitario numeric not null check (precio_unitario >= 0),
  subtotal numeric not null check (subtotal >= 0),
  -- true cuando la línea vino heredada de la cita/OS de origen.
  heredada boolean not null default false,
  -- cuando tipo = 'pack', el paquete de sesiones creado por esta línea.
  paquete_sesiones_id uuid references paquetes_sesiones(id) on delete set null,
  creado_en timestamptz not null default now()
);
alter table venta_lineas enable row level security;
create policy "acceso por empresa" on venta_lineas for all using (empresa_id = empresa_actual());
create index on venta_lineas (venta_id);

-- ---------- Fotos por viaje ----------
create table viaje_fotos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  viaje_id uuid not null references viajes(id) on delete cascade,
  foto_url text not null,
  subida_por uuid references usuarios(id) on delete set null,
  creado_en timestamptz not null default now()
);
alter table viaje_fotos enable row level security;
create policy "acceso por empresa" on viaje_fotos for all using (empresa_id = empresa_actual());
create index on viaje_fotos (viaje_id);
