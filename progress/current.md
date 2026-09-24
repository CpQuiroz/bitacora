# Sesión actual

> Plan, decisiones y bloqueos de la tarea en curso. Al cerrar: resumen a
> `progress/history.md` y vaciar este archivo. Historial anterior al
> 23-sep-2026: `progress/archivo/current_2026-09-11_a_2026-09-23.md`.

## Tarea 124 — Planes nuevos: Esencial, Operación, Pro, Empresa (etapa 1) — 24-sep-2026

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
