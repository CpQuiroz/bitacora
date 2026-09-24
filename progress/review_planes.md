# Review — tarea 124 planes_4_categorias (commit b77203a)

**Veredicto:** RECHAZADO (CHANGES_REQUESTED)

Motivo principal: el tope de 20 informes IA de Operación no llega al cliente en
las 2 pantallas de Informes que usa la web (se guarda un informe vacío con 201).
Además `cambiarPlanEmpresa` ignora el error del `update` de `empresas`, lo que
con la migración 131 pendiente en prod desincroniza plan y módulos.
El resto del diseño está bien resuelto.

## Verificación
- `./verificar.sh` con Node 22 → **verde** (tsc x6, shared 32 tests, design-tokens 5,
  backend 7, eslint, audit:tenant 0, migraciones 131). Con el Node 20 de Homebrew
  del shell del revisor falla en entorno (versión de Node, glob de `tsx --test`,
  WebSocket nativo), no por el código.
- Lecturas a prod (solo SELECT): empresas = 2 `pro` + 1 `trial`;
  `suscripciones.plan_pendiente` todo null; los nombres de check coinciden con los
  que borra la 131 (`empresa_plan_historial_plan_anterior_check`,
  `..._plan_nuevo_check`, `suscripciones_plan_pendiente_check`); `empresas` no
  tiene check de plan; `pack_rubro` no existe; la última migración aplicada es la 130.
- No hay evidencia E2E contra dev (endpoint real /api/plan/cambiar,
  /api/plan/cotizar-empresa, tope IA) en progress/current.md.

## Criterios (descripción de la tarea 124, no tiene `acceptance` explícito)
- [x] 4 planes + prueba, precios UF, etiquetas → packages/shared/src/planes.ts:18-35; types.ts:24-27
- [x] Packs de Operación → planes.ts:48-52; test planes.test.ts:12-22
- [x] Prueba = todo como Pro con 3 usuarios → limites.ts (shared) :27; planes.test.ts:24-28; limites.test.ts:13-18
- [x] Remuneraciones fuera del plan → planes.test.ts:30-32
- [ ] **Operación con tope de 20 informes IA/mes, aplicado de punta a punta** → backend/src/limites.ts:133-150
      cuenta bien, pero informe.ts:349 y :466 se tragan el error (ver hallazgo 1). Sin test backend.
- [x] Flow: un Plan de Flow por plan pago → backend/src/flow.ts:82-90 (usado en plan.ts:86, suscripcion.ts:52, :105, :197)
- [x] Web Configuración > Plan y Super-Admin → ver sección 5
- [ ] Migración aplicada en prod → pendiente (a cargo de la humana; la tarea sigue `in_progress`, correcto)

## Hallazgos

### 1. [ALTA] El 403 LIMITE_PLAN no llega al cliente en /api/informe/estructurado ni /personalizado
- `backend/src/routes/informe.ts:348-350` (estructurado) y `:465-467` (personalizado):
  `catch (err) { console.error(...) }` también atrapa `LimiteAlcanzadoError`, que
  `crearMensajeIA` lanza desde `claude.ts:70`.
- Qué pasa: una empresa Operación con 20 informes en el mes pide el 21 en
  Informes → la respuesta es **201 con `resultado: null`**, que además queda
  guardado en `informes_generados` (el historial se llena de informes vacíos) y
  no se muestra ningún motivo. Son justo los 2 endpoints que usa
  `web/src/app/dashboard/informe/page.tsx:304` y `:339`. Ya pasaba con el tope
  de tokens (`verificarLimiteIA`), pero ahora hay un tope que se va a alcanzar
  de verdad.
- Bien resuelto: `/api/informe` (libre, informe.ts:141-150) relanza lo
  desconocido → handler global → 403 (server.ts:440-441), y `generarInformeOS`
  relanza en `claude.ts:209` → `trabajos.ts:2005` dentro de `ah()` → 403.
- Cambio: en los dos catch, `if (err instanceof LimiteAlcanzadoError) throw err;`
  antes del console.error (igual que claude.ts:209), y que la web muestre
  `body.error` cuando llega 403.

### 2. [MEDIA-ALTA] `cambiarPlanEmpresa` ignora errores de `empresas.update` → plan y módulos se desincronizan
- `backend/src/planes.ts:37` y `:42` no revisan `error`. Si el `update` falla, se
  aplican igual los módulos (`:43`) y se escribe el historial (`:46`); en el
  camino con tarjeta, la suscripción de Flow ya se canceló y se creó otra
  (`plan.ts:103-112`). El comentario de encabezado dice que esta función existe
  justamente para que eso **no** pase.
