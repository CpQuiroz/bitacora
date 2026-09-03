# Postmortem — [título corto del incidente]

> Copiá este archivo a `docs/postmortems/YYYY-MM-DD-slug.md` y completalo.
> Solo para incidentes **SEV1 / SEV2**. Escribilo dentro de 48h.
> **Sin culpas** — el objetivo es que el sistema (y el runbook) mejoren, no señalar a nadie.

---

## Resumen

- **Fecha:** YYYY-MM-DD
- **Severidad:** SEV1 / SEV2
- **Duración del impacto:** HH:MM – HH:MM (total: __ min)
- **Componente:** Render / Vercel / Supabase (DB/Auth/Storage) / Cloudflare / Resend / Flow / Anthropic / mindicador / código propio
- **Detectado por:** monitoreo / reporte de usuario / al azar / Sentry
- **En una frase:** _[qué pasó y qué efecto tuvo]_

## Impacto

- **Empresas afectadas:** todas / solo Transportes Itineris / ninguna (evitado a tiempo)
- **Qué dejó de funcionar:** _[login, crear OS, facturación, app móvil, portal cliente, …]_
- **Qué siguió funcionando:** _[…]_
- **Datos perdidos o inconsistentes:** sí / no — _[detalle: registros a medias, correos
  no enviados, cobros duplicados, …]_
- **Se avisó al cliente:** sí (hora) / no — _[por qué]_

## Timeline

> Hora local. Incluí qué mirabas y qué concluías en cada paso, no solo las acciones.

| Hora | Evento |
|---|---|
| HH:MM | _[primer síntoma — qué / cómo se supo]_ |
| HH:MM | _[empieza el diagnóstico — qué se revisó]_ |
| HH:MM | _[hipótesis descartadas]_ |
| HH:MM | _[causa identificada]_ |
| HH:MM | _[mitigación aplicada — redeploy / rollback / carga manual / esperar al proveedor]_ |
| HH:MM | _[servicio recuperado]_ |
| HH:MM | _[confirmado estable — checklist de "vuelta a la normalidad" del runbook]_ |

## Causa raíz

_[La causa real, no el síntoma. "El backend devolvía 500" es el síntoma; "una migración
sin aplicar en prod dejó una columna faltante" es la causa.]_

### 5 whys

1. **¿Por qué [el síntoma]?** → …
2. **¿Por qué [respuesta 1]?** → …
3. **¿Por qué [respuesta 2]?** → …
4. **¿Por qué [respuesta 3]?** → …
5. **¿Por qué [respuesta 4]?** → _[acá suele aparecer la causa sistémica: falta de
   validación, falta de alerta, un SPOF conocido y no mitigado, un paso manual olvidable]_

## Qué funcionó / qué faltó

**Funcionó:**
- _[ej. el rollback de Vercel fue instantáneo; el runbook tenía el paso exacto]_

**Faltó:**
- _[ej. no había alerta — me enteré por el cliente; el `errores_backend` no se podía
  leer porque lo caído era Supabase; el timeout de X no existía y colgó todo]_

## Action items

> Cada uno entra a la lista de trabajo real con fecha. Marcá `[x]` cuando esté hecho.

| # | Acción | Tipo | Fecha objetivo | Estado |
|---|---|---|---|---|
| 1 | _[prevención: que no vuelva a pasar]_ | prevención | | [ ] |
| 2 | _[detección: enterarse antes / más rápido]_ | detección | | [ ] |
| 3 | _[mitigación: resolverlo más rápido la próxima — actualizar el runbook]_ | runbook | | [ ] |
| 4 | _[deuda: el SPOF o el hueco de fondo que esto expuso]_ | deuda | | [ ] |

## Enlaces

- Commits / PRs del fix:
- Logs relevantes (Render / Sentry / Supabase):
- Incidente del proveedor (si aplica):
