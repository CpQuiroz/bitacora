-- BITÁCORA — Registros de mantención de flota.
--
-- Dos tipos de registro sobre un equipo categoría "Vehículo":
--   * 'diario'   — chequeo que hace el chofer antes de salir a ruta.
--                  Siempre interno; realizado_por = su propio usuario.
--   * 'programa' — Programa de Mantención (cada 250 h o 6 meses). Se
--                  hace en un taller / lubricentro autorizado (externo)
--                  o, si la empresa tiene taller propio, interno.
--
-- NO es una OS: va en tabla propia, separada de trabajos/ordenes_servicio,
-- porque no requiere cliente y no debe disparar la facturación automática
-- al firmar (empresas.cobro_automatico_al_firmar). Fase 1 = registro +
-- historial + PDF. El aviso por correo y el cron de vencimiento quedan
-- para fase 2, fuera del alcance de esta migración.
--
-- Los registros son INMUTABLES una vez creados (sin UPDATE/DELETE desde
-- el backend) — mismo principio que las fotos post-firma de una OS. Para
-- corregir algo se crea un registro nuevo con nota en observaciones.

-- ------------------------------------------------------------
-- 1. registros_mantencion_equipo
-- ------------------------------------------------------------
create table registros_mantencion_equipo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  equipo_id uuid not null references equipos(id) on delete cascade,
  tipo text not null check (tipo in ('diario', 'programa')),
  -- Derivado del tipo en la UI (diario ⇒ interno, programa ⇒ externo),
  -- pero se guarda explícito por si a futuro hay que distinguirlo
  -- (ej. un Programa hecho en el taller propio de la empresa).
  origen text not null check (origen in ('interno', 'externo')),
  -- Solo cuando origen = 'externo'.
  proveedor_id uuid references proveedores(id) on delete set null,
  -- Solo cuando origen = 'interno'. Para 'diario' el backend lo fija al
  -- chofer autenticado; para un 'programa' interno lo elige quien registra.
  realizado_por uuid references usuarios(id) on delete set null,
  -- Respuestas del checklist, una fila por ítem:
  --   [{ "seccion": "...", "item": "...", "respuesta": "si" | "no" | "na" }]
  -- Las preguntas vienen de la plantilla "Mantención de flota" en
  -- checklist_templates; acá solo se guardan las respuestas.
  checklist jsonb not null default '[]',
  kilometraje numeric(10,1),
  horas_motor numeric(10,1),
  observaciones text,
  -- Firma del responsable (solo 'programa') — key en el bucket privado,
  -- mismo patrón que ordenes_servicio.firma_url.
  firma_url text,
  -- PDF del registro, generado con pdfkit al crear (igual que las OS).
  pdf_url text,
  creado_por uuid references usuarios(id) on delete set null,
  creado_en timestamptz not null default now(),
  -- Coherencia origen ↔ proveedor / realizado_por.
  constraint mantencion_origen_coherente check (
    (origen = 'externo' and proveedor_id is not null and realizado_por is null)
    or
    (origen = 'interno' and proveedor_id is null)
  )
);
alter table registros_mantencion_equipo enable row level security;
create policy "acceso por empresa" on registros_mantencion_equipo
  for all using (empresa_id = empresa_actual());
create index on registros_mantencion_equipo (empresa_id, equipo_id, creado_en desc);
create index on registros_mantencion_equipo (empresa_id, tipo);

-- ------------------------------------------------------------
-- 2. registro_mantencion_fotos
--    Molde: viaje_fotos (migración 95) — varias fotos por registro,
--    subidas por la misma cola offline que la firma. Tabla aparte (no
--    jsonb) para conservar subida_por / creado_en por foto.
-- ------------------------------------------------------------
create table registro_mantencion_fotos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  registro_id uuid not null references registros_mantencion_equipo(id) on delete cascade,
  foto_url text not null,
  subida_por uuid references usuarios(id) on delete set null,
  creado_en timestamptz not null default now()
);
alter table registro_mantencion_fotos enable row level security;
create policy "acceso por empresa" on registro_mantencion_fotos
  for all using (empresa_id = empresa_actual());
