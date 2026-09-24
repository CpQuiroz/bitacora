-- ============================================================
-- BITÁCORA — Búsqueda del chofer por WhatsApp con índice (tarea 141,
-- auditoría de índices C2, 24-sep-2026).
--
-- Antes: por cada mensaje entrante el webhook leía TODOS los
-- colaboradores con teléfono de TODAS las empresas y los comparaba en
-- memoria (routes/whatsapp.ts buscarChofer). Ahora filtra en la base por
-- los últimos 8 dígitos del teléfono (el número de abonado en Chile).
--
-- Columna GENERADA: Postgres la mantiene sola, sin importar desde dónde
-- se guarde el teléfono (web, app, Super-Admin). Mismo criterio que
-- normalizarTelefono (backend/src/whatsapp.ts): solo dígitos.
-- Aditiva e idempotente.
-- ============================================================
alter table usuarios add column if not exists telefono_sufijo text
  generated always as (
    case
      when length(regexp_replace(coalesce(telefono, ''), '\D', '', 'g')) >= 8
      then right(regexp_replace(telefono, '\D', '', 'g'), 8)
    end
  ) stored;

create index if not exists idx_usuarios_telefono_sufijo
  on usuarios (telefono_sufijo) where telefono_sufijo is not null;