- El caso concreto: el deploy es push a `main`. Si el backend sale antes de que
  se corra la 131 en prod, **todo** `update`/`select` con `pack_rubro` falla:
  - planes.ts:37 → `actual` null → `planAnterior = "trial"` (historial falso)
  - planes.ts:42 → el plan no cambia, pero los módulos sí
  - plan.ts:25-29 (GET /api/plan) → `empresa` null → las 2 empresas Pro se ven
    como "Prueba gratis"
  - superadmin/routes.ts:1197 → **404 "Empresa no encontrada"** para todas las empresas
- Cambio: lanzar si hay `error` en planes.ts:37/:42 (y en el insert del historial),
  y dejar escrito en progress/current.md que **la 131 se aplica en prod antes de
  mergear a main** (hoy la lista de pasos de la usuaria no pone ese orden).

### 3. [MEDIA] Un cambio de plan pisa las personalizaciones de módulos del núcleo
- `aplicarModulosDelPlan` (planes.ts:19-27) hace upsert de los 16
  `MODULOS_GESTIONADOS_POR_PLAN`; antes solo tocaba los 5 opt-in.
- En prod hay una empresa **Pro** con `cobros`, `cotizaciones`, `viajes`, `rutas`
  y `agenda_pro` en `activado=false` (se apagaron a mano). El próximo cambio de
  plan (Pro→Empresa, o que un Super-Admin guarde el plan) los prende todos sin
  aviso. La migración no los toca (bien), pero este cambio de comportamiento no
  está documentado ni se le avisa al Super-Admin (texto en
  web/src/app/superadmin/empresas/[id]/page.tsx:955-957).
- Cambio: decisión de producto. O se conservan los `false` manuales al subir de
  plan (solo apagar lo que el plan nuevo no trae y prender lo que el plan
  anterior no traía), o se documenta el comportamiento y se avisa en el panel.

### 4. [BAJA] Pack guardado antes de confirmar la tarjeta
- `suscripcion.ts:116-118` escribe `empresas.pack_rubro` al **iniciar** el registro
  de tarjeta. Si la persona abandona el pago, el pack queda guardado igual y
  después lo usa un Super-Admin que asigne Operación sin elegir pack
  (superadmin/routes.ts:1371-1377 → planes.ts:40). No rompe nada: el flujo con
  tarjeta pendiente sí funciona de punta a punta (el pack guardado lo usa
  `cambiarPlanEmpresa` en suscripcion.ts:64 y :213). Alternativa más limpia:
  guardarlo en `suscripciones` junto a `plan_pendiente`.

### 5. [BAJA] Cambio de pack sin rastro para la empresa
- planes.ts:45: con el mismo plan (Operación A → B) no se escribe
  `empresa_plan_historial`. El Super-Admin queda en auditoría
  (superadmin/routes.ts:1379-1383), pero el cambio de pack que hace la propia
  empresa (plan.ts:81) no deja rastro.

### 6. [BAJA] /api/plan/cotizar-empresa sin límite de envíos
- plan.ts:136-179: cualquier usuario con `gestionar_plan` puede disparar correos
  sin límite a todos los Super-Admin. Conviene un rate limiter (hay
  `rateLimiters.ts`) o un tope por empresa por día.
- Lo demás está bien: el HTML se escapa (`escaparHtml` en nombre, rut, plan,
  correo y mensaje; `usuarios` se valida como entero y se acota); el mensaje se
  corta a 2000 caracteres; solo se exponen nombre, RUT, plan, cantidad de
  usuarios activos y el correo de quien pide, a Super-Admins; `reply_to` es el
  campo correcto para la API REST de Resend; `super_admins` es global (no lleva
  empresa_id) y el conteo de usuarios filtra por `empresa_id`.

### 7. [BAJA] Detalles de la UI de Plan (web/src/app/dashboard/configuracion/plan/page.tsx)
- :392: una empresa en Operación con `pack_rubro = null` (asignada por el
  Super-Admin desde mobile, que no manda pack) ve "Cambiar a pack X" aunque ya
  tiene los módulos de Transporte.
- :166-170: bajar de Empresa→Pro o de Pro→Operación no avisa que baja el tope
  de usuarios (100→30→15). No hay módulos que se pierdan, así que no se pide
  confirmación.
- Todo lo demás es correcto: plan actual, contratable según `contratables`,
  "Disponible pronto", Empresa con "Contratar con tarjeta" + "Pedir
  cotización", confirmación de bajada que se recalcula al cambiar de pack, y
  cambio de pack en el mismo plan.

### 8. [BAJA] Detalles de estilo
- plan.ts:78 "Ya estás en ese plan" responde 400; según convenciones.md
  §Manejo de errores debería ser 409 (conflicto de estado).
