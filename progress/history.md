# Bitácora histórica (append-only)

> Al cerrar cada sesión, su resumen se añade acá. No edites entradas
> anteriores; solo añadís al final.

Formato:

```
## AAAA-MM-DD — <tarea o tema>
- **Agente:** <quién>
- **Plan:** <1-2 líneas>
- **Cambios:** <archivos/áreas tocadas>
- **Verificación:** <qué corrió, resultado>
- **Cierre:** <estado final, próximo paso>
```

> Contexto anterior a este archivo: ver `RESUMEN_TRABAJO.md`, el historial de
> git y la memoria del proyecto. Desde acá, la bitácora de sesiones vive
> en este archivo.

---

## 2026-09-09 — Montaje del harness
- **Agente:** Claude Sonnet 5
- **Plan:** analizar `~/ejemplo-harness-subagentes`, extraer una plantilla
  reutilizable (`~/harness-template`) e instanciarla en bitacora (modelo
  híbrido).
- **Cambios:** `AGENTS.md`, `CLAUDE.md`, `CHECKPOINTS.md`, `verificar.sh`,
  `trabajo_list.json`, `progress/`, `docs/harness/*`, `.claude/settings.json`,
  `.claude/agents/{lider,implementador,revisor}.md`.
- **Verificación:** `./verificar.sh` verde (tsc backend/shared/web/mobile,
  17 tests de shared, audit:tenant en baseline 6, migraciones sin huecos;
  lint web en WARN conocido → tarea #1).
- **Cierre:** arnés operativo. `trabajo_list.json` con 6 tareas pending.

## 2026-09-09 — Tarea #7: tenant_baseline_cero
- **Agente:** Claude Sonnet 5 (directo)
- **Plan:** revisar a mano los 6 hallazgos baseline de `audit:tenant` y
  marcar los legítimos con `// tenant-ok:`.
- **Cambios:** `backend/src/routes/authLogin.ts` (:59), `mfa.ts` (3 comentarios
  cubriendo :37/:86/:152/:163), `trabajos.ts` (:1057). `verificar.sh`
  `BASELINE_TENANT` 6→0. `trabajo_list.json` #7.
- **Revisión:** los 6 operan sobre la fila del usuario autenticado
  (`req.userId` del JWT) o sobre una OS ya acotada por
  `obtenerOCrearOrden/trabajoExiste(req.empresaId!)`. Ninguno es un agujero
  de aislamiento; son data por-usuario o id ya validado arriba.
- **Verificación:** `npm run audit:tenant` → "Sin hallazgos.", exit 0.
  `./verificar.sh` verde (paso 7 en [OK], 0 hallazgos).
- **Cierre:** #7 `done`. Baseline de aislamiento = 0.
