# impl — tarea 157, ronda 5, grupo Super-Admin

## Resultado

- `grep -rnE 'components/(ui|Modal|DataTable)"' web/src/app/superadmin web/src/components/SuperAdminShell.tsx` → **vacío**.
- 7 pantallas migradas a `@bitacora/ui/web` + `@/components/PageHeader`. `SuperAdminShell.tsx` no se tocó (no importaba legacy).
- Controles crudos / `text-[Npx]` en superadmin: 51 → 14 (salud 24→0, empresas/[id] 11→4, resumen 5→0, roles 11→10).
  Lo que queda: checkboxes/radios (no hay primitivo Checkbox) y los `<button>` de cabeceras colapsables / fila de rol (contenido compuesto con título + chevron).
- `check-controles-web.mjs` avisa que bajó; **no** actualicé el baseline (queda para el líder al cerrar).

## Archivos tocados

- `web/src/app/superadmin/page.tsx` — `DataTable` → `Table` (`columnas/filas/claveFila/acciones/vacio` + `onFilaClick` a la ficha), carga → `LoadingState`, error → `ErrorState`; `Modal wide` → `Dialog tamano="ancho"`; error del alta → `Aviso`; buscador con `etiquetaAccesible`.
- `web/src/app/superadmin/login/page.tsx` — `Label+Input` → `Input etiqueta`; código con `tipo="codigo"`, `minLongitud/maxLongitud=6` (antes `pattern="[0-9]{6}"`); `ErrorText` → `Aviso`; botón `bloque`.
- `web/src/app/superadmin/cuenta/page.tsx` — `Select` con `opciones`, `Input` con `etiqueta`, códigos `tipo="codigo"`; `ErrorText` → `Aviso`, "Contraseña actualizada." → `Aviso tono="exito"`; outline → `secundario`.
- `web/src/app/superadmin/resumen/page.tsx` — imports + `Aviso` + clases ds.
- `web/src/app/superadmin/roles/page.tsx` — `Modal` → `Dialog`; `Badge` → `StatusBadge` (tono forzado `en_progreso`, igual al "brand" de antes); grupos de checkboxes con `fieldset/legend` en vez de `Label` suelto; `SuccessText/ErrorText` → `Aviso`; botones con API nueva. `useConfirmar` intacto.
- `web/src/app/superadmin/salud/page.tsx` — botón "Actualizar" crudo → `Button secundario sm`; `Badge` de proveedores/deploys → `BadgeSalud` local (`StatusBadge` con tono forzado: operational→completado, degraded→advertencia, outage→peligro, desconocido→cerrado); `Card className="border-warning/40"` → `Card` con título en `text-ds-warning`.
- `web/src/app/superadmin/empresas/[id]/page.tsx` — todos los `Label+Input/Select/Textarea` → prop `etiqueta` (el de "Escribe <nombre> para confirmar" usa `id` + `<label htmlFor>` para conservar el nombre en mono); `Card className=…` → `<div className=…><Card>` (se descartaron las clases `border-*`, Card nueva no tiene borde); `Badge` → helper `Estado` (`StatusBadge` + `TONO_ESTADO` para los estados que no están en el mapa compartido: suspendida, dada_de_baja, trial, pago_pendiente, suspendida_por_pago, pendiente, correo, dominio — mismo color que tenían); `ErrorText/SuccessText` → `Aviso`; aviso de invitación → `Aviso exito`; `Button` → `onPress/variante/deshabilitado/tipo`; "Eliminar" de la fila de usuario (antes ghost + `text-danger`) → `variante="peligro"`; literal `amber-50/amber-900` → `bg-ds-warning-soft text-ds-warning`.
- En todos: `text-foreground`→`text-ds-text`, `text-muted`→`text-ds-text-secondary`, `border-border`→`border-ds-divider`, `divide-border`→`divide-ds-divider`, `text-brand`/`text-danger`/`bg-*-soft`/`border-*/40` → equivalentes `ds-`, `text-[11px]`→`text-ds-micro`.
- **Nuevo:** `web/src/app/superadmin/page.test.tsx` — 3 pruebas: clic en fila abre la ficha; "Ver salud →" navega una sola vez (no dispara la fila); "Nueva empresa" abre el `Dialog` con el campo etiquetado.

## Decisiones / pérdidas menores (a propósito)

- `Input` nuevo no expone `autoComplete`, `min/max` ni `className`: se perdieron `autoComplete="current-password/new-password"` en Mi cuenta, `min/max` de los `number` (Días a extender, viáticos — la validación real ya estaba en el handler/backend) y `font-mono` en Identificador / contraseña personalizada / ID de cliente. No toqué `packages/ui`.
- Tablas crudas de solo lectura (errores, requests lentos, cobros, historial, usuarios con 6 botones por fila) se dejaron como `<table>` retokenizadas: no tienen fila navegable y `Table` las metería en una segunda Card anidada.
- Sin cambios de textos, lógica, API ni flujo de 2FA/Flow.

## Verificación (web, Node 22)

- `npx tsc --noEmit -p .` → exit 0.
- `npx eslint src` → 0 errores, 11 warnings (todos preexistentes; el de superadmin es `window.location.href` de impersonación, no tocado).
- `npx vitest run` → 53/53 (incluye las 3 nuevas).
- `node scripts/check-controles-web.mjs` → OK (bajó: button 163, input 85, select/textarea 8, text-[Npx] 72 en el árbol compartido al momento de correrlo).
- `node scripts/check-colores.mjs` → 3 (baseline), ningún literal nuevo.
- No corrí `./verificar.sh` completo (hay 3 implementadores en paralelo tocando web; queda para el líder).
