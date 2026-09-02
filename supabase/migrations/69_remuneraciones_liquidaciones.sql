-- BITÁCORA — Módulo Remuneraciones: liquidaciones de sueldo emitidas.
--
-- Una fila por colaborador y período. Se genera como 'borrador'
-- (editable en los haberes variables), y al 'emitir' se congela y se
-- genera el PDF. `detalle` guarda el snapshot completo del cálculo y de
-- los parámetros usados — fuente de verdad inmutable para re-explicar
-- una liquidación vieja.
create table liquidaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete set null,
  periodo text not null,                                -- 'YYYY-MM'
  dias_trabajados int not null default 30,

  -- Haberes
  sueldo_base numeric(12, 0) not null default 0,
  gratificacion numeric(12, 0) not null default 0,
  horas_extra numeric(12, 0) not null default 0,
  otros_imponibles numeric(12, 0) not null default 0,   -- bonos, comisiones
  colacion numeric(12, 0) not null default 0,
  movilizacion numeric(12, 0) not null default 0,
  otros_no_imponibles numeric(12, 0) not null default 0,
  asignacion_familiar numeric(12, 0) not null default 0,
  total_haberes numeric(12, 0) not null default 0,

  base_imponible numeric(12, 0) not null default 0,
  base_tributable numeric(12, 0) not null default 0,

  -- Descuentos
  cotizacion_afp numeric(12, 0) not null default 0,     -- 10%
  comision_afp numeric(12, 0) not null default 0,
  cotizacion_salud numeric(12, 0) not null default 0,   -- 7% legal
  salud_adicional numeric(12, 0) not null default 0,    -- diferencia plan isapre - 7%
  cotizacion_afc numeric(12, 0) not null default 0,     -- 0,6% trabajador (0 si plazo fijo)
  impuesto_unico numeric(12, 0) not null default 0,
  otros_descuentos numeric(12, 0) not null default 0,   -- APV, préstamos, anticipos
  total_descuentos numeric(12, 0) not null default 0,

  liquido_pagar numeric(12, 0) not null default 0,

  -- Costo empresa (informativo, no sale de la liquidación)
  aporte_afc_empleador numeric(12, 0) not null default 0,  -- 2,4% indef / 3% plazo
  aporte_sis numeric(12, 0) not null default 0,
  aporte_mutual numeric(12, 0) not null default 0,

  detalle jsonb not null default '{}'::jsonb,           -- snapshot del cálculo + parámetros
  pdf_url text,
  estado text not null default 'borrador' check (estado in ('borrador', 'emitida')),

  creado_por uuid references usuarios(id) on delete set null,
  emitida_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  unique (empresa_id, usuario_id, periodo)
);

alter table liquidaciones enable row level security;
create policy "acceso por empresa" on liquidaciones
  for all using (empresa_id = empresa_actual());
create index on liquidaciones (empresa_id, periodo);
