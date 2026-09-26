# Sesión actual

> Plan, decisiones y bloqueos de la tarea en curso. Al cerrar: resumen a
> `progress/history.md` y vaciar este archivo. Historial anterior al
> 23-sep-2026: `progress/archivo/current_2026-09-11_a_2026-09-23.md`.

## Tarea 155 — Accesibilidad base (ronda 3 auditoría UX) — en curso

**Decisiones del humano (26-sep):** Agenda mobile ya no está congelada (Hoy
sí). Se migró el contraste de Agenda (49 usos) y se actualizaron CLAUDE.md
y arquitectura.md.

**Medición inicial (web, eslint jsx-a11y):** 95 label-has-associated-control
(29 archivos), 7 control-has-associated-label, 5 click-events-have-key-events,
3 no-static-element-interactions, 1 role-has-required-aria-props.

**Plan:**
1. Web primitivas (`packages/ui/src/web` Input/Select/Textarea/DatePicker):
   `useId` + `htmlFor`, `aria-describedby` para error/ayuda.
2. Web pantallas: corregir los 110 hallazgos y activar esas reglas en
   `web/eslint.config.mjs` como error (entran en verificar vía eslint web).
3. Mobile primitivas: roles/labels por defecto (ListRow, QuickAccessCard,
   Card presionable, Button solo ícono), `maxFontSizeMultiplier` en Texto e
   inputs, `hitSlop`/44 px en acciones de texto.
4. Mobile formularios: teclado que no tape (OS, viaje, cliente).
5. verificar.sh verde, commit local. Sin build ni push.
