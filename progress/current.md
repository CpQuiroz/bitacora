# Sesión actual

> Plan, decisiones y bloqueos de la tarea en curso. Al cerrar: resumen a
> `progress/history.md` y vaciar este archivo. Historial anterior al
> 23-sep-2026: `progress/archivo/current_2026-09-11_a_2026-09-23.md`.

## Tarea 148 — Ficha del equipo en pestañas + fila clicable (en curso, 25-sep)
Aprobado por la usuaria (referencia Fleetio): Resumen · Mantención (plan + registros) · OS · Viajes (monto solo Admin/
Supervisor) · Documentos · Eventos, en web y mobile; lista de Equipos web: clic/doble clic/Enter abre la ficha y las
acciones van en el menú ⋯. Regla en docs/harness/convenciones.md §Listas y tablas; resto de tablas → tarea 149.
- Commit 9f1de19 (implementación). E2E 148-1 (viajes por equipo) verde; total 179/179.
- Revisión (progress/review_148.md, RECHAZADO: 1 B, 5 M, 10 m) corregida: B1 menú ⋯ con posición fija (no lo recorta
  el scroll de la tabla); M1/M2 sin onDoubleClick, el clic ignora detail>1 (doble clic abre una vez y no desde
  controles); M3 ?editar no abre facturados y hace scroll a la fila; M4 tests de la ficha web (pestañas, monto por rol,
  sin módulo) y de Viajes en mobile; m1 menú accesible (foco, Escape, Tab, sin acciones → sin botón); m3/m4 errores de
  viajes; m5 monto en mobile para Admin/Supervisor; m6 OS tocables en mobile; m7 pestaña oculta → Resumen; m8 UUID en
  filtros de /api/viajes; m9 espaciados ds; m10 historia FilaConMenu; m2 title en la fila.
- Pendiente: build mobile a pedido; publicar con OK.
