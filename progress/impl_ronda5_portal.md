# Tarea 157, ronda 5: grupo portal del cliente y páginas públicas

## Archivos tocados
- `web/src/app/portal/page.tsx` (inicio)
- `web/src/app/portal/acceder/page.tsx`
- `web/src/app/portal/login/page.tsx`
- `web/src/app/portal/citas/page.tsx`, `citas/[id]/page.tsx`
- `web/src/app/portal/cobros/page.tsx`
- `web/src/app/portal/cotizaciones/page.tsx`, `cotizaciones/[id]/page.tsx`
- `web/src/app/portal/ordenes/page.tsx`, `ordenes/[id]/page.tsx`
- `web/src/app/agendar/[empresaId]/page.tsx`
- `web/src/app/encuesta/[id]/page.tsx`
- `web/src/app/auth/callback/page.tsx`
- NUEVO `web/src/app/portal/tonoEstado.ts`: helper `tonoPortal(estado)` para los estados que no están en el mapa de StatusBadge
- NUEVO `web/src/app/portal/page.test.tsx`, `web/src/app/portal/login/page.test.tsx` (tests de render mínimos)
- `PortalShell.tsx` NO se tocó (no importa el módulo legacy).

`grep -rn 'components/ui"'` sobre los 13 archivos no devuelve nada.

## Mapeos no obvios
- **Badge → StatusBadge + `tonoForzado={tonoPortal(estado)}`**: el Badge antiguo pintaba de "brand" lo que no estaba mapeado; StatusBadge cae en "cerrado". Para no perder el sentido en el portal, `tonoPortal` fuerza: `pendiente` → `advertencia` (antes alerta: visita, cita por confirmar, cobro por pagar), `enviado`/`enviada` → `en_progreso` (antes brand), `borrador` → `cerrado` (antes neutro). Lo demás usa `MAPA_ESTADO_TONO`. `expirado` pasa de alerta a cerrado (según el mapa compartido).
- **Botones con `className="flex-1"`/`self-start`**: el Button nuevo no acepta className, así que va envuelto en un `<div className="flex-1">` con `bloque`, o en un `<div className="self-start">`. `variant="outline"` → `variante="secundario"`. Los botones de ancho completo dentro de columnas flex llevan `bloque` para mantener el ancho de antes.
- **Card `className="p-4"`**: se quitó; el Card nuevo trae `p-ds-4`. Las tarjetas ya no tienen borde (es el estilo del sistema nuevo).
- **Login, campo de código**: `Input tipo="codigo" maxLongitud={6}` (mismo filtro de dígitos en `onCambio`). **Se pierde el estilo centrado, grande y espaciado** (`text-center text-lg tracking-[0.3em]`), porque Input no acepta className. Queda igual al código 2FA del login del panel.
- **Inicio del portal, textarea de corrección**: el `<p>` que la introducía pasó a ser `<label htmlFor="portal-correccion">` con el mismo texto, así el campo tiene nombre accesible.
- **Agendar, color de la empresa en el botón**: antes era `style={{ backgroundColor: color }}` sobre el Button legacy. Ahora el contenedor del formulario fija `--ds-brand`, `--ds-brand-hover`, `--ds-brand-pressed` y `--ds-brand-foreground` a partir de `marcaLegible(color)`, igual que PortalShell (tarea 154). Si el color no da contraste AA, el fondo se oscurece un poco. Hay que redefinir hover/pressed ahí mismo porque en `:root` se calculan con el `--ds-brand` de la raíz. Los chips de día y hora y el ícono siguen con el `color` en línea, sin cambios.
- `text-brand` → `text-ds-brand` en los archivos del portal: ahora esos links e íconos toman el color de la empresa (PortalShell define `--ds-brand`). Antes tomaban el azul de Bitácora, porque PortalShell nunca definía `--brand`.
- **Clases**: `text-foreground`/`text-muted`/`bg-surface`/`border-border` → equivalentes `ds-` en todos los archivos. Algunos `text-sm`/`text-xs` que tocaba pasaron a `text-ds-small`/`text-ds-caption`, y los títulos `text-xl`/`text-lg` quedaron como estaban.

## Botones crudos que se mantienen (a propósito)
Los que parecen links (Descargar mis datos, Reenviar código, Volver al inicio de sesión), la lista de empresas del login (tarjetas alineadas a la izquierda), los chips de día y hora de agendar (toggles con color de marca) y las 5 estrellas de la encuesta (botón circular de ícono; `forma="circular"` no existe en web). Solo les cambié las clases a `ds-`. El conteo de controles de mis archivos quedó igual que en HEAD (7 → 7).

## Dudas
- `check-controles-web.mjs` hoy FALLA con `input: 92 (tope 90)`, pero no es por estos archivos: ninguno tiene `<input`, y comparé archivo por archivo contra HEAD sin diferencias en el conteo. El +2 viene de otro grupo en paralelo.
- ¿Conviene sumar el centrado y el tracking del código OTP como opción de Input en `packages/ui`? Queda fuera de mi alcance.

## Verificación
- `npx tsc --noEmit -p .` (web): sin errores
- `npx eslint src`: 0 errores, 11 advertencias (ninguna en mis archivos)
- `npx vitest run`: 47/47 tests OK (incluye los 3 nuevos del portal)
- `node scripts/check-colores.mjs`: 3 (baseline), ningún literal nuevo
- `node scripts/check-controles-web.mjs`: FAIL por input 92/90, ajeno a este grupo (ver Dudas)
