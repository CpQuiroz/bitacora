# Sesión actual

> Plan, decisiones y bloqueos de la tarea en curso. Al cerrar: resumen a
> `progress/history.md` y vaciar este archivo. Historial anterior al
> 23-sep-2026: `progress/archivo/current_2026-09-11_a_2026-09-23.md`.

## [REEMPLAZADO por el rediseño de más abajo] Tarea 124 — primera versión con packs de rubro — 24-sep-2026

Estado: in_progress. Decisiones de la usuaria (24-sep):
- Precios UF + IVA/mes: Esencial 1,5 · Operación 3,5 · Pro 6 · Empresa desde 12.
- Prueba = todo como Pro, 3 usuarios.
- Packs de Operación: Transporte (viajes, registros, rutas, flota) · Mantención (levantamientos) ·
  Servicios con agenda (agenda_pro). Esencial: agenda, OS, cotizaciones, cobros, gastos, informes, config, grupo.
- IA: Operación trae informe_ia con tope 20/mes; Pro/Empresa/prueba IA completa (informe_ia + asistente + fotos).
- Remuneraciones: adicional (etapa 2, tarea 125); el cambio de plan NO lo toca.
- Empresa: se contrata con tarjeta (Flow, 12 UF) Y también se puede pedir cotización.
- Etapas: 124 = planes/límites/packs/web/Super-Admin; 125 = adicionales; 126 = mobile Mi plan (build).

Diseño:
- Claves internas: se mantiene `basico` (etiqueta "Esencial") y `pro`; se agregan `operacion` y `empresa`.
  Evita migrar datos de planes existentes.
- Shared: `modulosDelPlan(plan, pack)`, `PACKS_RUBRO`, `PRECIO_PLAN_UF`, `ETIQUETA_PLAN`, límites de 5 planes +
  `informesIAPorMes`.
- Migración 131: checks de plan con los 5 valores, `empresas.pack_rubro`, activa los módulos de la prueba en
  empresas en prueba. Las empresas Básico/Pro existentes no cambian de módulos (fundadores).
- Flow: FLOW_PLAN_ID_OPERACION y FLOW_PLAN_ID_EMPRESA nuevas (la usuaria crea los planes en el panel de Flow).
- Clientes actuales: mantienen su suscripción de Flow (precio viejo) porque el plan de Flow no cambia.

Avance (24-sep):
- Hecho y en commit b77203a (verificar.sh verde): shared, migración 131, backend, web Plan + Super-Admin,
  etiquetas mobile (sin build).
- En revisión: subagente revisor → progress/review_planes.md.

Pasos que tiene que hacer la usuaria (no los puede hacer Claude):
1. ~~Correr la migración 131 en prod~~ — HECHO 24-sep (verificado por SELECT).
2. Crear en el panel de Flow los planes: Esencial 1,5 UF, Operación 3,5 UF, Pro 6 UF, Empresa 12 UF
   (revisar si Flow permite plan en UF; si no, en CLP al valor de la UF y actualizarlos cuando suba).
3. En Render: FLOW_PLAN_ID_BASICO (nuevo plan Esencial), FLOW_PLAN_ID_OPERACION, FLOW_PLAN_ID_PRO (nuevo plan Pro),
   FLOW_PLAN_ID_EMPRESA. Las suscripciones actuales siguen con su plan de Flow viejo (precio fundador).

## Tarea 124 — REDISEÑO aprobado por la usuaria (24-sep, tarde). Etapa 1 en curso

Reemplaza a los packs de rubro. El plan fija topes; los módulos los elige el Super-Admin
(y, en la etapa 3, también el Admin de la empresa dentro del tope).
- Prueba: 7 días (antes 21, solo empresas nuevas), 3 usuarios, todo activo, 10 informes IA en toda la prueba.
- Esencial 1,5 UF: 5 usuarios, hasta 6 módulos, 5 informes IA/mes.
- Operación 3,5 UF: 15 usuarios, hasta 10 módulos, 20 informes IA/mes.
- Pro 6 UF: 30 usuarios, todos los módulos, IA completa (informe sin tope, asistente, fotos).
- Empresa desde 12 UF: programado pero apagado (no visible ni contratable por la empresa; el Super-Admin sí puede asignarlo).
- Informe con IA: todos los planes, SOLO rol admin. Asistente y fotos IA: prueba/Pro/Empresa.
- Cambiar de plan NO toca módulos; si los módulos activos superan el tope del plan nuevo → 409 hasta ajustar.
- Un interruptor por ítem del menú; las pestañas internas van con su sección (usuaria, 24-sep: Rendiciones
  dentro de Gastos = 1 módulo; Mantención dentro de Flota = 1). Se mantiene la clave vieja con significado
  acotado (precedente migración 123): `registros` = Clientes (+ nuevas `equipos`, `inventario`, `catalogo`,
  `proveedores`). Mobile 1.10.17 no usa `registros`, así que sigue funcionando.
- Módulos que cuentan para el tope: las 17 secciones del menú. No cuentan: configuracion, gestion_control, informe_ia, asistente.

Etapa 1 (aprobada): shared + migración 132 + backend (+ lo mínimo de web para que nada quede roto:
menú con las claves nuevas, página de Plan sin packs y con Empresa oculto, botones de informe IA solo Admin).
Etapas siguientes, cada una con OK previo: 2 Super-Admin con contador · 3 Configuración > Módulos de la
empresa + "Solicitar más módulos" · 4 mobile (build).

Orden de despliegue: correr la migración 132 en prod ANTES de mergear a main (el backend nuevo exige
las secciones nuevas en los roles; la migración con el backend viejo es inocua).

Etapa 1 — review (progress/review_planes_etapa1.md) RECHAZADO → correcciones:
- H1: una prueba no podía pasar sola a Esencial/Operación (17 módulos > tope y sin pantalla para apagar
  hasta la etapa 3). Ahora el 409 de la empresa le explica y le pide escribir; el Super-Admin ve
  "apaga N en Módulos". Procedimiento manual mientras no exista la etapa 3: el Super-Admin apaga módulos
  desde Panel > Empresa > Módulos y después cambia el plan (o la empresa lo cambia sola).
  Recomendación: no mergear la etapa 1 a main sin la etapa 3.
- H2: Asistente filtrado por plan en /api/me (filtrarModulosVisibles, shared, con tests) → web y mobile
  1.10.17 dejan de mostrarlo en Esencial/Operación.
- H3 (E2E contra DEV): PENDIENTE — no hay backend/.env local para levantar el backend contra DEV.
  Hecho: migración 132 probada en DEV dentro de una transacción revertida (roles OK, idempotente).
- B1/B2/B4/B6/B7 corregidos o documentados. B3 documentado en el código. B5: se corrige en el build de la etapa 4.
- Deuda: borrar `empresas.pack_rubro` (sin uso) → tarea 128.

Pasos de la usuaria para la 132 (cuando se apruebe la etapa): correrla en prod ANTES del merge a main:
  npx supabase db query --linked --project-ref yjbskbskyadxjooxngjv -f supabase/migrations/132_secciones_con_interruptor.sql
  npx supabase migration repair --status applied --linked 132
