-- ============================================================
-- Salud (Super-Admin) — gráficos mensuales: IA, OS creadas, errores y
-- requests lentos salen por agregación pura de tablas que ya tienen
-- fecha (ia_uso, ordenes_servicio, errores_backend, requests_lentos —
-- ver superadmin_tendencia_mensual()). Storage es distinto:
-- empresas.storage_bytes_usado es un CONTADOR (se actualiza en cada
-- subida, ver limites.ts) — no guarda historia, solo el total actual.
-- superadmin_storage_historico guarda una foto por mes para poder
-- graficar la tendencia (pedido 21-sep-2026: "quiero ver mas
-- dashboard... graficos de uso mensuales").
--
-- Sin cron propio (mismo criterio que superadmin_metricas_cache — este
-- proyecto no tiene infraestructura de jobs): la foto del mes se toma
-- perezosamente la primera vez que alguien abre la pantalla de Salud
-- en un mes nuevo. Si un mes entero pasa sin que nadie la abra, ese mes
-- queda sin dato — hueco aceptado en el gráfico para un panel de un
-- solo operador.
-- ============================================================

create table superadmin_storage_historico (
  mes date primary key, -- siempre el día 1 del mes (date_trunc('month', ...))
  bytes_total bigint not null,
  creado_en timestamptz not null default now()
);

-- Mismo criterio que superadmin_metricas_cache (migración 60/73): solo
-- la usa el backend con la service role — deny-all para anon/authenticated.
alter table superadmin_storage_historico enable row level security;
revoke all on superadmin_storage_historico from anon, authenticated;

-- Últimos N meses (incluye el actual) de IA/OS/errores/requests lentos,
-- uno por mes, con ceros donde no hubo actividad ese mes.
create or replace function superadmin_tendencia_mensual(meses int default 12)
returns jsonb
language sql
stable
set search_path = public
as $$
  with serie as (
    select generate_series(
      date_trunc('month', now()) - ((meses - 1) || ' months')::interval,
      date_trunc('month', now()),
      '1 month'::interval
    )::date as mes
  ),
  ia as (
    select date_trunc('month', creado_en)::date as mes, sum(tokens_entrada + tokens_salida) as tokens
    from ia_uso group by 1
  ),
  os as (
    select date_trunc('month', creado_en)::date as mes, count(*) as n
    from ordenes_servicio group by 1
  ),
  err as (
    select date_trunc('month', creado_en)::date as mes, count(*) as n
    from errores_backend group by 1
  ),
  lentos as (
    select date_trunc('month', creado_en)::date as mes, count(*) as n
    from requests_lentos group by 1
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.mes), '[]'::jsonb)
  from (
    select
      to_char(serie.mes, 'YYYY-MM') as mes,
      coalesce(ia.tokens, 0)::bigint as tokens_ia,
      coalesce(os.n, 0)::bigint as os_creadas,
      coalesce(err.n, 0)::bigint as errores,
      coalesce(lentos.n, 0)::bigint as requests_lentos
    from serie
    left join ia on ia.mes = serie.mes
    left join os on os.mes = serie.mes
    left join err on err.mes = serie.mes
    left join lentos on lentos.mes = serie.mes
  ) x;
$$;
-- security invoker (default): el único que la llama es el backend con
-- la service role, que ya ve todas las filas — no hace falta definer
-- (mismo razonamiento que superadmin_metricas_calcular(), migración 60).
-- Sin revoke de EXECUTE: si anon/authenticated la llamaran igual (no
-- hay UI que lo haga), la RLS de cada tabla de abajo sigue aplicando
-- bajo su propia identidad — mismo criterio ya aceptado para
-- superadmin_metricas_calcular(), nunca se le revocó EXECUTE tampoco.
