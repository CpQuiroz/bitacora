# Auditoría de cumplimiento — Ley 21.719 (Protección de Datos Personales, Chile)

> **Fecha:** 3-sep-2026 · **Alcance:** solo lectura y reporte técnico. **No es una
> opinión legal.** Es un mapa de dónde está el código hoy frente a las obligaciones de
> la ley, para revisar con un abogado antes de la plena vigencia (**1-dic-2026**).
> No se modificó código ni base de datos.
>
> Donde la interpretación de un artículo específico no es evidente desde el código, se
> marca **"confirmar con abogado"** en vez de citar de memoria.

---

## Resumen ejecutivo

**Lo que más urge antes del 1-dic-2026, en orden:**

1. **No hay registro de consentimiento.** Ni `/registro`, ni `/onboarding`, ni la
   activación de una invitación, ni el Portal de Cliente capturan o guardan la
   aceptación de una Política de Privacidad / Términos. **No existe siquiera una página
   `/privacidad` o `/terminos`** en el sitio. La ley exige poder *demostrar* la base de
   tratamiento — hoy no hay evidencia de ninguno. **(Hallazgo #1, alto.)**

2. **No hay forma de eliminar los datos de una sola persona.** El Super-Admin puede
   borrar una empresa completa, o borrar la fila de un `usuario` **solo si no dejó
   ningún rastro operativo** (trabajos, rutas, fotos, informes). Un colaborador que
   trabajó de verdad → solo se puede "desactivar" (`activo=false`), lo que **conserva
   todos sus datos indefinidamente**. Para un cliente del Portal **no hay ninguna
   eliminación individual**. **(Hallazgo #2, alto — es el derecho que la ley pide más
   literalmente.)**

3. **No hay forma de que una persona obtenga sus propios datos.** Solo existe exportar
   una *empresa entera* (Super-Admin). Un colaborador o un cliente no tiene ningún
   mecanismo de portabilidad individual (salvo su propio historial de accesos, 20
   filas). **(Hallazgo #3, alto.)**

4. **Todos los datos personales viven fuera de Chile.** Supabase de producción está en
   `us-west-2` (Oregon, EE.UU. — ver `docs/AUDITORIA_RESILIENCIA.md:207`). Además,
   contenido con datos personales de terceros pasa por Anthropic (EE.UU.), Resend
   (EE.UU.), Meta/WhatsApp Cloud API y Vercel/Render. La ley pone requisitos especiales
   a transferencias internacionales. **(Hallazgo #4, alto — requiere base legal +
   resguardos + posiblemente informar al titular.)**

5. **No hay política de retención ni limpieza de datos.** Ninguna tabla de logs se
   purga (salvo `idempotencia`). Nada define qué pasa con los datos de clientes/
   colaboradores cuando una empresa cancela la suscripción. **(Hallazgo #5, medio.)**

**Ya resuelto / no es problema:**

- **Biometría (huella / Face ID):** es 100 % local al dispositivo
  (`mobile/src/lib/biometria.ts` — usa `expo-local-authentication`; `AsyncStorage` solo
  guarda un booleano `biometria:activa`). **No se envía ni se guarda ningún dato
  biométrico en el backend.** Confirmado.
- **Aislamiento entre empresas (RLS / multi-tenancy):** cubierto en otro documento — no
  se re-analiza acá. Cada tabla de datos personales tiene `enable row level security`
  con policy `empresa_id = empresa_actual()`, salvo las de "solo backend" cerradas en
  la migración 73.
- **Impersonación de Super-Admin:** ya está construida (el prompt la daba por "Fase 2 —
  no construida"). Se audita en la §8; el gap que queda es de la ley, no de gobernanza.

---

## Tabla de hallazgos

| # | Sev. | Derecho / obligación afectada | Ubicación en código | Descripción | Qué falta |
|---|---|---|---|---|---|
| 1 | **Alto** | Base legal / consentimiento demostrable | `web/src/app/registro/page.tsx` (form completo, sin checkbox ni link), `web/src/app/onboarding/page.tsx`, `web/src/app/invitacion/page.tsx`, `backend/src/server.ts:201` (`/api/registro-empresa`), `backend/src/routes/usuarios.ts:69` (`/invitar`) | Ningún flujo de alta guarda un timestamp + versión de política aceptada. No existe una ruta `/privacidad` ni `/terminos` en `web/src/app/`. El invitado activa su cuenta con un `action_link` de Supabase Auth y entra directo, sin aceptar nada. | Página de Política de Privacidad + Términos con versionado; checkbox obligatorio en `/registro` y en la activación de invitación; tabla `consentimientos` (usuario_id / cliente_id, documento, versión, timestamp, IP) insert-only. **Confirmar con abogado** qué base legal aplica a cada tratamiento (contrato laboral vs. consentimiento vs. interés legítimo) y si el consentimiento del *representante de la empresa* cubre a sus colaboradores o si cada uno debe aceptar por separado. |
| 2 | **Alto** | Derecho de cancelación / supresión ("derecho al olvido") a nivel individual | `backend/src/superadmin/routes.ts:772` (`DELETE …/usuarios/:usuarioId`), `:681` (`REFERENCIAS_BLOQUEANTES`), `:713` (`/desactivar`); `backend/src/routes/clientes.ts` (no tiene `.delete()`) | El borrado real de un `usuario` se bloquea (409) si tiene filas en `trabajos.responsable_id`, `rutas_planificadas.responsable_id`, `analisis_fotos.subida_por` o `informes_generados.usuario_id` — es decir, cualquier colaborador que trabajó. La alternativa ("desactivar") deja **nombre, RUT, teléfono, foto, zona, `datos_laborales`, historial de accesos** intactos. Para un **cliente** (incluido uno del Portal sin cuenta) no hay ningún endpoint de eliminación — solo `activo=false` vía `PATCH /api/clientes/:id`. | Un procedimiento de **anonimización individual**: reemplazar campos identificatorios por un placeholder manteniendo la integridad referencial (los `trabajos` siguen existiendo pero sin nombre de persona), o eliminación con re-parentado. Definir qué se puede borrar de inmediato (`datos_laborales`, `accesos_usuario`, `portal_codigos`) y qué se anonimiza. **Confirmar con abogado** qué plazo de conservación posterior a la baja es defendible (obligaciones laborales/tributarias suelen exigir varios años para liquidaciones y documentos de RRHH). |
| 3 | **Alto** | Derecho de acceso / portabilidad a nivel individual | `backend/src/superadmin/routes.ts:1044` (`GET …/exportar` — empresa entera), `backend/src/routes/usuarios.ts:381` (`/me/accesos` — solo 20 filas de login) | El único export existente vuelca **toda una empresa** y solo lo puede pedir el Super-Admin. Una persona (colaborador o cliente del Portal) no tiene forma de obtener "todos mis datos" de una vez. `GET /api/usuarios/me/accesos` es el único dato que el titular puede ver de sí mismo por su cuenta, y son solo los últimos 20 accesos. | Endpoint "exportar mis datos" para el titular autenticado (colaborador vía la app/web; cliente vía el Portal) que junte sus filas de `usuarios`/`clientes`, `datos_laborales`, `liquidaciones`, `accesos_usuario`, `notificaciones`, `notificaciones_cliente_log` (por `destinatario`), tareas/trabajos donde figura, etc., en un JSON descargable. Reusa el patrón de `TABLAS_POR_EMPRESA` pero acotado a la persona. |
| 4 | **Alto** | Transferencia internacional de datos personales | `docs/AUDITORIA_RESILIENCIA.md:207` (Supabase prod `us-west-2`); `backend/src/routes/asistente.ts` (herramienta `buscar_clientes` → nombre/teléfono/correo/dirección a Anthropic), `backend/src/routes/informe.ts`, `backend/src/claude.ts` (`analizarFoto`, `extraer_guia`); `backend/src/email.ts` (Resend); `backend/src/whatsapp.ts` (Meta) | La base de datos completa (usuarios, clientes, `datos_laborales`, liquidaciones, fotos de terreno) está alojada en EE.UU. El Asistente IA y el Informe IA envían **datos de contacto de clientes de la empresa** (terceros) a la API de Anthropic. Las notificaciones envían correo y teléfono de clientes a Resend y a Meta. | **Confirmar con abogado**: qué exige la Ley 21.719 para transferir a EE.UU. (¿cláusulas contractuales tipo?, ¿país con nivel adecuado?, ¿consentimiento informado del titular?). Como mínimo: mencionar explícitamente en la Política de Privacidad que los datos se procesan fuera de Chile y por qué proveedores. Evaluar si Supabase ofrece región Sudamérica (São Paulo) y el costo/latencia de migrar. |
| 5 | **Medio** | Principio de conservación limitada / retención | `backend/src/accesos.ts` (`accesos_usuario` — insert cada 4 h, sin borrado); `backend/src/routes/portal.ts:81,136` (`portal_codigos` — se marca `usado_en`, nunca se borra); `supabase/migrations/34_portal_cliente.sql` (`portal_accesos` — expira a 7 días, no se borra); `supabase/migrations/33_notificaciones_cliente.sql` (`notificaciones_cliente_log` — sin borrado); `backend/src/idempotencia.ts:94` (único con limpieza perezosa) | **No hay ningún cron ni job programado en el backend** (`grep -rn "cron\|setInterval"` → nada; `server.ts:170` lo confirma). Todas las tablas de logs/tokens crecen indefinidamente salvo `idempotencia` (`Math.random() < 0.02` borra >7 días). Ninguna define plazo de retención. `login_2fa_pendiente` / `mfa_codigo_pendiente` se validan por expiración al usarse pero las filas viejas quedan. | Definir plazos (ej. `accesos_usuario` 12 meses, `portal_codigos`/`portal_accesos` 30 días post-expiración, `notificaciones_cliente_log` 12–24 meses). Implementar limpieza — perezosa como `idempotencia`, o un job (GitHub Action con cron, mismo patrón que `keep-warm.yml`, o `pg_cron` en Supabase). **Confirmar con abogado** los plazos mínimos legales que compiten (evidencia ante la APDP, obligaciones laborales/tributarias). |
| 6 | **Medio** | Retención tras baja de la empresa | `supabase/migrations/44_suscripciones.sql`, `backend/src/empresa.ts:60` (`estado === 'dada_de_baja'` → 403), `backend/src/planes.ts` | Cuando una `suscripcion` pasa a `cancelada` o la empresa a `dada_de_baja`, el acceso se corta (403) pero **los datos quedan en la base indefinidamente**. No hay plazo definido ni proceso de eliminación/anonimización de los datos de sus clientes y colaboradores. | Política: "tras X meses de una empresa dada de baja, se eliminan/anonimizan sus datos personales", con aviso previo al admin. **Confirmar con abogado** el plazo (permitir recuperar la cuenta vs. minimización). |
| 7 | **Medio** | Minimización — tabla huérfana | `supabase/migrations/52_fusion_vehiculos_equipos.sql:47` | La tabla `vehiculos` quedó "existente pero sin uso activo — nada la referencia ya" tras la fusión con `equipos`, conservada "por si hace falta rollback". Contiene los datos previos a la migración (incluye `patente`, y según cómo se usaba, posibles asignaciones a colaboradores). | Confirmar qué datos personales retiene y si ya se puede dropear (la migración dice que se puede "en una migración posterior una vez confirmado que todo funciona en producción" — la 52 es de hace tiempo). Incluirla en el ejercicio de eliminación aunque el código no la use. |
| 8 | **Medio** | Notificación de brechas ("sin dilaciones indebidas") | `backend/src/routes/*` (tabla `errores_backend`), `backend/src/instrument.ts` (Sentry, sin DSN configurado aún), `docs/RUNBOOK_INCIDENTES.md` | `errores_backend` registra errores pero **no hay alerta activa** (nadie recibe nada; hay que entrar a mirar). Sentry está integrado pero **sin `SENTRY_DSN`** en Render → inerte. No hay ningún mecanismo que detecte un *acceso indebido exitoso* (que no genera error). El ejemplo concreto: el gap de RLS cerrado en la migración 73 — si alguien lo hubiera explotado antes del fix, **no habría quedado rastro ni alerta**. | Configurar `SENTRY_DSN` en Render (ya pendiente en la lista del proyecto). Definir en el Runbook un procedimiento explícito de "sospecha de brecha de datos personales": cómo evaluar alcance en horas, a quién se notifica (APDP + titulares), con qué plantilla. **Confirmar con abogado** el plazo y la forma exacta que exige la APDP. |
| 9 | **Medio** | Datos de categoría especial (salud / socioeconómicos) sin tratamiento reforzado explícito | `supabase/migrations/68_remuneraciones_datos_laborales.sql:22` (`sistema_salud` fonasa/isapre = dato de salud), `:15` (`sueldo_base`), `:19-20` (`plan_isapre_uf/_pesos`); `supabase/migrations/69_remuneraciones_liquidaciones.sql`, `70_remuneraciones_previred.sql` (`usuarios.rut`) | `datos_laborales` guarda afiliación a sistema de salud (dato sensible bajo la ley) y remuneración (dato socioeconómico; en agregación con lo anterior, categoría especial — **confirmar con abogado**). RLS protege por empresa, pero no hay marca de "base legal reforzada", ni minimización (¿se necesita el nombre del plan Isapre, o basta el monto?), ni un aviso al colaborador de que esta información se guarda. `clientes.fecha_nacimiento` (migración 58) se guarda para la felicitación de cumpleaños — dato personal cuya finalidad debería estar declarada. | Declarar en la Política de Privacidad qué datos sensibles se tratan, con qué finalidad y base legal. Evaluar minimización en `datos_laborales`. **Confirmar con abogado** si el volumen de datos laborales que maneja Remuneraciones obliga a designar un **Delegado de Protección de Datos**. |
| 10 | **Bajo-Medio** | Derecho de acceso — saber que la cuenta fue impersonada | `backend/src/superadmin/routes.ts:838` (`/impersonar`), `backend/src/superadmin/auth.ts:127` (`registrarAuditoria` → `super_admin_auditoria`); `backend/src/empresa.ts:106` (impersonación NO se registra en `accesos_usuario`) | La impersonación queda registrada con justificación en `super_admin_auditoria`, pero esa tabla **solo la ve el Super-Admin**. El usuario impersonado no tiene forma de enterarse — `GET /api/usuarios/me/accesos` explícitamente **no** incluye los eventos de impersonación (comentario en `empresa.ts:106`). | Si un titular ejerce su derecho de acceso, debería poder saber si su cuenta fue impersonada, cuándo y con qué justificación declarada. Opción: incluir los eventos de impersonación (fecha + motivo, sin exponer identidad del Super-Admin si no corresponde) en el export individual del hallazgo #3. **Confirmar con abogado** si la justificación completa debe mostrarse al titular. |
| 11 | **Bajo** | Rectificación por el titular | `backend/src/routes/usuarios.ts` (`PATCH /me` — el colaborador edita su propio perfil), `web/src/app/dashboard/configuracion/cuenta/page.tsx`; Portal de Cliente (`backend/src/routes/portal.ts` — solo lectura) | El colaborador puede rectificar su propio perfil (nombre, teléfono, foto, etc.), pero **no** su `rut` ni sus `datos_laborales` (los edita el admin/contador). Un **cliente del Portal no puede rectificar nada** — el Portal es de solo lectura; si ve un error en su nombre o dirección depende de que la empresa lo corrija manualmente. | Mecanismo para que el cliente del Portal solicite una corrección (aunque sea un formulario que genere una notificación al admin). Documentar qué campos rectifica el titular directamente y cuáles requieren solicitud. |
| 12 | **Bajo** | Oposición al tratamiento para fines de contacto | `supabase/migrations/16_configuracion_resto.sql:73` (`notificaciones_config` — por empresa), `supabase/migrations/29_gestion_control.sql:57` (`notificaciones_preferencias` — por usuario), `backend/src/notificarCliente.ts` | `notificaciones_config` es **por empresa** (la empresa decide si manda avisos a sus clientes), no un mecanismo del cliente para oponerse. `notificaciones_preferencias` es del **colaborador** (avisos internos). **No hay forma de que un cliente diga "no me contacten"** — ni un unsubscribe en los correos, ni un toggle en el Portal. Y el toggle cubre solo notificaciones, no otros usos de los datos del cliente. | Link de baja ("no recibir más avisos") en los correos a clientes + registro de esa oposición (tabla o campo en `clientes`). Aclarar en la Política de Privacidad que la oposición a notificaciones no implica cese de otros tratamientos necesarios para el servicio contratado por la empresa. |

---

## Derechos ARCO — estado actual

| Derecho | Mecanismo hoy | Estado |
|---|---|---|
| **Acceso** | Super-Admin exporta una empresa entera (`GET /superadmin/empresas/:id/exportar`). El colaborador ve su perfil y sus últimos 20 accesos (`/api/usuarios/me/accesos`). El cliente del Portal ve las entidades que le compartieron (trabajo/cotización/factura), no "sus datos". | **Parcial / insuficiente a nivel individual.** No hay "exportar todos mis datos" para una persona. |
| **Rectificación** | El colaborador edita su propio perfil (`PATCH /api/usuarios/me`). `rut` y `datos_laborales` los edita solo el admin/contador. El cliente **no puede rectificar** (Portal de solo lectura). | **Parcial.** Cubierto para el perfil básico del colaborador; nulo para el cliente y para los datos laborales/RUT del propio colaborador. |
| **Cancelación / supresión** | Super-Admin: "desactivar" (soft, conserva todo) o "eliminar" (bloqueado si hay historial operativo). Sin eliminación para clientes. Eliminación total solo a nivel de empresa completa. | **Ninguno a nivel individual efectivo.** Es el gap más grande. |
| **Oposición** | `notificaciones_config` (decisión de la empresa, no del cliente). Sin unsubscribe en correos. Sin toggle en el Portal. | **Ninguno para el cliente.** Parcial para avisos internos del colaborador (`notificaciones_preferencias`). |

---

## §5 — Inventario de datos personales (resumen por tabla)

| Tabla | Datos personales | De quién | RLS | Quién lee |
|---|---|---|---|---|
| `auth.users` (Supabase) | correo, hash de contraseña, metadata (`self_signup`) | usuario | (gestionado por Supabase Auth) | backend con service role; el propio usuario |
| `usuarios` | nombre, **RUT** (mig. 70), teléfono, foto, zona, función, huso horario, `fecha_vencimiento_licencia` | colaboradores / admin | ✅ `empresa_id = empresa_actual()` | admin/supervisor de la empresa; el propio usuario |
| `datos_laborales` | **sistema de salud (fonasa/isapre)**, **sueldo base**, plan Isapre (UF/$), AFP, cargas familiares, tipo de contrato, fecha de ingreso | colaboradores | ✅ | admin/contador (módulo Remuneraciones) |
| `liquidaciones` (mig. 69) | remuneración detallada por período, descuentos, líquido | colaboradores | ✅ | admin/contador; el colaborador ve la suya |
| `clientes` | nombre, **RUT** (mig. 34), dirección, lat/lng, teléfono, correo, **fecha de nacimiento** (mig. 58), notas | clientes de la empresa (terceros) | ✅ | cualquier rol de la empresa con el módulo; se envía a Anthropic/Resend/Meta según el flujo |
| `portal_accesos` / `portal_codigos` | vínculo cliente ↔ token/código; `codigo_hash` | clientes del Portal (terceros sin cuenta) | ✅ | backend; el cliente al usar el link/código |
| `notificaciones_cliente_log` | **`destinatario`** (correo o teléfono del cliente), tipo de aviso, éxito/error | clientes (terceros) | ✅ | admin/supervisor |
| `accesos_usuario` | **IP**, **user agent**, timestamp | colaboradores | ✅ | admin/supervisor (`/api/accesos`); el propio usuario (`/me/accesos`) |
| `auditoria_usuarios` | campo, valor anterior/nuevo, quién y a quién | colaboradores | ✅ | admin/supervisor |
| `super_admin_auditoria` | acción, empresa, **detalle en texto libre** (incluye nombres, IDs, correos, justificaciones de impersonación), IP | Super-Admins + usuarios afectados | (tabla de Super-Admin, no RLS por empresa) | solo Super-Admin |
| `login_2fa_pendiente` / `mfa_codigo_pendiente` | `codigo_hash`, expiración | colaboradores | ✅ / — | backend |
| `whatsapp_conversaciones` (mig. 63) | teléfono, contenido de mensajes del bot | choferes / clientes | ✅ | backend; admin según el flujo |
| `vehiculos` (huérfana, mig. 52) | patente, datos previos a la fusión | — | (heredada) | nadie (sin uso activo) |

---

## Pendiente de verificación legal / manual

Esto **no se puede confirmar desde el código** — es checklist para revisar con abogado:

1. **Base legal por tratamiento.** Contrato laboral (colaboradores), ejecución de
   contrato / interés legítimo (clientes de la empresa), consentimiento (marketing /
   cumpleaños). Decidir cuál aplica a cada uno y reflejarlo en la Política de Privacidad.
2. **Contratos con encargados de tratamiento (DPA).** Un DPA firmado o aceptado por
   cada proveedor que trata datos personales por cuenta de Bitácora:

   | Proveedor | Qué datos personales recibe | ¿DPA? |
   |---|---|---|
   | **Supabase** | Todo (DB + Auth + Storage) | ¿DPA estándar en sus ToS? (probable — verificar) |
   | **Vercel** | Logs de request, IPs (hosting del frontend) | ¿DPA estándar? |
   | **Render** | Logs de request, IPs, variables de entorno (hosting del backend) | ¿DPA estándar? |
   | **Anthropic (API)** | Contenido de OS/clientes en prompts del Informe IA y el Asistente; fotos de terreno (`analizarFoto`, OCR de guías) | Verificar los términos comerciales de la API (zero-retention / no-training) |
   | **Resend** | Correo + nombre de destinatarios (invitaciones, avisos a clientes) | ¿DPA estándar? |
   | **Meta (WhatsApp Cloud API)** | Teléfono + contenido de mensajes de clientes y choferes | Términos de WhatsApp Business — verificar |
   | **Flow** | Datos de pago (hoy "link de pago simulado" — verificar si está activo) | ¿DPA / términos de integración? |
   | **mindicador.cl** | Ninguno (solo consulta UF/UTM, sin enviar datos) | No aplica |

3. **Región de hosting.** Confirmado desde documentación: Supabase prod en `us-west-2`
   (EE.UU.). Evaluar migración a región Sudamérica vs. mantener con resguardos
   contractuales + declaración al titular.
4. **Delegado de Protección de Datos (DPD).** Dado el volumen de datos laborales
   (salud + socioeconómicos de colaboradores) que maneja el módulo Remuneraciones y que
   Bitácora es un encargado/responsable para múltiples empresas cliente — **confirmar
   con abogado** si corresponde designar un DPD.
5. **Registro de actividades de tratamiento (RAT).** La APDP fiscaliza inventarios
   concretos. El §5 de este documento es un borrador técnico del inventario; el RAT
   formal es un entregable legal aparte.
6. **Evaluación de impacto (EIPD/DPIA).** El tratamiento de datos de salud +
   socioeconómicos a escala probablemente la requiere — confirmar con abogado.

---

## §8 — Impersonación de Super-Admin: estado y gap de cumplimiento

**Contrario a lo que asumía el prompt, la impersonación YA está construida.** Auditoría
de lo implementado:

| Requisito | Estado | Ubicación |
|---|---|---|
| Justificación obligatoria registrada | ✅ ≥20 caracteres + chequeo anti-relleno (`Set(...).size < 5`) | `backend/src/superadmin/routes.ts:838-852` |
| Log insert-only de inicio | ✅ `super_admin_auditoria` con justificación completa y hora de expiración | `:869` |
| Log insert-only de fin | ✅ `/impersonar/finalizar` registra el cierre | `:884-901` |
| Sesión acotada en el tiempo | ✅ token de 30 min (`crearTokenImpersonacion`) | `backend/src/superadmin/auth.ts:63` |
| Banner persistente en el frontend | ✅ `DashboardShell` muestra estado `impersonando` + "salir" | `web/src/components/DashboardShell.tsx:179,199,218` |
| Alcance limitado (no destructivo) | ✅ todo `DELETE` bloqueado + `suscripcion`/`plan`/`empresa`/`usuarios`/`integraciones` bloqueados | `backend/src/empresa.ts:19-31,95-100` |
| No ensucia el historial de accesos del usuario | ✅ `registrarAccesoSiCorresponde` no se llama si `req.impersonacion` | `backend/src/empresa.ts:106-109` |

**Gap específico de la Ley 21.719 (hallazgo #10):** el titular impersonado **no tiene
forma de saber** que su cuenta fue impersonada. El registro vive en
`super_admin_auditoria`, que solo ve el Super-Admin, y `/api/usuarios/me/accesos`
explícitamente lo excluye. Si un titular ejerce su derecho de acceso, debería poder ver
esos eventos (fecha + motivo declarado). **Requisito a incorporar** cuando se construya
el export individual del hallazgo #3: incluir ahí los eventos de impersonación.

---

## Checklist final — ordenado por fecha límite realista

> Quedan **menos de 3 meses** para el 1-dic-2026. Prioridad = urgencia legal × esfuerzo,
> no solo severidad técnica.

### Antes del 1-dic-2026 (imprescindible)

- [ ] **Política de Privacidad + Términos** redactados con abogado, publicados en
  `/privacidad` y `/terminos`, con número de versión. *(legal + front)*
- [ ] **Captura de consentimiento** en `/registro` y en la activación de invitación:
  checkbox obligatorio + tabla `consentimientos` insert-only. *(hallazgo #1)*
- [ ] **Endpoint "exportar mis datos"** para colaborador y para cliente del Portal.
  *(hallazgo #3 — habilita el derecho de acceso)*
- [ ] **Procedimiento de eliminación/anonimización individual** (aunque la v1 sea
  semi-manual, ejecutada por el Super-Admin, con log). *(hallazgo #2 — el derecho más
  expuesto)*
- [ ] **Declaración de transferencia internacional** en la Política de Privacidad
  (dónde se alojan los datos y qué proveedores externos los procesan). *(hallazgo #4)*
- [ ] **Revisar/aceptar los DPA** de Supabase, Vercel, Render, Anthropic, Resend, Meta.
  *(§ "Pendiente de verificación", punto 2)*
- [ ] **Confirmar con abogado**: base legal por tratamiento, necesidad de DPD, necesidad
  de EIPD, plazos de retención mínimos.

### Poco después (semanas siguientes)

- [ ] **Política de retención + limpieza** de `accesos_usuario`, `portal_codigos`,
  `portal_accesos`, `notificaciones_cliente_log`, `login_2fa_pendiente`. Implementar
  (perezosa como `idempotencia`, o cron). *(hallazgo #5)*
- [ ] **Retención tras baja de empresa**: definir plazo + proceso. *(hallazgo #6)*
- [ ] **Dropear la tabla `vehiculos`** huérfana (o confirmar qué retiene y por qué).
  *(hallazgo #7)*
- [ ] **`SENTRY_DSN` en Render** + sección "sospecha de brecha de datos personales" en
  el Runbook (cómo evaluar en horas, a quién se notifica). *(hallazgo #8)*
- [ ] **Unsubscribe en los correos a clientes** + registro de la oposición.
  *(hallazgo #12)*
- [ ] **Eventos de impersonación en el export individual** del titular. *(hallazgo #10)*

### Mejora continua (post 1-dic)

- [ ] Minimización en `datos_laborales` (¿se necesita el nombre del plan Isapre?).
  *(hallazgo #9)*
- [ ] Formulario de solicitud de rectificación para el cliente del Portal.
  *(hallazgo #11)*
- [ ] Registro formal de actividades de tratamiento (RAT) — a partir del §5.

---

> **Recordatorio:** este documento describe el estado del código, no dictamina
> cumplimiento. Cada "qué falta" y cada "confirmar con abogado" debe revisarse con
> asesoría legal antes del 1-dic-2026.
