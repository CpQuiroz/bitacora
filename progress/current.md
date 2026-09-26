# Sesión actual

> Plan, decisiones y bloqueos de la tarea en curso. Al cerrar: resumen a
> `progress/history.md` y vaciar este archivo. Historial anterior al
> 23-sep-2026: `progress/archivo/current_2026-09-11_a_2026-09-23.md`.

## Tarea 156 — Feedback unificado (ronda 4 auditoría UX) — en curso

**Decisiones del humano (26-sep, "si"):** errores de red/guardado en mobile
→ toast rojo; alerta solo si hay que decidir algo. Deshacer = ocultar y
ejecutar la API tras 5 s (si se cierra la pestaña antes, no se borra).

**Plan:**
1. Primitivas (yo): Toast con tono/acción/duración (web+native);
   `ConfirmarProvider` + `useConfirmar()` (Promise<boolean>); `useDeshacer()`.
   Montar en DashboardShell, PortalShell, SuperAdmin y raíz mobile.
2. Migración web (implementador) → `progress/impl_feedback_web.md`.
3. Migración mobile (implementador) → `progress/impl_feedback_mobile.md`.
4. Revisor → `progress/review_feedback.md`.
5. Check en verificar.sh contra confirm()/alert()/Alert.alert de confirmación.

**Revisión (progress/review_feedback.md): CAMBIOS REQUERIDOS → corregidos:**
- A1 iOS: capa de toasts en `FullWindowOverlay` (encima de pantallas modales y <Modal>); toast sube sobre el teclado en iOS.
- A2 iOS: FotosSection cierra el visor antes de confirmar.
- M1 web: pila de diálogos; Escape cierra solo el de arriba (test).
- M2 web: `web/src/lib/useOcultos.ts` en tarifas, rendición, trabajos/[id], RegistrosMantencion.
- B1: avisos de geocodificación 8 s. B2: confirmación se cancela al navegar. B3: ConfirmarProvider con marca en mobile.
- Pendiente humano: M3 (viáticos "Marcar pagado" con Deshacer vs. inmediato). B4 queda como está.
