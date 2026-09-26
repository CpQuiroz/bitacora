# Review: tarea 157 consolidar_componentes_web (ronda 5)

**Veredicto:** APROBADO (sin bloqueantes; 2 ajustes menores recomendados antes de cerrar, el resto es opcional)

Alcance revisado: `git diff fa35464~1..HEAD` (74 archivos). `./verificar.sh` (Node 22) → **EXIT 0**:
tsc x7 OK, tests (shared 51, tokens 21, ui 3, backend 36, mobile 51, web 53) verdes, eslint web OK,
audit:tenant 0 (baseline), colores 3 (baseline), controles web dentro del tope (button 159, input 83,
select/textarea 5, text-[Npx] 63).

## Criterios de aceptación (trabajo_list id 157)
- [x] Los 25 archivos legacy salen de `components/ui.tsx`: el grep de `components/(ui|Modal|DataTable)` en `web/src` sale vacío y los 3 archivos están borrados.
- [x] Modal → Dialog: 9 sitios del panel + superadmin (`page.tsx:135`, `roles/page.tsx:362`) + `CatalogoSelectorModal.tsx:171` + `ImportarCsvModal.tsx:112`. Los tamaños `wide`→`ancho` y `xl`→`grande` están bien mapeados en todos (p. ej. `RegistrosMantencion.tsx:210,220`). Test: `ImportarCsvModal.test.tsx:33-45`.
- [x] DataTable → Table: 9 en configuración/flota + superadmin/page.tsx. Test: `cotizacion-etapas/page.test.tsx:17-42` y `superadmin/page.test.tsx:26-47`.
- [x] Regla de lint: `web/eslint.config.mjs` `no-restricted-imports`. La probé con stdin: bloquea `@/components/Modal` y `../components/ui`.
- [x] Tope de controles crudos: `scripts/check-controles-web.mjs` + baseline, conectado en `verificar.sh:200`.
- [x] Portal y páginas públicas incluidos (decisión del 26-sep).

## Foco pedido

### 1. Portal y públicas: sin pérdidas funcionales
- Ninguna pantalla del portal ni `agendar` usa `<form>` (antes tampoco): todas las acciones son `onPress`, no se pierde ningún submit. Siguen visibles los estados de carga, los errores (`Aviso` con `role="alert"`), los textos "Enviando…/Agendando…/Generando…" y los `deshabilitado`.
- Marca: PortalShell ya fija `--ds-brand` en `<html>`, así que el hover derivado de `tokens.css:105` usa el color del tenant. `agendar/[empresaId]/page.tsx:53-61` redefine brand, hover y pressed con `marcaLegible` (contraste AA), mejor que el `style` crudo de antes. Los chips de día y hora siguen con el color de la empresa.
- Enlaces intactos (volver, acceder → login, descargar mis datos). `text-brand`→`text-ds-brand` ahora toma el color del tenant, lo que es una mejora.
- `tonoEstado.ts`: los mapeos son correctos frente a los estados reales del backend (`routes/portal.ts`): visitas (en_curso/completado), OS (`estadoOsDeTrabajo`, `EstadoOS`), cotizaciones (`EstadoPresupuesto`), citas (`EstadoTarea`) y cobros (`EstadoFactura`). `pendiente`→advertencia y `vencida`→peligro conservan el sentido. `enviado` pasa de brand a en_progreso y `expirado` de alerta a cerrado: aceptable.
- Cambios visuales: las Cards pierden borde y usan `p-ds-4` (es el estilo nuevo). El código OTP queda centrado con `tracking-widest` (`Input.tsx:75`). Nada grosero.

### 2. Super-Admin: misma lógica
- `superadmin/page.tsx:181-197`: carga, error y vacío explícitos. La fila y "Ver salud →" navegan una sola vez (test `page.test.tsx:34-40`).
- Los formularios de cuenta, 2FA, invitar, accesos y rol nuevo conservan `tipo="submit"` y `requerido`. Los handlers, el flujo de 2FA, la impersonación (justificación ≥ 20) y las confirmaciones por nombre (eliminar usuario o empresa) no cambian.
- `salud/page.tsx:76-85`: `TONO_SALUD` reproduce bien el Badge viejo (operational/degraded/outage/desconocido).

### 3. Panel
- Dialog = Modal viejo en comportamiento: el clic en el fondo cierra en los dos (el viejo también, `Modal.tsx` línea del backdrop con `onClick={onClose}`). Mismo `max-h-[85vh]` y el mismo cuerpo con `overflow-y-auto`. Ningún modal dependía de no cerrarse ni tenía pie propio. Ninguno de los diálogos migrados usa `autoFocus` (el Dialog le roba el foco al contenedor, pero no aplica).
- Tablas de configuración/flota: `onFilaClick` abre edición o ficha y las acciones pasan al menú ⋯ con `stopPropagation` (`Table.tsx`), según la convención de la tarea 148/149.
- `ordenes/nueva`: cantidad con `paso={0.01} minimo={0}` (`page.tsx:361-368`), descripción con `requerido` en Textarea y fecha con `requerido` en DatePicker; submit con `tipo="submit"` (`:441`).
- trabajos/[id]: los botones de subir ya no van dentro de `<label>`; el comportamiento es el mismo (el botón no reenvía el clic al label).
- informe, perfil, ayuda y `estados.tsx`: la API pública se mantiene y no hay `<form>` en informe.

### 4. Badge → StatusBadge
Todo coincide con `TONO_DE_ESTADO` del Badge viejo o con la decisión del sistema de diseño de pasar "cancelado" a neutro, salvo lo que anoto en M1 y B1.

