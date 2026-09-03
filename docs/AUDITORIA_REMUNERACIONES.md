# Auditoría — Módulo Remuneraciones

> **Fecha:** 3-sep-2026 · **Alcance original:** solo lectura, cada hallazgo cita archivo y línea.
>
> **Estado (3-sep, post-auditoría):** aplicados en `main` (migración 76) los hallazgos
> **1, 2, 3, 5, 6, 7, 8, 11, 14** y los tests de **#4**. Ver commits
> `Remuneraciones — hallazgos de auditoría`. Pendientes: **#9, #10, #15** (validación del
> archivo Previred / Libro DT con un contador — no es código), **#12, #13, #16, #17, #18**
> (Baja, no aplicados). Detalle de lo aplicado abajo, en cada fila de la tabla el texto
> sigue describiendo el problema *original*.
>
> **Archivos revisados:**
> `packages/shared/src/liquidacionChile.ts` (+`.test.ts`) ·
> `backend/src/remuneraciones/{parametros,calcular,archivoPrevired,resumenPrevisional,libroRemuneracionesDT}.ts` ·
> `backend/src/routes/remuneraciones.ts` · `backend/src/generarPdfLiquidacion.ts` ·
> migraciones 67-70 · `packages/shared/src/permisos.ts` · `packages/shared/src/types.ts` ·
> `backend/src/server.ts` (montaje del router).

---

## Resumen ejecutivo

El **cálculo puro** (`liquidacionChile.ts`) está bien diseñado: es una función pura, todos
los insumos que cambian con el tiempo (UF, UTM, topes, tasas, tabla de impuesto, comisión
AFP) entran por parámetro y quedan guardados en un snapshot inmutable por liquidación
(`liquidaciones.detalle`). El redondeo a pesos es consistente. La inmutabilidad de una
liquidación `emitida` se respeta a nivel de código. El control de acceso por módulo es
correcto y no hay fuga entre empresas por endpoints mal filtrados.

Los problemas serios están **alrededor** del cálculo, no dentro:

1. **UF/UTM del período equivocadas** — `parametros.ts` trae el valor *más reciente* de
   mindicador.cl, no el del período que se está liquidando. Generar la nómina de un mes
   fuera de ese mismo mes (lo normal: se cierra en los primeros días del mes siguiente)
   guarda la UTM/UF de otro mes en el snapshot.
2. **`parametros_previsionales` es una tabla global sin `empresa_id`** y su endpoint de
   edición no está scopeado — el contador de una empresa puede cambiar la UF, los topes o
   la tabla de impuesto para *todas* las empresas, sin que quede registro de quién lo hizo.
3. **No hay validación de `datos_laborales`** antes de generar/emitir — una liquidación
   con AFP nula, sueldo base 0 o sin RUT se genera y se emite en silencio; el único aviso
   es un header HTTP fácil de ignorar.

Los archivos Previred / Libro DT están correctamente marcados como borrador en el código y
en la UI; abajo se detallan los campos concretos con valor fijo/placeholder.

---

## Tabla de hallazgos

