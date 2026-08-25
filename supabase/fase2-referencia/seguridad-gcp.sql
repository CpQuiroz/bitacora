-- ============================================================
-- BITÁCORA — Seguridad portable para Cloud SQL (Google Cloud)
-- Reemplaza la dependencia de auth.uid() de Supabase
-- ============================================================

-- ------------------------------------------------------------
-- CÓMO FUNCIONA:
-- Tu backend (Cloud Run) verifica el token JWT de Firebase
-- en cada request. Si es válido, antes de correr la consulta
-- ejecuta:
--   SET LOCAL app.current_user_id = '<uid_verificado>';
-- Esa variable de sesión es lo que Postgres usa para RLS.
-- El usuario JAMÁS puede setear esta variable directamente:
-- solo la setea tu backend, después de validar el token.
-- ------------------------------------------------------------

-- Reemplaza la función empresa_actual() de bitacora-schema.sql
create or replace function empresa_actual()
returns uuid as $$
  select empresa_id from usuarios
  where id = nullif(current_setting('app.current_user_id', true), '')::uuid;
$$ language sql stable;

-- ------------------------------------------------------------
-- Verificación extra: función para confirmar que hay un
-- usuario autenticado antes de permitir CUALQUIER operación
-- (defensa adicional, no solo confiar en RLS)
-- ------------------------------------------------------------
create or replace function usuario_autenticado()
returns boolean as $$
  select current_setting('app.current_user_id', true) is not null
     and current_setting('app.current_user_id', true) != '';
$$ language sql stable;

-- Ejemplo de cómo se refuerza una política existente:
drop policy if exists "acceso por empresa" on trabajos;
create policy "acceso por empresa" on trabajos
  for all using (
    usuario_autenticado() and empresa_id = empresa_actual()
  );

-- ------------------------------------------------------------
-- BUENAS PRÁCTICAS ADICIONALES (a nivel de infraestructura,
-- no de SQL — van en la configuración de Cloud SQL / Cloud Run):
-- ------------------------------------------------------------
-- 1. Cloud SQL solo con IP privada + Cloud SQL Auth Proxy
--    (nunca exponer la base de datos con IP pública)
-- 2. Un usuario Postgres de solo-aplicación (no el usuario admin)
--    con permisos limitados a las tablas necesarias
-- 3. Secretos (contraseñas, claves de API) en Google Secret Manager,
--    nunca en variables de entorno en texto plano ni en el repo
-- 4. Service accounts separadas por servicio (Cloud Run backend
--    ≠ service account de las Cloud Functions de IA), cada una
--    con el mínimo permiso necesario (principio de menor privilegio)
-- 5. Cloud Armor delante de Cloud Run para limitar tasa de requests
--    y bloquear IPs abusivas
-- 6. Storage buckets privados + URLs firmadas con expiración corta
--    para las fotos (nunca buckets públicos)
-- 7. Logs de auditoría activados (Cloud Audit Logs) para saber
--    quién accedió a qué y cuándo
