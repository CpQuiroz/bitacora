# Sesión actual

> Plan, decisiones y bloqueos de la tarea en curso. Al cerrar: resumen a
> `progress/history.md` y vaciar este archivo. Historial anterior al
> 23-sep-2026: `progress/archivo/current_2026-09-11_a_2026-09-23.md`.

## Tarea 144 — Salida a prod PASO 1 (en curso, 25-sep)
Diagnóstico PASO 0 entregado y aprobado ("Ok"). Decisiones en trabajo_list.json #144. Tarea 135 queda `blocked` (solo
falta ORS_API_KEY + migraciones 141-143 en prod; EXPLAIN y grants de DEV verificados 25-sep). Tipo de OS → tarea 145.
1. Prueba vencida — HECHO (falta E2E):
   - shared: pruebaVencida, fechaPruebaExtendida, sumarDiasFecha, MAX_DIAS_EXTENSION_PRUEBA (+ tests).
   - backend/src/empresaOperativa.ts: empresaConPruebaVencida (hoy en Chile), empresaOperativa (entradas públicas),
     rutaPermitidaConPruebaVencida (plan, suscripcion, modulos, usuarios/me*, notificaciones-feed/preferencias).
     Decisión: DELETE /api/empresa NO queda abierto (borra la empresa de verdad; regla "nunca borrar datos").
   - requiereEmpresa usa eso; /api/me devuelve prueba_vencida y no dispara cumpleaños a clientes si venció.
   - Portal (requierePortal + link + login por RUT), reserva online y bot de WhatsApp cortados si no está operativa.
   - Super-Admin: POST /empresas/:id/prueba/extender {dias}, /reactivar (DIAS_PRUEBA desde hoy), GET /prueba/historial
     (super_admin_auditoria); PATCH fecha exacta valida no-pasado. Solo plan trial (409 si tiene plan pago).
     Web: tarjeta "Período de prueba" (antes estaba dentro de Suscripción y no se veía sin suscripción).
   - Web: DashboardShell con menú "Tu cuenta" (Plan y pago si gestionar_plan, Mi cuenta, Seguridad), aviso arriba,
     redirección; Configuración filtra a cuenta/plan/modulos/seguridad.
   - Mobile: fase "prueba-vencida" (PruebaVencidaScreen + Mi plan + Perfil + cerrar sesión, sin botón de pago por
     Play); api.ts avisa TRIAL_VENCIDO y AuthProvider re-lee /api/me. Requiere build.
2. Integraciones — HECHO: shared INTEGRACIONES_VISIBLES=false; /api/integraciones 404, generar-link-pago 410; nav y
   página web ocultas (redirige); columna "Link de pago" fuera de Cobros web; botón "Abrir link de pago" fuera de mobile;
   el asistente ya no lee la tabla integraciones.
3. Leyenda viático — HECHO: fuera de Viajes web y de la ficha del chofer (mobile; test ajustado). Monto por viaje sigue
   editable (CampoViatico). Super-Admin: GET/PATCH /empresas/:id/viaticos con auditoría + tarjeta en la ficha.
4. Rubro + sugerencias — HECHO (falta migración 144 en DEV): seedRubro solo siembra checklists de transporte; rubro sin
   default y obligatorio en onboarding y alta del Super-Admin; migración 144 (cosmetologia, tipos servicio/tipo_pack,
   columna datos, textos para 4 rubros); componente web SugerenciasRubro en Servicios y Tipos de pack (Agenda Pro config).
   Mobile: los modales de servicio/pack viven en la pestaña Agenda (congelada) → sin sugerencias ahí. Gasto mobile avisa
   si no hay categorías y el usuario no puede crearlas.
Revisión (progress/review_144.md, RECHAZADO sin B) corregida: M1 Mi cuenta con lista cerrada (/me/vehiculo bloqueado),
M2 empresaOperativa.test.ts + E2E portal por RUT/reservar/vehículo, m1 segmento en shell, m2 ocultar Eliminar empresa,
m3 reactivar no acorta, m4 tope PATCH, m5 filas afectadas, m6 fecha de alta en Chile, m7 portal sin N+1, m8 cola mobile
queda pendiente con TRIAL_VENCIDO y sin "Descartar" en la pila bloqueada, m9 2FA antes que prueba vencida en mobile.
Pendiente con la usuaria: m10 (encuesta pública) e impersonación bloqueada con prueba vencida. m11: se deja select("*")
a propósito (datos llega con la 144). Commit 427dd23. Build 1.10.19 (vc60): ~/builds/apk/bitacora-1.10.19-vc60.apk (a094534).
Migración 144 aplicada en DEV (25-sep, por Claude vía Supabase MCP a pedido de la usuaria). E2E pruebaVencida 34/34, total 157/157. (antes 28/30 (144-29/30 esperan migración 144); total 151/153. verificar verde. Commits 7b911a1 + este.

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
