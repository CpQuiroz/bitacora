-- ============================================================
-- Dashboard global del Panel de Super-Admin — vista agregada entre
-- todas las empresas (MRR aproximado, churn, uso, outliers de costo).
--
-- La query es cara (agrega ia_uso y suscripcion_cobros de todas las
-- empresas), así que NO se recalcula en cada request: el backend guarda
-- un snapshot en superadmin_metricas_cache y lo refresca solo si tiene
-- más de ~15 min. Mismo criterio de "contador aproximado" que ya se usa
-- para empresas.storage_bytes_usado — sin agregar un cron nuevo (este
-- proyecto no tiene infraestructura de jobs).
-- ============================================================

create table superadmin_metricas_cache (
  id smallint primary key default 1 check (id = 1),
  datos jsonb not null,
  generado_en timestamptz not null default now()
);
-- Sin RLS: mismo criterio que super_admins / super_admin_auditoria —
-- el backend "normal" (con empresa_actual()) nunca toca esta tabla.

-- Calcula todas las métricas del dashboard global en una sola pasada.
-- security definer + search_path fijo por consistencia con las demás
-- funciones del proyecto; en la práctica el backend la llama con la
-- service role, que ya ve todas las filas.
create or replace function superadmin_metricas_calcular()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inicio_mes      date := date_trunc('month', now())::date;
  inicio_mes_ant  date := (date_trunc('month', now()) - interval '1 month')::date;
  hace_30d        timestamptz := now() - interval '30 days';
  mrr_actual      numeric;
  mrr_anterior    numeric;
  cancel_30d      int;
  activas_ahora   int;
begin
  -- MRR aproximado: suma de cobros de suscripción exitosos del mes.
  -- NO es "revenue reconocido" contable — es una aproximación operativa
  -- para ver la tendencia mes a mes.
  select coalesce(sum(monto), 0) into mrr_actual
    from suscripcion_cobros
    where estado = 'exitoso' and creado_en >= inicio_mes;

  select coalesce(sum(monto), 0) into mrr_anterior
    from suscripcion_cobros
    where estado = 'exitoso' and creado_en >= inicio_mes_ant and creado_en < inicio_mes;

  -- Churn simple: canceladas en los últimos 30 días sobre la base
  -- (canceladas + activas/pago_pendiente ahora). Aproximación — no hay
  -- historial de estado de suscripción para un cálculo exacto de
  -- "activas al inicio del período".
  select count(*) into cancel_30d
    from suscripciones
    where estado = 'cancelada' and cancelada_en >= hace_30d;

  select count(*) into activas_ahora
    from suscripciones
    where estado in ('activa', 'pago_pendiente');

  return jsonb_build_object(
    -- Empresas por estado de SUSCRIPCIÓN (trial/activa/pago_pendiente/
    -- suspendida_por_pago/cancelada). Una empresa sin fila en
    -- suscripciones nunca registró tarjeta -> cuenta como 'trial'.
    'empresas_por_estado_suscripcion', (
      select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb) from (
        select coalesce(s.estado, 'trial') as estado, count(*) as n
        from empresas e
        left join suscripciones s on s.empresa_id = e.id
        group by 1
      ) t
    ),
    -- Empresas por estado OPERATIVO (activa/suspendida/dada_de_baja) —
    -- eje distinto del de suscripción.
    'empresas_por_estado_operativo', (
      select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb) from (
        select estado, count(*) as n from empresas group by 1
      ) t
    ),
    'empresas_por_rubro', (
      select coalesce(jsonb_object_agg(rubro, n), '{}'::jsonb) from (
        select rubro, count(*) as n from empresas group by 1
      ) t
    ),
    'total_empresas', (select count(*) from empresas),
    'mrr', jsonb_build_object(
      'mes_actual', mrr_actual,
      'mes_anterior', mrr_anterior,
      'variacion_pct', case
        when mrr_anterior = 0 then null
        else round(((mrr_actual - mrr_anterior) / mrr_anterior) * 100, 1)
      end
    ),
    'churn', jsonb_build_object(
      'canceladas_30d', cancel_30d,
      'base', cancel_30d + activas_ahora,
      'tasa_pct', case
        when (cancel_30d + activas_ahora) = 0 then null
        else round((cancel_30d::numeric / (cancel_30d + activas_ahora)) * 100, 1)
      end
    ),
    'uso_mes', jsonb_build_object(
      'os_creadas', (select count(*) from ordenes_servicio where creado_en >= inicio_mes),
      'tokens_ia', (select coalesce(sum(tokens_entrada + tokens_salida), 0) from ia_uso where creado_en >= inicio_mes),
      'storage_bytes_total', (select coalesce(sum(storage_bytes_usado), 0) from empresas)
    ),
    -- Outliers de costo: top 5 por consumo de IA del mes y por storage.
    'top_ia', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
        select e.id, e.nombre, coalesce(sum(iu.tokens_entrada + iu.tokens_salida), 0)::bigint as tokens
        from empresas e
        join ia_uso iu on iu.empresa_id = e.id and iu.creado_en >= inicio_mes
        group by e.id, e.nombre
        order by tokens desc
        limit 5
      ) t
    ),
    'top_storage', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
        select id, nombre, storage_bytes_usado::bigint as bytes
        from empresas
        where storage_bytes_usado > 0
        order by storage_bytes_usado desc
        limit 5
      ) t
    )
  );
end;
$$;
