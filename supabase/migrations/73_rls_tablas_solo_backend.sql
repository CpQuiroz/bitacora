-- ============================================================
-- SEGURIDAD — cerrar el acceso directo (anon / authenticated) a las
-- tablas que solo debe tocar el backend con la service role.
--
-- Supabase otorga por defecto SELECT/INSERT/UPDATE/DELETE a los roles
-- `anon` y `authenticated` sobre TODA tabla nueva del schema public.
-- El único cerrojo es RLS. Varias tablas "solo backend" se crearon sin
-- `enable row level security` porque se razonó "solo la usa el backend"
-- — pero el backend USA la service role (que bypassa RLS), mientras que
-- cualquiera con la anon key (que va en el bundle del front) podía
-- leer/escribir estas tablas directo vía PostgREST.
--
-- Exposición real encontrada: super_admins (hash de contraseña),
-- mfa_totp_secretos, login_2fa_pendiente, roles / rol_empresas /
-- empresa_accesos_autorizados / empresa_feature_flags (control de
-- acceso — se podía autoinscribir un correo como admin de cualquier
-- empresa), errores_backend, etc.
--
-- Fix: enable RLS SIN políticas (deny-all para anon/authenticated; la
-- service role sigue pasando) + revoke de los grants por si acaso.
-- El frontend nunca lee estas tablas directo (todo pasa por /api/*),
-- así que no rompe nada.
-- ============================================================

do $$
declare
  t text;
  tablas text[] := array[
    'afp_parametros',
    'asignacion_familiar_tramos',
    'empresa_accesos_autorizados',
    'empresa_feature_flags',
    'empresa_modulos',
    'errores_backend',
    'ia_uso',
    'login_2fa_pendiente',
    'mfa_codigo_pendiente',
    'mfa_totp_secretos',
    'parametros_previsionales',
    'rol_empresas',
    'roles',
    'sugerencias_rubro',
    'super_admin_auditoria',
    'super_admins',
    'superadmin_metricas_cache',
    'whatsapp_conversaciones',
    'whatsapp_mensajes_procesados'
  ];
begin
  foreach t in array tablas loop
    if to_regclass('public.' || t) is null then
      raise notice 'tabla public.% no existe, se omite', t;
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
