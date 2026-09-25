# Sesión actual

> Plan, decisiones y bloqueos de la tarea en curso. Al cerrar: resumen a
> `progress/history.md` y vaciar este archivo. Historial anterior al
> 23-sep-2026: `progress/archivo/current_2026-09-11_a_2026-09-23.md`.

## Tarea 135 — Precio por tramos y por km + Cotización de viaje (en curso, 24-sep noche)
Propuesta base: docs/PROPUESTA_PRECIOS_VIAJES.md §2 (aprobada). Decisiones de la usuaria: km con mapa (origen/destino del
Admin) → OpenRouteService con caché de distancias (ORS_API_KEY la crea ella); tramo simétrico; tarifas y detalle solo
Admin/Supervisor. rutas_planificadas NO sirve de plantilla (son rutas de técnicos): los tramos viven en el viaje
(viajes.tramos_detalle) y los precios en tarifas_tramo.
Etapas: 1 Tarifas (tablas + Viajes › Tarifas) · 2 precio en el viaje (modo fijo/tramos/km, calcular km) · 3 modo por
cliente + cobro/PDF con km/tramos · 4 Cotización de viaje (Cotizaciones + convertir en viaje).
