-- BITÁCORA — Etapas de cotización a medida de la empresa (Configuración
-- > Cotización), pedido inspirado en el "Estatus de cotización" de
-- 2Workers (Abiertos/Aprobados/Vendidos/Entregados/Cancelados).
--
-- Diseño elegido tras evaluar el riesgo con la usuaria: el `estado` fijo
-- de presupuestos (borrador/enviado/aprobado/rechazado/expirado) maneja
-- lógica real (aprobar/rechazar del Portal del Cliente, bloqueo para
-- convertir a OS, KPIs del dashboard) — reemplazarlo por un pipeline
-- 100% libre exigiría reescribir esa lógica. En vez de eso, "etapa" es
-- una capa de seguimiento interno PURAMENTE cosmética, en paralelo al
-- estado — el estado sigue siendo el único que dispara algo.

create table cotizacion_etapas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  orden int not null default 0,
  creado_en timestamptz not null default now()
);
alter table cotizacion_etapas enable row level security;
create policy "acceso por empresa" on cotizacion_etapas
  for all using (empresa_id = empresa_actual());
create index on cotizacion_etapas (empresa_id, orden);

-- on delete set null: borrar una etapa no debe arrastrar ni bloquear
-- las cotizaciones que la tenían asignada — mismo criterio que el resto
-- del proyecto (deletes condicionales / "desactivar" en vez de eliminar
-- cuando hay referencias, ver docs/harness/arquitectura.md §Invariantes).
alter table presupuestos add column etapa_id uuid references cotizacion_etapas(id) on delete set null;
