-- ============================================================
-- SEGURIDAD — cerrar el acceso directo vía PostgREST (anon /
-- authenticated) a TODAS las tablas del schema public (24-sep-2026).
--
-- Continuación de la migración 73 (que lo hizo solo para las tablas
-- "solo backend"). Hallazgo de la auditoría pre-cobro: Supabase otorga
-- por defecto SELECT/INSERT/UPDATE/DELETE a `anon` y `authenticated`
-- sobre toda tabla nueva, y 68 políticas son `for all using (empresa_id
-- = empresa_actual())`. Resultado: cualquier usuario con sesión — un
-- colaborador incluido — podía, con la anon key del bundle y su JWT,
-- escribir directo en su propia `suscripciones` / `suscripcion_cobros`
-- / `empresa_plan_historial` (verificado en prod), editar una OS ya
-- firmada o leer liquidaciones de sueldo, saltándose los permisos por
-- rol, los límites del plan y las invariantes que valida el backend.
--
-- Ni la web ni el mobile leen/escriben tablas directo: todo pasa por
-- /api/* (backend con service role, que no depende de estos grants).
-- El cliente de Supabase solo se usa para Auth. Por eso esto no rompe
-- nada y deja al backend como único camino de escritura/lectura.
--
-- RLS y sus políticas se MANTIENEN (defensa en profundidad; ver
-- docs/harness/arquitectura.md — RLS y filtrado por empresa_id son
-- complementarios). Esto solo quita los grants de tabla.
-- Idempotente.
-- ============================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Funciones: todas son SECURITY INVOKER, así que sin grants de tabla ya
-- no pueden tocar datos; igual se quita el EXECUTE para que no queden
-- expuestas en /rest/v1/rpc. empresa_actual() se deja: la usan las
-- políticas RLS.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname <> 'empresa_actual'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.firma);
  end loop;
end $$;

-- Que las tablas, secuencias y funciones NUEVAS nazcan cerradas (antes
-- cada migración tenía que acordarse de hacerlo).
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
