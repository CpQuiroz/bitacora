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
