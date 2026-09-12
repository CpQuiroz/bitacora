# Instrucciones para Claude — bitacora

> Se carga automáticamente al inicio de cada sesión desde la raíz.

Primero: leé **`AGENTS.md`** (mapa del repo). Este archivo define sobre todo
*cómo* trabajás, más un resumen compacto de las reglas de negocio/
arquitectura que más se repiten entre prompts (detalle completo y
verificado contra el código en `docs/harness/arquitectura.md`); `AGENTS.md`
sigue siendo la fuente de *qué* hay y *dónde*.

---

## Modelo de operación: HÍBRIDO

### Disciplina — siempre activa, sin excepción

1. Al empezar una tarea de código: leé `progress/current.md` y
   `trabajo_list.json`. Corré `./verificar.sh`.
2. **Una tarea a la vez.** Marcala `in_progress` en `trabajo_list.json`
   antes de tocar código.
3. Actualizá `progress/current.md` **mientras** trabajás — plan, decisiones,
   bloqueos. No al final.
4. Antes de declarar algo terminado: `./verificar.sh` en **verde**.
5. Commit de respaldo por cada cambio grande verificado, sin pedir permiso
   para esos commits de backup (nada de force-push / reset --hard / amend
   sin confirmación). Detalle en `docs/harness/convenciones.md`.
6. Al cerrar: resumen a `progress/history.md`, vaciá `progress/current.md`.

### Orquestación — bajo demanda

Lanzá los subagentes `lider / implementador / revisor` de `.claude/agents/`
**solo** cuando:
- el humano lo pida ("orquestá esto", "usá subagentes", "modo líder"), o
- la tarea sea grande y multi-archivo (feature de punta a punta, refactor)
  y convenga aislar contexto y tener un revisor independiente.

Para preguntas, exploración del repo, o cambios en `docs/` / `progress/` /
config: respondé y editá vos directamente, sin subagentes.

Cuando SÍ orquestes, aplicá la **regla anti-teléfono-descompuesto**: los
subagentes escriben en `progress/{explore,impl,review}_<tema>.md` y te
devuelven solo la referencia (`done -> progress/impl_<tarea>.md`), nunca el
código por chat.

---

## Reglas duras del proyecto

Las canónicas están en `AGENTS.md` §3. Recordatorio de las que más se pisan:

- **Multi-tenant:** filtrá por `empresa_id`; `enable row level security` en
  toda tabla nueva.
- **Prod DB:** solo lecturas; las migraciones a prod las corre el humano.
- **web/ y mobile/** tienen su propio `AGENTS.md` con avisos de framework
  (Next 16, Expo 57) — leelos antes de tocar esas carpetas.
- **EAS builds** solo a pedido; bump de versión en `mobile/app.json`.
- **Deploy** = push a `main` (Vercel + Render auto).
- **Sistema de diseño** (tokens, `packages/ui`, convenciones de color/
  espaciado/tipografía): `docs/design-system.md` es la fuente de verdad.
  Colores literales fuera de `packages/design-tokens` los bloquea
  `scripts/check-colores.mjs` (en `verificar.sh` y en CI); en `web`
  también hay una regla de ESLint (`web/eslint-rules/anti-token.mjs`).

## Reglas de negocio y arquitectura (resumen)

Detalle completo, con referencias exactas a código, en
`docs/harness/arquitectura.md` §Roles, §Patrones, §Invariantes, §Qué NO
hacer. Lo que más se repite:

- **RLS + filtrado por `empresa_id` son complementarios, no alternativos**
  — no reabras esa discusión sin que se pida.
- **Roles**: 4 de sistema (`admin/supervisor/contador/colaborador`), 3
  capas (plantilla global → override por empresa → gating por plan).
  Mobile usa `usuarios.funcion` aparte de los roles web.
- **Reutilizá**: `subirAnexo`, `requiereModulo`/`requiereAccion`,
  `ComboboxCliente`, `InputMonto` — no reimplementar.
- **Invariantes**: OS inmutable post-firma; pack = plantilla que nunca se
  decrementa + snapshot inmutable por venta; deletes condicionales
  (error `23503` → "desactivar" en vez de eliminar); índice nuevo con
  `EXPLAIN ANALYZE` validado antes de cerrar la tarea; IA de Informes =
  RAG, nunca fine-tuning.
- **No tocar sin pedido explícito**: tabs Agenda/Hoy de mobile
  (congeladas); que Mantención de flota toque `trabajos`/
  `ordenes_servicio` (deliberado).

## Memoria

Hay memoria persistente del proyecto (`~/.claude/projects/.../memory/`). Si
una memoria contradice a `AGENTS.md` o `docs/harness/`, ganan estos últimos
(están versionados y son la fuente de verdad); avisá de la discrepancia.