| # | Sev. | Archivo:línea | Descripción | Recomendación |
|---|---|---|---|---|
| 1 | **Alta** | `backend/src/remuneraciones/parametros.ts:42` | `traerUfUtm()` hace `fetch("https://mindicador.cl/api")`, que devuelve la UF y la UTM **más recientes**, no las del `periodo` objetivo. Al generar la nómina de septiembre a comienzos de octubre, se guarda la UTM de octubre en `parametros_previsionales` y en `liquidaciones.detalle`. La UTM cambia todos los meses y escala directo los tramos del impuesto único; la UF cambia a diario. | Pedir el valor del período: `https://mindicador.cl/api/utm/MM-YYYY` y `https://mindicador.cl/api/uf/DD-MM-YYYY` (último día del mes). Si el usuario genera un período distinto al mes en curso, avisar explícitamente qué fecha de UF/UTM se usó. |
| 2 | **Alta** | `backend/src/routes/remuneraciones.ts:57-99` | `PATCH /api/remuneraciones/parametros/:periodo` escribe `parametros_previsionales` y `afp_parametros`, que son **tablas globales sin `empresa_id`** (migración 67). Cualquier admin/contador de cualquier empresa puede cambiar UF, UTM, topes imponibles, tasa SIS, tasa mutual base, la tabla de tramos del impuesto único y las comisiones AFP — y eso cambia el cálculo de **todas** las empresas para ese período. No queda registro de quién hizo el cambio (solo `fuente='manual'` + `actualizado_en`). | Decidir el modelo: (a) parámetros por empresa (agregar `empresa_id`, seed por empresa), o (b) mantenerlos globales pero restringir la edición al Super-Admin (mover el `PATCH` a `/api/superadmin/...`). En cualquier caso, auditar quién los cambió (tabla de auditoría o al menos `actualizado_por`). |
| 3 | **Alta** | `backend/src/routes/remuneraciones.ts:219-275` (`generar`), `:336-385` (`emitir`) | No se valida que `datos_laborales` esté completo antes de calcular/emitir. `sueldo_base` tiene `default 0` (migración 68); `afp` puede ser `null` → `cotizaAfp: Boolean(datos.afp)` = `false` → liquidación sin descuento AFP; RUT vive en `usuarios` y no se chequea al generar. Una liquidación con datos faltantes se genera con `estado='borrador'` y se puede emitir. El único freno es un header `X-Aviso` en `/exportar` (`remuneraciones.ts:470`) — fácil de no ver. | Antes de `generar`/`emitir`, validar por colaborador: `sueldo_base > 0`, `afp` no nula (o marcar explícitamente "no cotiza"), `sistema_salud` coherente con `plan_isapre_*`, RUT presente. Bloquear (o marcar la liquidación como "incompleta") y listar los faltantes en la respuesta. |
| 4 | Media | `packages/shared/src/liquidacionChile.ts:212-221` + `.test.ts` | `TRAMOS_IMPUESTO_UNICO_BASE` (8 tramos con `factor`/`rebaja` fijados por ley) no tiene ningún test que verifique un caso conocido en los tramos 3-8. `liquidacionChile.test.ts:109-115` solo cubre el tramo exento y el tramo 2. Un typo en cualquiera de las otras 6 filas produce impuesto mal calculado para rentas medias/altas y ningún test lo detecta. | Agregar tests con al menos un caso por tramo, contrastados con la tabla oficial del SII del período (o con el cálculo de Previred). |
| 5 | Media | `backend/src/remuneraciones/calcular.ts:38` + `routes/remuneraciones.ts:257` | `armarLiquidacion(..., {})` en el batch `generar` pasa `variables` vacío → `diasTrabajados` cae a `?? 30`. `datos_laborales.fecha_ingreso` existe (migración 68) pero **nunca** se usa para prorratear. Un ingreso o egreso a mitad de mes recibe una liquidación de mes completo salvo que el usuario edite los días a mano en cada una. | En `generar`, si `fecha_ingreso` (o una futura `fecha_termino`) cae dentro del período, calcular `dias_trabajados` proporcional y avisar en la respuesta qué liquidaciones se prorratearon. |
| 6 | Media | `backend/src/routes/remuneraciones.ts:336-385` | `POST /liquidaciones/:id/emitir` no verifica si la liquidación **ya** está `emitida`. Re-emitir regenera el PDF, y sobrescribe `emitida_en` (se pierde la fecha original de emisión) y `pdf_url`. | Al inicio del handler: si `estado === 'emitida'` → `409` "ya fue emitida" (o devolver el PDF existente sin tocar nada). |
| 7 | Media | `packages/shared/src/liquidacionChile.ts:15` (comentario) | Licencias médicas / subsidios están fuera de alcance y **no hay ningún aviso**. Si un colaborador tuvo licencia, su liquidación se calcula como mes trabajado normal (imponible completo, cotizaciones completas), lo cual es incorrecto (el subsidio lo paga la entidad de salud, no es remuneración imponible). | Como mínimo, un campo "tuvo licencia este período" en las variables del mes que bloquee la emisión con un aviso ("esta liquidación requiere ajuste manual por licencia médica"). Idealmente modelar días de licencia. |
| 8 | Media | `backend/src/routes/remuneraciones.ts:57-86` | Si mindicador.cl no responde para un **período nuevo**, `asegurarParametros` devuelve `null` y el mensaje dice "Cárgalas a mano y vuelve a intentar" (`:49`). Pero `PATCH /parametros/:periodo` hace `.update(...).eq("periodo", periodo)` — si la fila no existe, actualiza 0 registros en silencio. **No hay forma de crear la fila del período sin mindicador.** El usuario queda bloqueado hasta que mindicador se recupere. | Que `PATCH /parametros/:periodo` haga `upsert` (crear si no existe, sembrando `tramos_impuesto` con `TRAMOS_IMPUESTO_UNICO_BASE`), o agregar un `POST /parametros` explícito para carga manual. |
| 9 | Media | `backend/src/remuneraciones/archivoPrevired.ts:32-41` | `partirNombre()`: si `apellido_paterno` no está cargado, adivina "las últimas 2 palabras = apellidos". Los nombres chilenos suelen tener 2 nombres + 2 apellidos, o apellidos compuestos ("de la Fuente", "Del Río") — la heurística falla seguido. Previred identifica por RUT pero el nombre mal partido genera rechazos/observaciones. `datos-laborales` PUT acepta `apellido_paterno`/`apellido_materno` como opcionales (`remuneraciones.ts:162-163`) y nada obliga a cargarlos. | Hacer `apellido_paterno` obligatorio en `datos_laborales` cuando el módulo está activo, o al menos bloquear la exportación Previred si algún colaborador no lo tiene. |
| 10 | Media | `backend/src/remuneraciones/archivoPrevired.ts:45-117` | Campos con valor fijo/placeholder en el archivo Previred (105 campos). Detalle en la sección de hallazgos Alta más abajo (se trata como Media porque el código y la UI ya lo marcan como borrador, pero son los campos concretos a corregir). | Ver detalle abajo. Validar el archivo completo contra el validador oficial de Previred con un contador antes del primer envío real. |
| 11 | Media | `supabase/migrations/69_...sql` + `backend/src/routes/remuneraciones.ts:277-334` | Auditoría incompleta: `liquidaciones.creado_por` se guarda al generar, pero **no existe `emitida_por`** (se sabe *cuándo* se emitió, no *quién*) ni registro de quién editó un borrador (solo `actualizado_en`, sin usuario). Es información con implicancia legal/laboral. | Agregar `emitida_por uuid` y registrar el `req.userId` en `emitir` y en `PATCH`. Considerar una tabla `liquidaciones_auditoria` (quién, cuándo, qué cambió). |
| 12 | Baja | `packages/shared/src/liquidacionChile.ts` (no existe) | No hay ninguna validación de que `sueldo_base` (prorrateado por días completos) sea ≥ ingreso mínimo. El parámetro `ingresoMinimo` solo se usa para el tope de gratificación (`:37`, `parametros.ts:69`). Para un trabajador de jornada completa un sueldo bajo el IMM es ilegal. | Aviso (no bloqueo) en `generar`/`emitir` si `sueldo_base < ingreso_minimo` y `dias_trabajados == 30` y jornada completa. |
| 13 | Baja | `backend/src/remuneraciones/resumenPrevisional.ts:64` | Hardcodea `"07"` para Fonasa en vez de usar la constante `CODIGO_FONASA` de `@bitacora/shared` (que también vale `"07"`). Si la constante cambia, este archivo diverge. | Importar y usar `CODIGO_FONASA`. |
| 14 | Baja | `backend/src/routes/remuneraciones.ts:16` | `PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/` acepta cualquier año — se puede generar la nómina de `2030-01`, y `asegurarParametros` sembraría ese período con la UF/UTM actual. | Rechazar períodos futuros (> mes en curso) en `generar` y en `parametros`. |
| 15 | Baja | `backend/src/remuneraciones/libroRemuneracionesDT.ts:23-69` | El Libro de Remuneraciones DT generado tiene ~37 columnas; el formato LRE oficial tiene bastantes más (semana corrida, participación, aguinaldos, viáticos, asignación de zona, etc.). El comentario (`:10-12`) lo reconoce. Tal como está no pasa el validador de la DT. | Completar el set de columnas obligatorias del LRE (todas en 0 si no se usan, pero presentes y en orden). Validar con el validador de la DT. |
| 16 | Baja | `packages/shared/src/liquidacionChile.ts:161` | `baseTributable = baseImponible − cotizacionAfp − comisionAfp − salud7 − cotizacionAfc`. Incluir la **comisión AFP** en lo que rebaja el impuesto es lo habitual (es cotización obligatoria), pero es un punto con interpretaciones distintas. | Confirmación puntual con un contador de que la comisión AFP rebaja la base tributable (probablemente sí — dejar constancia). |
| 17 | Baja | `packages/shared/src/liquidacionChile.ts:114` + `routes/remuneraciones.ts:313` | `diasTrabajados: 0` → `prop = 0` → toda la liquidación en 0, `liquidoPagar = 0`. Esa liquidación de $0 se puede emitir. | Bloquear la emisión si `dias_trabajados == 0` (o si `total_haberes == 0`). |
| 18 | Baja (informativo) | `backend/src/tenant.ts:13-20` | `datos_laborales` y `liquidaciones` no están en `TABLAS_POR_EMPRESA`, así que no pueden usar los helpers tipados `seleccionarDeEmpresa`/etc. Las rutas hacen el `.eq("empresa_id", req.empresaId!)` a mano — **de forma consistente** en todos los endpoints revisados — así que no hay bug hoy, pero se pierde la red de seguridad para rutas futuras. | Agregarlas a `TABLAS_POR_EMPRESA` y migrar las consultas a los helpers cuando se toque el archivo. |

