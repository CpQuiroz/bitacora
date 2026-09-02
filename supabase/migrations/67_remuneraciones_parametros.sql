-- BITÁCORA — Módulo Remuneraciones (opt-in): parámetros previsionales.
--
-- Indicadores que cambian mes a mes (UF, UTM, sueldo mínimo) o ~1 vez
-- al año (topes imponibles, tabla de impuesto único, comisiones AFP).
-- UF/UTM/ingreso mínimo se traen automáticamente de mindicador.cl; el
-- resto se siembra y se edita a mano cuando la ley cambia.
--
-- Cada liquidación guarda un SNAPSHOT de los parámetros que usó (ver
-- liquidaciones.detalle), así una liquidación vieja siempre se puede
-- re-explicar aunque estos valores cambien después.
create table parametros_previsionales (
  periodo text primary key,                            -- 'YYYY-MM'
  uf numeric(12, 2) not null,                           -- UF a usar para topes del período
  utm numeric(12, 2) not null,
  ingreso_minimo numeric(12, 0) not null,               -- ingreso mínimo mensual (IMM)
  tope_imponible_uf numeric(6, 2) not null,             -- AFP + salud
  tope_afc_uf numeric(6, 2) not null,                   -- seguro de cesantía
  tope_gratificacion_mensual numeric(12, 0) not null,   -- 4,75 * IMM / 12 (Art. 50)
  tasa_sis numeric(6, 4) not null default 0.0188,       -- aporte empleador (SIS)
  tasa_mutual_base numeric(6, 4) not null default 0.0090, -- cotización básica mutual (empleador)
  -- Tabla progresiva del Impuesto Único de 2ª Categoría, tramos en UTM:
  -- [{ "desde": 0, "hasta": 13.5, "factor": 0, "rebaja": 0 }, ...]
  tramos_impuesto jsonb not null,
  fuente text not null default 'manual',                -- 'mindicador' | 'manual'
  actualizado_en timestamptz not null default now()
);

-- Comisión y código de institución de cada AFP, por período (las
-- comisiones cambian ocasionalmente; el código Previred es fijo pero
-- se guarda por período para no hardcodearlo en el archivo de carga).
create table afp_parametros (
  periodo text not null references parametros_previsionales(periodo) on delete cascade,
  afp text not null,                                    -- 'capital','cuprum','habitat','modelo','planvital','provida','uno'
  nombre text not null,
  codigo_previred text not null,
  tasa_comision numeric(6, 4) not null,                 -- ej. 0.0058 .. 0.0145 (sobre base imponible)
  primary key (periodo, afp)
);

-- Asignación familiar — solo se usa si la empresa activa la opción
-- (datos_laborales.cargas_familiares > 0). Tramos por renta, montos por
-- carga. Se deja modelada; en v1 no se siembra (la mayoría de las pymes
-- de servicio no la paga).
create table asignacion_familiar_tramos (
  periodo text not null references parametros_previsionales(periodo) on delete cascade,
  tramo int not null,                                   -- 1..4 (4 = sin derecho)
  renta_desde numeric(12, 0) not null,
  renta_hasta numeric(12, 0),                           -- null = sin tope superior
  monto_por_carga numeric(12, 0) not null,
  primary key (periodo, tramo)
);

-- Sin RLS — los parámetros son datos de referencia comunes a todas las
-- empresas (no llevan empresa_id). Solo los toca el backend.