### 5. Button: tipo
Los 7 `<Button type="submit">` antiguos tienen su `tipo="submit"` (1 a 1 en el diff). Un Button nuevo sin tipo es `type="button"` (`Button.tsx`), así que ningún botón secundario dentro de un form envía por accidente. Revisé los forms de agenda, cobros, personas, equipos, viajes, superadmin y roles: el único submit de cada form es el correcto.

### 6. Tests nuevos
Son de pantalla con API simulada y prueban comportamiento real: la fila abre la ficha, la acción no la dispara dos veces, el menú ⋯ ejecuta DELETE sin abrir la edición, la validación del RUT no llama a la API, el filtro de dígitos del OTP, el label asociado y Escape/Cerrar del Dialog. Falta cubrir lo nuevo de mayor riesgo (ver B5).

## Hallazgos

**M1 (media-baja, recomendado)**: `superadmin/empresas/[id]/page.tsx:80` (`TONO_ESTADO`) dice "mismo tono que tenían con el Badge antiguo", pero le faltan `fallido` y `cancelada`. El cobro de suscripción fallido (`:1157`) y la suscripción cancelada (`:1106`) eran **rojos** (riesgo) y ahora salen **grises** (`MAPA_ESTADO_TONO` → cancelado). Un pago fallido tiene que verse como alerta. Arreglo: agregar `fallido: "peligro"` y `cancelada: "peligro"` a `TONO_ESTADO`.

**B1 (baja, recomendado)**: `superadmin/page.tsx:118`: el listado de empresas muestra `suspendida` y `dada_de_baja` en gris (ya era así antes de la tarea), mientras que la ficha ahora los pinta advertencia/peligro. Arreglo: sacar `TONO_ESTADO`/`Estado` a un helper compartido de superadmin y usarlo en las dos pantallas.

**B2 (baja)**: `superadmin/cuenta/page.tsx:203,206,209,249`: se perdió `autoComplete="current-password|new-password"`, porque el Input no lo expone. Sin eso los gestores de contraseñas pueden autocompletar mal el cambio de clave. Arreglo: agregar `autoCompletar?` a `PropsInput` (web) en otra pasada.

**B3 (baja)**: `empresas/[id]/page.tsx:1038,1083,1086`: se perdieron `min/max` en "Días a extender" (1..MAX_DIAS_EXTENSION_PRUEBA) y `min=0` en viáticos. No están dentro de un form y el backend valida, así que solo afecta el spinner. Arreglo: `minimo={1}` / `minimo={0}` (el prop ya existe).

**B4 (cosmético)**: `ordenes/nueva/page.tsx:381`: el `mt-6` que alinea "Quitar" con los campos de la fila 0 venía calculado para el Label viejo (13px + mb-1.5). Con la etiqueta del primitivo el alto es otro y puede quedar un poco desalineado. Hay que revisarlo a ojo.

**B5 (baja, tests)**: nada verifica los props nuevos: `step="0.01"`/`min` en la cantidad, `required` en descripción/fecha de `ordenes/nueva`, ni el tono de `tonoPortal` (p. ej. que `pendiente` lleve `bg-ds-warning-soft`). Es un test de 5 líneas por caso en `ordenes/nueva/page.test.tsx` y `portal/page.test.tsx`.

**B6 (baja, convención)**: `superadmin/page.tsx:191`: "Ver salud →" queda como botón suelto que repite el clic de la fila. `convenciones.md` §Listas pide las acciones en el menú ⋯ o ninguna. Se puede quitar o usar `accionesEnMenu`.

**B7 (opcional)**: `empresas/[id]/page.tsx:1596-1598`: "Eliminar" en la fila de usuario pasó de ghost rojo a botón `peligro` relleno, junto a 5 secundarios, y pesa mucho visualmente. Si se busca menos ruido, `variante="ghost"` sirve (no hay ghost-peligro en el primitivo).

## Arquitectura / Convenciones / Verificación
- [x] Sin `supabase.from(` nuevos en web (grep del diff vacío).
- [x] audit:tenant 0, sin cambio de baseline. Sin migraciones ni tablas nuevas.
- [x] Sin dependencias nuevas. Sin console.log de debug (los del script son su salida) ni TODOs.
- [x] Colores literales: se quitaron `text-red-600` y `amber-*`; check en baseline.
- [x] Nombres en español; comentarios con el porqué (`tonoEstado.ts`, `PageHeader.tsx`, `Aviso.tsx`).
- [x] `./verificar.sh` verde.

## CHECKPOINTS
- C1: [x] arnés completo, verificar.sh exit 0.
- C2: [x] una sola tarea `in_progress` (157); `current.md` describe la sesión activa.
- C3: [x] capas, tenant, sin deps nuevas, sin debug.
- C4: [x] verificar verde; pruebas de pantalla con API simulada (Nivel 2b). No hay lógica de dominio nueva.
- C5: [ ] pendiente del cierre (no es de esta revisión): falta la entrada en `progress/history.md`, poner la 157 en `done` y vaciar `current.md`. Commits de respaldo hechos (fa35464, 147d03f). Los cambios en `supabase/.temp/*` son ruido de la CLI y no hay que commitearlos. No se tocó mobile/ (solo `packages/ui/src/native/Aviso.tsx`, sin build).

## Cambios requeridos
Ninguno bloqueante. Recomendado antes del cierre: M1 y B1 (tonos de estado en Super-Admin), y opcionalmente B3 y B5.
