-- Suscripción y cobro automático a empresas clientes (B2B, vía Flow).
-- estado de facturación separado de empresas.estado (que sigue siendo el
-- gate de acceso general) — cuando la suscripción queda suspendida_por_pago,
-- el código además pone empresas.estado = 'suspendida', reusando ese gate.
create table suscripciones (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  estado text not null default 'trial'
    check (estado in ('trial', 'activa', 'pago_pendiente', 'suspendida_por_pago', 'cancelada')),
  flow_customer_id text,
  flow_subscription_id text,
  tarjeta_ultimos4 text,
  tarjeta_marca text,
  proxima_fecha_cobro date,
  cancelada_en timestamptz,
  trial_aviso_enviado boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
alter table suscripciones enable row level security;
create policy "acceso por empresa" on suscripciones
  for all using (empresa_id = empresa_actual());

create table suscripcion_cobros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  flow_payment_id text,
  monto numeric not null,
  estado text not null check (estado in ('exitoso', 'fallido', 'pendiente')),
  intento_numero int not null default 1,
  error text,
  creado_en timestamptz not null default now()
);
alter table suscripcion_cobros enable row level security;
create policy "acceso por empresa" on suscripcion_cobros
  for all using (empresa_id = empresa_actual());
create index on suscripcion_cobros (empresa_id, creado_en desc);

-- Trial pasa de 14 a 21 días para las empresas que se registren de ahora en
-- adelante (server.ts) — no se toca prueba_termina_en de las que ya existen.
