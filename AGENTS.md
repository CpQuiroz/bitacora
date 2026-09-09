# AGENTS.md — Mapa de navegación para agentes de IA (raíz del monorepo)

> Punto de entrada para cualquier agente que trabaje en **bitacora**.
> NO es una biblia: es un **mapa**. Leé solo lo que necesites, cuando lo
> necesites (divulgación progresiva).

**bitacora** — SaaS multi-tenant de terreno para PYMEs de transporte y
mantención en Chile (órdenes de servicio, cotizaciones, cobros, agenda,
flota, portal del cliente).

Monorepo (npm workspaces):

| Paquete | Stack | Notas |
|---|---|---|
| `web/` | Next.js **16** + Tailwind v4 | Esta NO es la Next que conocés — ver `web/AGENTS.md` |
| `backend/` | Express 4 + `tsx` + Supabase (service role) | Node ≥ 22 |
| `packages/shared/` | TS puro | Tipos + lógica compartida (`@bitacora/shared`) |
| `mobile/` | Expo SDK **57** / RN 0.86 | Expo cambió — ver `mobile/AGENTS.md` |

---

## 1. Antes de empezar (obligatorio)

1. `./verificar.sh` y confirmá que termina en verde. Si falla, **pará** y
   resolvé el entorno antes de tocar código.
2. Leé `progress/current.md` — en qué quedó la última sesión.
3. Leé `trabajo_list.json` y elegí **una** tarea `pending` (o la que el
   humano indique). Una a la vez.

## 2. Mapa del repositorio

| Ruta | Qué contiene | Cuándo leerlo |
|---|---|---|
| `trabajo_list.json` | Tareas con estado | Siempre, al empezar |
| `progress/current.md` | Sesión activa | Siempre, al empezar |
| `progress/history.md` | Bitácora append-only | Contexto histórico |
| `docs/harness/arquitectura.md` | Qué es "buen trabajo" acá | Antes de implementar |
| `docs/harness/convenciones.md` | Estilo, nombres, errores, commits | Antes de escribir código |
| `docs/harness/verificacion.md` | Cómo se demuestra que algo funciona | Antes de cerrar una tarea |
| `CHECKPOINTS.md` | Criterios objetivos de estado final | Para auto-evaluar / revisar |
| `.claude/agents/` | Subagentes líder / implementador / revisor | Si orquestás (ver `CLAUDE.md`) |
| `web/AGENTS.md`, `mobile/AGENTS.md` | Avisos de framework (Next 16 / Expo 57) | Antes de tocar web o mobile |
| `docs/PUESTA_EN_PRODUCCION.md` | Despliegue, migraciones a prod | Antes de deploy / migración |
| `docs/RUNBOOK_INCIDENTES.md` | Qué hacer si algo se cae en prod | Ante un incidente |
| `docs/AUDITORIA_*.md` | Auditorías (perf, resiliencia, legal Ley 21.719, remuneraciones) | Si tu tarea toca esas áreas |
| `CONTEXTO_PROYECTO.md` | Contexto de producto/negocio (alimenta el Project de claude.ai) | Para entender el "por qué" |
| `web/ backend/ packages/ mobile/` | Código | Para implementar |

## 3. Reglas duras (no negociables)

- **Una sola tarea a la vez.** No mezcles cambios de varias tareas.
- **No cierres una tarea sin `./verificar.sh` en verde.**
- **Documentá en `progress/current.md` mientras trabajás**, no al final.
- **Aislamiento multi-tenant:** toda query a una tabla con `empresa_id` filtra
  por `empresa_id`. Toda tabla nueva lleva `enable row level security` en su
  migración (Supabase auto-otorga grants a `anon`/`authenticated`). Ver
  `docs/harness/arquitectura.md` §Multi-tenant.
- **Prod DB:** el agente hace solo lecturas (`supabase db query --linked
  --project-ref yjbskbskyadxjooxngjv`). Las migraciones a prod las corre el
  humano. Ver `docs/PUESTA_EN_PRODUCCION.md`.
- **Builds EAS (mobile):** solo cuando el humano los pide. Bump
  `mobile/app.json` `version` + `android.versionCode` en cada build.
- **Secretos:** el agente nunca teclea passwords, keys ni tokens en formularios
  ni los commitea. Los `.env` reales están gitignoreados.
- Si una herramienta falla de forma inesperada, **no improvises un
  workaround**: anotá el bloqueo en `progress/current.md` y pará.

## 4. Elegir una tarea

```
1. trabajo_list.json → status == "pending"
2. menor "id" (o la indicada por el humano)
3. status → "in_progress", guardar
4. progress/current.md: tarea, hora de inicio, plan (3-5 bullets)
```

## 5. Cierre de sesión

1. `./verificar.sh` verde.
2. Tarea acabada → `status: "done"` en `trabajo_list.json`.
3. Resumen de `progress/current.md` → al final de `progress/history.md`.
4. Vaciá `progress/current.md` (dejá la plantilla).
5. Commit de respaldo (ver `docs/harness/convenciones.md` §Commits).
6. Sin temporales, sin prints de debug, sin TODOs sin contexto.

## 6. Si te bloqueás

Releé la sección de `docs/` relevante. Si sigue, documentá el bloqueo en
`progress/current.md`, marcá la tarea `blocked` y terminá la sesión.
