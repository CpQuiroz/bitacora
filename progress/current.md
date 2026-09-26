# Sesión actual

> Plan, decisiones y bloqueos de la tarea en curso. Al cerrar: resumen a
> `progress/history.md` y vaciar este archivo. Historial anterior al
> 23-sep-2026: `progress/archivo/current_2026-09-11_a_2026-09-23.md`.

## Tarea 157 — Unificar componentes web (ronda 5 auditoría UX) — en curso

**Decisión del humano (26-sep):** aprobada **con portal** y páginas públicas.
Fuentes Plex/Archivo se quedan (las usa el tema Taller).

**Hecho por el líder:** `Aviso` (web+native) y `Dialog.tamano` en
@bitacora/ui; `web/src/components/PageHeader.tsx` (PageHeader,
SinAutorizacion con tokens ds); `scripts/check-controles-web.mjs` +
`controles-web-baseline.json` (tope: button 165, input 90, select/textarea 8,
text-[Npx] 121).

**En paralelo (implementadores):** portal+públicas → `impl_ronda5_portal.md`;
superadmin → `impl_ronda5_superadmin.md`; panel legacy → `impl_ronda5_panel.md`;
Modal/DataTable del panel → `impl_ronda5_modal_tabla.md`.

**Al terminar (líder):** borrar `components/{ui,Modal,DataTable}.tsx`, regla
no-restricted-imports en eslint, check en verificar.sh, bajar baseline,
revisor, commit. Sin push ni build.