- El APK instalado (1.10.17) muestra la clave cruda "operacion" y "A undefined"
  en Mi plan (MiPlanScreen viejo: `ETIQUETA_PLAN[...]` sin fallback en la línea
  135). No hace falta build ahora: queda para la tarea 126.

## Revisados sin problemas
- **Flujos de cambio de plan:** con tarjeta pendiente (plan.ts:97-100 →
  suscripcion.ts:92-118 → :64 / :213); con tarjeta ya registrada
  (plan.ts:102-120, `packElegido`); mismo plan Operación con otro pack
  (plan.ts:74-83, no toca Flow); Super-Admin (routes.ts:1350-1377, valida el
  pack y conserva el anterior si no viene); `flowPlanIdDe` cubre los 4 planes pagos.
- **Historial:** solo se escribe cuando el plan cambia de verdad (planes.ts:45);
  los checks aceptan los 5 valores (migración 131:15-22).
- **Migración 131:** es aditiva e idempotente (`drop ... if exists`,
  `add column if not exists`, `on conflict do update`) y no crea tablas. Los
  datos de prod cumplen los checks nuevos. Solo prende módulos a la empresa en
  prueba, que no tiene ningún módulo en `false` en prod. Las empresas Pro no
  cambian de módulos.
- **Tope de informes IA:** alcanza el índice existente
  `ia_uso(empresa_id, creado_en)` (migración 38:12). `feature IN (...)` se
  filtra sobre pocas filas por empresa y mes; no hay índice nuevo, así que no
  aplica EXPLAIN. Los nombres de las features coinciden con `FeatureIA`
  (claude.ts:36-43). El conteo solo incluye llamadas exitosas (registrarUsoIA,
  claude.ts:84). Con requests concurrentes se puede pasar el tope por 1-2
  informes (aceptable). La lógica de inicio de mes en UTC es la misma que usan
  los otros topes.
- **Regresiones:** no se pierden módulos en las empresas Pro/Básico (la 131 no
  las toca); `MODULOS_GESTIONADOS_POR_PLAN` ∪ {remuneraciones} = `MODULOS`;
  mobile compila (tsc mobile en verde, solo cambian etiquetas importadas de
  shared). En el backend no queda ningún `"basico"`/`"pro"` fijo fuera de las
  listas.

## Arquitectura / Convenciones
- [x] No se agregó `supabase.from` en web ni mobile.
- [x] Multi-tenant: todas las queries nuevas a tablas de empresa filtran por
  `empresa_id` (limites.ts:139-142, plan.ts:25-29, :85, :91,
  suscripcion.ts:117, planes.ts:22-24); `audit:tenant` = 0.
- [x] Sin tablas nuevas → no hace falta RLS nueva. Sin RPC nuevas. Sin dependencias nuevas.
- [ ] Manejo de errores: planes.ts:37/:42 no revisan `error` (hallazgo 2);
  plan.ts:78 usa 400 donde corresponde 409.
- [x] Migración con numeración correlativa (131) y aditiva.

## CHECKPOINTS
- C1: [x] el arnés está completo y `./verificar.sh` sale con exit 0 (Node 22).
- C2: [x] hay 1 sola tarea `in_progress` (124) y current.md describe la sesión activa.
- C3: [x] capas, tenant, RLS, RPC y dependencias OK.
- C4: [ ] hay tests de shared, pero no de la lógica de backend nueva
  (verificarLimiteInformesIA, cambiarPlanEmpresa con pack), no hay E2E contra dev
  y la migración 131 todavía no se aplicó en prod.
- C5: [x] hay commit de respaldo (b77203a), no hay temporales sin trackear (solo
  supabase/.temp, que no es de esta tarea) y no se hizo build mobile (correcto).

## Cambios requeridos
1. informe.ts:348-350 y :465-467: relanzar `LimiteAlcanzadoError` (queda 403
   LIMITE_PLAN) en vez de guardar un informe vacío; que la web muestre el mensaje.
2. planes.ts:37/:42 (y el insert de :46): revisar `error` y lanzar si falla.
3. Dejar escrito en progress/current.md: correr la 131 en prod **antes** de mergear a main.
4. Probar contra dev: cambiar a Operación con pack, cambiar de pack, bajar a
   Esencial, cotizar-empresa y el informe 21 con tope (se puede sembrar `ia_uso`
   con service_role y limpiar después). Anotar la evidencia en current.md.
5. (Decisión de producto, hallazgo 3) Definir si un cambio de plan puede pisar
   los módulos del núcleo que se apagaron a mano, y documentarlo.
