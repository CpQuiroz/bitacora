# CHECKPOINTS — Evaluación del estado final de bitacora

> No se evalúa el camino, se evalúa el destino. El `revisor` recorre cada
> checkbox y **rechaza el cierre** si quedan boxes vacíos en C1–C5.

## C1 — El arnés está completo

- [ ] Existen `AGENTS.md`, `CLAUDE.md`, `verificar.sh`, `trabajo_list.json`,
      `progress/current.md`, `progress/history.md`.
- [ ] Existen `docs/harness/{arquitectura,convenciones,verificacion}.md`.
- [ ] `./verificar.sh` termina con exit code 0.

## C2 — El estado es coherente

- [ ] Como mucho **una** tarea `in_progress` en `trabajo_list.json`.
- [ ] Toda tarea `done` tiene su evidencia registrada en `progress/history.md`.
- [ ] `progress/current.md` está vacío (plantilla) o describe la sesión
      activa, sin restos de sesiones anteriores.

## C3 — El código respeta la arquitectura (`docs/harness/arquitectura.md`)

- [ ] Se respetan las capas: `web`/`mobile` no hacen `supabase.from(...)`;
      todo IO a Supabase pasa por `backend`.
- [ ] Toda tabla nueva con `empresa_id` tiene `enable row level security` en
      su migración y está en `TABLAS_POR_EMPRESA`.
- [ ] `npm run audit:tenant -w backend` no supera el baseline (6); los casos
      nuevos legítimos llevan `// tenant-ok:`.
- [ ] RPC nueva declarada en `Database.Functions` de `@bitacora/shared`.
- [ ] Sin dependencias nuevas sin justificar en `trabajo_list.json`.
- [ ] Sin prints de debug, sin TODOs sin contexto.

## C4 — La verificación es real (`docs/harness/verificacion.md`)

- [ ] `./verificar.sh` en verde (tsc x4, tests de shared, migraciones).
- [ ] Lógica de dominio nueva trae test con assert del resultado concreto.
- [ ] Feature de API/UI: probada contra el sistema real (endpoint/pantalla),
      no llamando funciones sueltas.
- [ ] Migración nueva: aditiva, y el humano confirmó que la aplicó en prod
      (o la tarea queda `blocked` esperando eso).

## C5 — La sesión se cerró bien

- [ ] Sin archivos temporales sospechosos sin trackear (scripts sueltos,
      `*.tmp`, PDFs de prueba).
- [ ] `progress/history.md` tiene una entrada por la última sesión.
- [ ] La última tarea trabajada está en su estado correcto en
      `trabajo_list.json`.
- [ ] Commit de respaldo hecho (o cambios explícitamente dejados sin
      commitear con la razón en `progress/current.md`).
- [ ] Si se tocó `mobile/`: `mobile/app.json` versionado si corresponde build.