---

## Detalle de hallazgos Alta

### 1. UF/UTM no corresponden al período liquidado

**Archivo:** `backend/src/remuneraciones/parametros.ts:40-50`

```ts
async function traerUfUtm(): Promise<{ uf: number; utm: number } | null> {
  const res = await fetch("https://mindicador.cl/api", { signal: AbortSignal.timeout(8000) });
  ...
  return { uf: d.uf.valor, utm: d.utm.valor };
}
```

`https://mindicador.cl/api` devuelve el último valor publicado de cada indicador. Escenario
real: el contador cierra la nómina de **septiembre** el **2 de octubre**. Ese día,
`mindicador.cl/api` ya devuelve la **UTM de octubre** (se publica a fin del mes anterior) y
la **UF del ~1-oct**. Esos valores quedan en `parametros_previsionales` para el período
`2026-09` y, vía `armarLiquidacion` → `detalle.parametros`, en el snapshot inmutable de
cada liquidación.

Impacto: la UTM escala los 8 tramos del impuesto único; un desfase de un mes cambia el
impuesto de todo el que tribute. Los topes imponibles se expresan en UF y se convierten a
pesos con `p.uf` (`liquidacionChile.ts:136-137`) — un desfase de UF mueve el tope en pesos.

**Diff sugerido (referencia, no aplicar):**

