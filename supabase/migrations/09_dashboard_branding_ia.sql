-- ============================================================
-- BITÁCORA — Dashboard de KPIs, marca configurable e Informes IA
-- estructurados. Se ejecuta después de 08_ordenes_servicio_digitales.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. MARCA — color primario configurable (+ color de texto sobre
--    la marca, calculado por luminancia al guardar) y moneda.
-- ------------------------------------------------------------
alter table empresas add column color_primario text;
alter table empresas add column color_primario_foreground text;
alter table empresas add column moneda text not null default 'CLP';

-- ------------------------------------------------------------
-- 2. GASTOS — ledger transaccional (separado de gastos_fijos, que
--    son solo plantillas recurrentes y quedan intactas). "Vencido"
--    se calcula al vuelo (pendiente + fecha < hoy), no se guarda.
-- ------------------------------------------------------------
create table gastos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  categoria text not null,
  descripcion text,
  monto numeric(12,2) not null,
  fecha date not null,
  estado text not null default 'pendiente' check (estado in ('pagado', 'pendiente')),
  fecha_pago date,
  creado_en timestamptz default now()
);

alter table gastos enable row level security;
create policy "acceso por empresa" on gastos
  for all using (empresa_id = empresa_actual());

create index idx_gastos_transaccion_empresa on gastos(empresa_id, fecha, estado);

-- ------------------------------------------------------------
-- 3. PRESUPUESTOS / COTIZACIONES — tan simple como facturas (sin
--    ítems, un monto total). trabajo_id se linkea cuando el
--    presupuesto se convierte en una OT real (mide conversión).
-- ------------------------------------------------------------
create table presupuestos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente_id uuid references clientes(id),
  descripcion text,
  monto numeric(12,2) not null,
  fecha date not null,
  estado text not null default 'enviado'
    check (estado in ('enviado', 'aprobado', 'rechazado', 'expirado')),
  trabajo_id uuid references trabajos(id) on delete set null,
  creado_en timestamptz default now()
);

alter table presupuestos enable row level security;
create policy "acceso por empresa" on presupuestos
  for all using (empresa_id = empresa_actual());

create index idx_presupuestos_empresa on presupuestos(empresa_id, fecha, estado);

-- ------------------------------------------------------------
-- 4. INFORMES GENERADOS — historial de "Informe con IA"
--    estructurado, y a la vez caché (mismo empresa+tipo+rango+
--    pregunta dentro de 60s devuelve la misma fila en vez de
--    volver a llamar a Claude).
-- ------------------------------------------------------------
create table informes_generados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid references usuarios(id),
  tipo text not null check (tipo in ('financiero', 'operativo', 'clientes', 'colaboradores')),
  desde date not null,
  hasta date not null,
  pregunta text,
  resultado text,
  datos_agregados jsonb not null default '{}',
  creado_en timestamptz default now()
);

alter table informes_generados enable row level security;
create policy "acceso por empresa" on informes_generados
  for all using (empresa_id = empresa_actual());

create index idx_informes_generados_cache
  on informes_generados(empresa_id, tipo, desde, hasta, creado_en desc);
