# docs/harness/ — El arnés de bitacora

Estructura que hace este repo **trabajable por un agente de IA** de forma
autónoma y verificable. Basado en el patrón de `~/harness-template`
(plantilla reutilizable) y el ejemplo `~/ejemplo-harness-subagentes`.

## Piezas

| Archivo (en la raíz salvo que se diga) | Rol |
|---|---|
| `AGENTS.md` | Mapa de navegación — punto de entrada, divulgación progresiva |
| `CLAUDE.md` | Cómo trabaja el agente (modelo **híbrido**: disciplina siempre, subagentes bajo demanda) |
| `verificar.sh` | Verificación ejecutable — el arnés no se fía de lo que diga el agente |
| `trabajo_list.json` | Alcance: una tarea a la vez, con `acceptance` verificable |
| `progress/current.md` | Estado de la sesión activa (se vacía al cerrar) |
| `progress/history.md` | Bitácora append-only |
| `CHECKPOINTS.md` | Criterios objetivos de "estado final correcto" |
| `docs/harness/arquitectura.md` | Qué es "buen trabajo" acá (capas, multi-tenant, PDFs, invariantes) |
| `docs/harness/convenciones.md` | Estilo, nombres, errores, migraciones, commits |
| `docs/harness/verificacion.md` | Cómo se demuestra que algo funciona (niveles 0-6) |
| `.claude/agents/{lider,implementador,revisor}.md` | Subagentes para orquestación |
| `.claude/settings.json` | Hook: corre `verificar.sh` al cerrar si hubo cambios de código |

## Flujo de una tarea

```
1. ./verificar.sh                    → verde
2. leer progress/current.md + trabajo_list.json
3. tarea pending → in_progress, plan en progress/current.md
4. implementar + tests, actualizando progress/current.md
5. ./verificar.sh                    → verde
6. (opcional) revisor contra CHECKPOINTS.md
7. status → done, resumen a progress/history.md, vaciar current.md
8. commit de respaldo
```

## Orquestación (bajo demanda)

Pedí "orquestá esto" / "usá subagentes" y el flujo pasa a
líder → implementador → revisor, con los informes en `progress/*.md` y sin
código por el chat. Ver `.claude/agents/`.
