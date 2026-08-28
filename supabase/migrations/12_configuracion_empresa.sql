-- ============================================================
-- BITÁCORA — Submódulo Configuración → Empresa: datos fiscales,
-- dirección y medio de pago (marca/colores ya existían).
-- Se ejecuta después de 11_configuracion_cuenta.sql
-- ============================================================
alter table empresas add column razon_social text;
alter table empresas add column rut text;
alter table empresas add column correo_empresa text;
alter table empresas add column telefono_empresa text;
alter table empresas add column whatsapp text;

alter table empresas add column region text;
alter table empresas add column comuna text;
alter table empresas add column direccion_calle text;
alter table empresas add column direccion_numero text;
alter table empresas add column direccion_depto text;

alter table empresas add column pago_activado boolean not null default false;
alter table empresas add column pago_banco text;
alter table empresas add column pago_tipo_cuenta text;
alter table empresas add column pago_numero_cuenta text;
alter table empresas add column pago_titular text;
