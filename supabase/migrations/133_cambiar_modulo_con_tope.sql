-- ============================================================
-- Prender/apagar un módulo de una empresa respetando el tope de su
-- plan, sin carreras (tarea 124, etapa 3, 24-sep-2026).
--
-- Antes el backend contaba los módulos activos y después guardaba: dos
-- pedidos simultáneos podían pasar el tope. Ahora todo ocurre en una
-- transacción que bloquea la fila de la empresa (select ... for update),
-- así los cambios de una misma empresa se ordenan uno detrás de otro.
--
-- El backend pasa las reglas que viven en el código (packages/shared):
--   p_contables       módulos que cuentan para el tope (MODULOS_CONTABLES)
--   p_default_activos de esos, los que están activos si no hay fila
--                     (moduloActivadoPorDefecto) — se materializan acá
--                     para que el conteo sea sobre filas reales
--   p_tope            tope del plan (null = sin tope)
-- Devuelve cuántos módulos contables quedaron activos.
-- Error 'TOPE_MODULOS' si activar dejaría a la empresa sobre el tope.
--
-- security invoker (default): solo la llama el backend con service_role.
-- Sin tablas nuevas (no requiere RLS nueva).
-- ============================================================

create or replace function cambiar_modulo_empresa(
  p_empresa_id uuid,
  p_modulo text,
  p_activado boolean,
  p_contables text[],
  p_default_activos text[],
  p_tope integer
) returns integer
language plpgsql
set search_path = public
as $$
declare
  v_activos integer;
begin
  perform 1 from empresas where id = p_empresa_id for update;
  if not found then
    raise exception 'EMPRESA_NO_EXISTE';
  end if;

  -- Filas reales para todos los módulos contables (default del código
  -- donde no había fila), así el conteo no depende de defaults implícitos.
  insert into empresa_modulos (empresa_id, modulo, activado, actualizado_en)
  select p_empresa_id, m, m = any(p_default_activos), now()
  from unnest(p_contables) as m
  on conflict (empresa_id, modulo) do nothing;

  if p_activado and p_tope is not null and p_modulo = any(p_contables) then
    select count(*) into v_activos
    from empresa_modulos
    where empresa_id = p_empresa_id and activado and modulo = any(p_contables) and modulo <> p_modulo;
    if v_activos >= p_tope then
      raise exception 'TOPE_MODULOS';
    end if;
  end if;

  insert into empresa_modulos (empresa_id, modulo, activado, actualizado_en)
  values (p_empresa_id, p_modulo, p_activado, now())
  on conflict (empresa_id, modulo) do update set activado = excluded.activado, actualizado_en = now();

  select count(*) into v_activos
  from empresa_modulos
  where empresa_id = p_empresa_id and activado and modulo = any(p_contables);
  return v_activos;
end;
$$;

-- Solo el backend (service_role). Misma línea que la migración 130: nada
-- se ejecuta directo desde el cliente con la anon key.
revoke execute on function cambiar_modulo_empresa(uuid, text, boolean, text[], text[], integer) from public, anon, authenticated;
grant execute on function cambiar_modulo_empresa(uuid, text, boolean, text[], text[], integer) to service_role;
