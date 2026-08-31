-- Límites de uso por plan (packages/shared/src/limites.ts,
-- LIMITES_POR_PLAN) — solo necesita un contador de storage: usuarios
-- se cuenta con select count(*) sobre usuarios, OS/mes con select
-- count(*) sobre trabajos filtrado por fecha, IA con sum() sobre
-- ia_uso — ninguno necesita columna propia. Storage sí, porque medir
-- el uso real escaneando los buckets S3 (medirUsoStorage, para el
-- Panel de Super-Admin) es demasiado lento para correr en cada subida
-- de archivo — acá se lleva un contador aproximado, incrementado por
-- la propia app en cada subida (backend/src/storage.ts), no un total
-- exacto recalculado.
alter table empresas add column storage_bytes_usado bigint not null default 0;

create or replace function incrementar_storage_usado(p_empresa_id uuid, p_bytes bigint)
returns void as $$
begin
  update empresas
  set storage_bytes_usado = storage_bytes_usado + p_bytes
  where id = p_empresa_id;
end;
$$ language plpgsql;