create index on registro_mantencion_fotos (registro_id);

-- ------------------------------------------------------------
-- 3. Plantilla de checklist "Mantención de flota" para empresas
--    existentes. Formato de secciones desde migración 31:
--      [{ nombre, preguntas: [{ texto, obligatorio }] }]
--    Idempotente: no la duplica si ya existe una con ese nombre.
--    Para empresas nuevas la crea el seed por rubro (ver PASO 3).
-- ------------------------------------------------------------
insert into checklist_templates (empresa_id, nombre, descripcion, secciones)
select
  e.id,
  'Mantención de flota',
  'Chequeo diario del camión y Programa de Mantención (250 h / 6 meses).',
  '[
    {"nombre":"Motor y filtros","preguntas":[
      {"texto":"Aceite de motor","obligatorio":true},
      {"texto":"Filtro de aceite del motor","obligatorio":true},
      {"texto":"Filtro de combustible","obligatorio":true},
      {"texto":"Filtro de aire","obligatorio":true},
      {"texto":"Filtro decantador de agua","obligatorio":true},
      {"texto":"Correa de accesorios","obligatorio":true}
    ]},
    {"nombre":"Niveles y fluidos","preguntas":[
      {"texto":"Refrigerante de motor","obligatorio":true},
      {"texto":"Aceite de dirección","obligatorio":true},
      {"texto":"Aceite de diferenciales","obligatorio":true},
      {"texto":"Aceite de mazas ejes direccional","obligatorio":true},
      {"texto":"Aceite de mazas ejes traseros","obligatorio":true},
      {"texto":"Aceite de transmisión","obligatorio":true},
      {"texto":"Líquido limpiaparabrisas","obligatorio":true}
    ]},
    {"nombre":"Embrague y transmisión","preguntas":[
      {"texto":"Ajuste de embrague","obligatorio":true},
      {"texto":"Engrasado de embrague","obligatorio":true},
      {"texto":"Rodamiento de embrague","obligatorio":true},
      {"texto":"Collarín del embrague","obligatorio":true}
    ]},
    {"nombre":"Dirección y suspensión","preguntas":[
      {"texto":"Terminal de dirección","obligatorio":true},
      {"texto":"Rótulas de brazo viajero","obligatorio":true},
      {"texto":"Rótulas de barra estabilizadora","obligatorio":true},
      {"texto":"Pernos de muelle","obligatorio":true},
      {"texto":"Cruceta flecha de dirección","obligatorio":true},
      {"texto":"Crucetas de flecha intereje","obligatorio":true},
      {"texto":"Flechas deslizables","obligatorio":true}
    ]},
    {"nombre":"Frenos","preguntas":[
      {"texto":"Ajustadores de freno delantero","obligatorio":true},
      {"texto":"Ajustadores de frenos traseros","obligatorio":true},
      {"texto":"Sistema de frenos de aire / válvulas","obligatorio":true}
    ]},
    {"nombre":"Neumáticos y eléctrico","preguntas":[
      {"texto":"Presión de neumáticos","obligatorio":true},
      {"texto":"Profundidad banda de rodado","obligatorio":true},
      {"texto":"Estado llanta de repuesto","obligatorio":true},
      {"texto":"Batería y terminales","obligatorio":true},
      {"texto":"Luces y señalización","obligatorio":true}
    ]},
    {"nombre":"Seguridad y documentación","preguntas":[
      {"texto":"Extintor vigente","obligatorio":true},
      {"texto":"Botiquín / kit de emergencia","obligatorio":true},
      {"texto":"Triángulos y conos de seguridad","obligatorio":true}
    ]}
  ]'::jsonb
from empresas e
where not exists (
  select 1 from checklist_templates ct
  where ct.empresa_id = e.id and ct.nombre = 'Mantención de flota'
);
