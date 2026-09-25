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
- Etapa 1 (Tarifas) HECHA: migración 141 aplicada en DEV; E2E tarifasViajes 13/13.
- Etapas 2 y 3 HECHAS: forma de cobro en el viaje (PrecioViaje en web: fijo/tramos/km, calcular precio, calcular km con
  ORS vía /api/viajes/tarifas/distancia con caché), servidor arma tramos_detalle/precio_km; chofer no ve costos
  (mis-viajes sinCostos); forma de cobro por defecto en la ficha del cliente; cobro y PDF con "vía" y km (PDF revisado
  visualmente). E2E precioViajes 11/11; total 109/109. ORS_API_KEY aún no configurada (sin clave: 503 "ingresa a mano").
- Etapa 4 (Cotización de viaje) HECHA: migración 142 aplicada en DEV; E2E cotizacionViaje 7/7; total 116/116.
- Build mobile 1.10.18 (vc59) hecho: ~/builds/apk/bitacora-1.10.18-vc59.apk (firma de release verificada, URLs prod).
  JDK: JAVA_HOME del sistema apuntaba a un JDK 11 borrado; se usó /opt/homebrew/opt/openjdk@17. Sin prebuild (el
  android/ tiene la firma de release a mano); versionCode/versionName editados en android/app/build.gradle.
- Pendiente: revisor de la tarea 135 → progress/review_tarifas_135.md; EXPLAIN de índices de 141/142.
- Revisión 135 (progress/review_tarifas_135.md, RECHAZADO sin B) corregida: M1/M2 (recalcula solo si cambian forma,
  paradas, km o cliente; recorrido cambiado sin recalcular → 409, también chofer), M3 (geocoding layers=locality,
  caché de coordenadas, tramos en paralelo, tope 6000 km, clave en header, logs de caché; ORS con clave real PENDIENTE
  de ORS_API_KEY), M4 (cotización de viaje: sin edición de ítems, convertida no se edita/borra, exclusión OS/viaje),
  M6 (limitarDistancia 60/h por empresa), M7 (migración 143 revoke), m1 topes, m2 fecha Chile, m3, m4 sinCostos en
  /api/viajes y cotización, m6/m7 UX, m8 imports, m9 test de Tarifas, m10 anotado (tarea 143, tipo de camión).
  Carrera del viático simultáneo (137-25) corregida con verificación y re-sincronización. E2E 123/123; verificar verde.
  Falta: la usuaria corre 143 en DEV + validar_135.sql (EXPLAIN y grants).