```ts
// parametros.ts
async function traerUfUtm(periodo: string): Promise<{ uf: number; utm: number } | null> {
  const [anio, mes] = periodo.split("-");
  const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate();
  try {
    const [ruf, rutm] = await Promise.all([
      fetch(`https://mindicador.cl/api/uf/${ultimoDia}-${mes}-${anio}`, { signal: AbortSignal.timeout(8000) }),
      fetch(`https://mindicador.cl/api/utm/${mes}-${anio}`, { signal: AbortSignal.timeout(8000) }),
    ]);
    if (!ruf.ok || !rutm.ok) return null;
    const uf = (await ruf.json())?.serie?.[0]?.valor;
    const utm = (await rutm.json())?.serie?.[0]?.valor;
    if (typeof uf !== "number" || typeof utm !== "number") return null;
    return { uf, utm };
  } catch {
    return null;
  }
}
```

(Validar el shape exacto de `mindicador.cl/api/uf/DD-MM-YYYY` antes de implementar.)

---

### 2. `parametros_previsionales` global + endpoint sin scoping ni auditoría

**Archivos:** `supabase/migrations/67_remuneraciones_parametros.sql:11-38`,
`backend/src/routes/remuneraciones.ts:57-99`

La migración 67 crea `parametros_previsionales` y `afp_parametros` **sin `empresa_id`**
(comentario explícito: *"los parámetros son datos de referencia comunes a todas las
empresas"*). El endpoint:

```ts
remuneracionesRouter.patch("/parametros/:periodo", ah(async (req, res) => {
  ...
  const { error } = await supabase.from("parametros_previsionales").update(cambios).eq("periodo", periodo);
  ...
  await supabase.from("afp_parametros").update({ tasa_comision: ... }).eq("periodo", periodo).eq("afp", a.afp);
```

Está montado con `requiereModulo("remuneraciones")` (`server.ts:296`), es decir cualquier
usuario con rol `admin` o `contador` (o un rol custom con el módulo) de **cualquier
empresa que tenga el módulo contratado**. Ese usuario puede reescribir la UF, la UTM, los
topes, la tasa SIS, la tasa mutual base y la **tabla completa de tramos del impuesto
único** (`:77`, `cambios.tramos_impuesto = b.tramos_impuesto` — sin validar la estructura)
para un período, y afecta el cálculo de **todas** las empresas.

No hay auditoría: solo se setea `fuente = 'manual'` y `actualizado_en`. No se sabe qué
empresa ni qué usuario hizo el cambio.

**Mitigación que ya existe:** las liquidaciones ya `emitida` conservan su `detalle`
snapshot, así que no cambian retroactivamente. Pero las `borrador` y las aún no generadas
sí usarían los valores alterados.

**Opciones:**
- **(a) Restringir la edición al Super-Admin.** Mover `PATCH /parametros/:periodo` a
  `superadminRouter` (`/api/superadmin/remuneraciones/parametros/:periodo`) y dejar en el
  router de empresa solo el `GET`. Es lo más simple y coherente con "datos de referencia
  comunes".
- **(b) Parámetros por empresa.** Agregar `empresa_id` a `parametros_previsionales` /
  `afp_parametros`, seed por empresa la primera vez, scoping en todas las consultas. Más
  trabajo, más flexible (una empresa con convenio mutual distinto, etc.).
- En ambos casos: validar `tramos_impuesto` (array de `{desde, hasta, factor, rebaja}`
  numéricos, ordenados, sin solapamiento) y registrar `actualizado_por`.

---

### 3. Sin validación de `datos_laborales` antes de generar / emitir

**Archivos:** `backend/src/routes/remuneraciones.ts:219-275`, `:336-385`;
`supabase/migrations/68_...sql:16` (`sueldo_base ... default 0`)

`POST /liquidaciones/generar` toma todos los `datos_laborales` con `activo = true` y para
cada uno llama `armarLiquidacion(periodo, d, params, {})` sin chequear nada. Casos que
pasan sin aviso:

- `sueldo_base = 0` (el default de la columna) → liquidación con todo en $0, emitible.
- `afp = null` → `cotizaAfp: Boolean(datos.afp)` = `false` (`calcular.ts:38`) → **cero
  descuento AFP**. Si el trabajador debía cotizar, la liquidación está mal y el trabajador
  aparece sin cotización previsional.
- Sin RUT (`usuarios.rut` nulo) → la liquidación se genera igual; recién en `/exportar` se
  cuenta `sinRut` y se manda en un header `X-Aviso` (`:449`, `:470`) que el frontend
  puede o no mostrar.
- `sistema_salud = 'isapre'` pero `plan_isapre_uf` y `plan_isapre_pesos` ambos nulos →
  `saludAdicional = 0`, se trata como Fonasa de hecho.

`emitir` tampoco valida — emite lo que haya.

**Recomendación:** una función `validarDatosLaborales(d): string[]` que devuelva la lista
de problemas, llamada en `generar` (saltar ese colaborador y reportarlo en la respuesta:
`{ generadas, omitidas_emitidas, omitidas_incompletas: [{usuario_id, faltan}] }`) y en
`emitir` (bloquear con `400` + lista). Reglas mínimas: `sueldo_base > 0`, decisión
explícita sobre AFP (nula solo si un flag `no_cotiza_afp` está seteado), RUT presente,
coherencia salud/plan.

---

### Detalle del hallazgo 10 — campos placeholder del archivo Previred

`backend/src/remuneraciones/archivoPrevired.ts`, función `registro()`:

| Campo (pos.) | Línea | Valor actual | Problema |
|---|---|---|---|
| Sexo (6) | `:68` | `""` | Nunca se captura. El validador de Previred lo suele exigir (M/F). |
| Región / Comuna prestación (11, 12) | `:73-74` | `""` | Nunca se capturan. |
| Tramo asignación familiar (18) | `:80` | `"D"` fijo (sin derecho) | Incorrecto si la empresa paga asignación familiar (la tabla `asignacion_familiar_tramos` existe pero no se siembra ni se usa). |
| Código ex-caja / IPS (45) | `:93` | `"0000"` | Asume que nadie está en IPS/INP (solo AFP). Válido para una empresa nueva, placeholder en general. |
| Moneda plan salud (53) y cotización pactada (54) | `:99-100` | Si el plan es **en pesos**, manda `"$"` y `"0"` | Para una Isapre con plan en pesos, la cotización pactada se envía como 0. Solo el path `plan_isapre_uf` está implementado. |
| Código CCAF (70) | `:105` | `"0"` | Sin soporte de Caja de Compensación. |
| Código Mutual / ISL (85) | `:108` | `"0"` fijo | Toda empresa está afiliada a una mutual (ACHS / IST / Mutual CChC) o al ISL. Previred necesita el código real. No se captura en ningún lado. |
| ~65 campos restantes | `:57` (`new Array(105).fill("0")`) | `"0"` | Solo ~40 posiciones se setean explícitamente. El resto queda en `"0"`. Muchos corresponden legítimamente a 0 (APVI, APVC, depósitos convenidos, cuenta 2, etc.) pero **las posiciones son aproximadas** — los comentarios dicen `"(26-37 aprox.)"`, `"(50-63 aprox.)"`. Si el layout real de Previred difiere en una sola posición, todo el archivo queda corrido. |

Además, los **códigos de Isapre** (`liquidacionChile.ts:237-249`) están marcados
`REVISAR` en el propio código — confirmar contra el listado vigente de Previred.

**Recomendación:** no liberar el archivo Previred hasta que un contador lo pase por el
validador oficial (gratis en previred.cl) con datos reales de al menos 2-3 trabajadores de
distinta configuración (Fonasa / Isapre UF / Isapre pesos / con y sin cargas). Capturar
antes: sexo, mutual de la empresa, apellidos paterno/materno, y (si aplica) región/comuna.

---

## Lo que está bien (para no re-auditarlo)

- **`liquidacionChile.ts` es una función pura** con todos los insumos variables
  parametrizados. No hay topes, tasas ni tabla de impuesto hardcodeados dentro del
  cálculo (`TRAMOS_IMPUESTO_UNICO_BASE` es solo semilla; el cálculo lee `p.tramosImpuesto`).
- **`liquidaciones.detalle`** guarda un snapshot **completo**: `parametros` (uf, utm,
  ingresoMinimo, topes, tasas, tramos, comisión AFP) + `entrada` (todos los inputs) +
  `resultado` (`calcular.ts:96-103`). Una liquidación vieja se puede re-explicar aunque
  los parámetros del período hayan cambiado después.
- **Inmutabilidad de `emitida`:** `PATCH /liquidaciones/:id` la rechaza (`:290-293`);
  `generar` salta las emitidas (`:242-256`). No hay endpoint de DELETE ni de "des-emitir".
- **Redondeo consistente:** `const r = Math.round` aplicado en cada haber
  (`liquidacionChile.ts:117-123`), los topes (`:136-137`), cada cotización (`:142-156`);
  los totales son sumas de valores ya redondeados → enteros.
- **Aislamiento entre empresas:** todos los endpoints de `datos_laborales` y
  `liquidaciones` scopean con `.eq("empresa_id", req.empresaId!)` (de `requiereEmpresa`);
  ningún parámetro de request permite pasar otro `empresa_id`.
- **RLS de las tablas sensibles:** `datos_laborales` y `liquidaciones` tienen
  `enable row level security` + policy `empresa_id = empresa_actual()` (migraciones 68,
  69). Para `anon`/`authenticated` vía PostgREST, `empresa_actual()` es null → deny. Los
  sueldos **no** quedan expuestos por la anon key (a diferencia de las 19 tablas que tuvo
  que arreglar la migración 73).
- **Control de acceso:** `requiereModulo("remuneraciones")` (`server.ts:296`) = rol con el
  módulo (`admin` o `contador` por defecto, o rol custom) **y** empresa con el módulo
  contratado. `supervisor` y `colaborador` no lo tienen (`permisos.ts:41-43`). No existe
  ningún endpoint por el que un colaborador vea su propia liquidación (ni la de otro) —
  no hay superficie para una fuga entre trabajadores.
- **Fallo de mindicador:** `GET /parametros/:periodo` y `POST /liquidaciones/generar`
  devuelven `503` con mensaje accionable ("Cárgalas a mano / en Parámetros y reintenta")
  — salvo el problema del hallazgo 8 (no se puede *crear* la fila a mano).
