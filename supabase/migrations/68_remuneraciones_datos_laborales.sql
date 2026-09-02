-- BITÁCORA — Módulo Remuneraciones: datos de contrato de cada colaborador.
--
-- Lo que la liquidación necesita y que no vive en `usuarios`: tipo de
-- contrato (cambia el AFC), sistema de salud (Fonasa vs Isapre en UF),
-- AFP, y los haberes fijos pactados (sueldo base, colación, movilización).
-- Una fila por colaborador. La edita el admin/contador desde la ficha
-- del colaborador cuando el módulo está activo.
create table datos_laborales (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,

  tipo_contrato text not null default 'indefinido'
    check (tipo_contrato in ('indefinido', 'plazo_fijo', 'por_obra')),
  fecha_ingreso date,

  sueldo_base numeric(12, 0) not null default 0,        -- imponible
  gratificacion_legal boolean not null default true,    -- aplica Art. 50 con tope
  colacion_mensual numeric(12, 0) not null default 0,   -- no imponible / no tributable
  movilizacion_mensual numeric(12, 0) not null default 0,

  afp text,                                             -- null = no cotiza AFP (excepcional)
  sistema_salud text not null default 'fonasa' check (sistema_salud in ('fonasa', 'isapre')),
  plan_isapre_uf numeric(8, 4),                         -- valor del plan pactado, en UF (si isapre)
  plan_isapre_pesos numeric(12, 0),                     -- alternativa: plan pactado en pesos

  cargas_familiares int not null default 0,             -- >0 solo si la empresa paga asignación familiar
  tasa_mutual_empresa numeric(6, 4),                    -- override de la cotización mutual (adicional por actividad); null = usa la base del período

  activo boolean not null default true,
  actualizado_en timestamptz not null default now()
);

alter table datos_laborales enable row level security;
create policy "acceso por empresa" on datos_laborales
  for all using (empresa_id = empresa_actual());
create index on datos_laborales (empresa_id) where activo;
