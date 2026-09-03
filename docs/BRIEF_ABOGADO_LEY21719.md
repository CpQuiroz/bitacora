# Brief para abogado — Cumplimiento Ley 21.719 (Bitácora)

> **Para quién:** abogado/a especialista en protección de datos, Chile.
> **Fecha:** 3-sep-2026 · **Plazo:** plena vigencia de la Ley 21.719 el **1-dic-2026**.
> **Contexto técnico completo:** `docs/AUDITORIA_LEY21719.md` (auditoría del código,
> 12 hallazgos) y este documento (qué falta del lado legal).

---

## 1. Qué es Bitácora y qué datos trata

**Bitácora** es un SaaS (software como servicio) para pymes chilenas de servicio en
terreno (transporte, mantención, instalaciones). Cada empresa cliente ("empresa")
gestiona sus trabajos, clientes, agenda, cobros y remuneraciones.

**Roles de tratamiento (a confirmar por el abogado):**
- Respecto de los **usuarios de las empresas cliente** (sus dueños, administrativos,
  choferes, técnicos): Bitácora parece ser **responsable** (define la plataforma) y a
  la vez **encargado** de la empresa empleadora.
- Respecto de los **clientes finales de cada empresa** (terceros que no tienen cuenta):
  Bitácora es **encargado**; la empresa es responsable.

**Categorías de datos personales que se guardan** (detalle tabla por tabla en la
auditoría, §5):
- Identificación: nombre, RUT, correo, teléfono, dirección, foto.
- **Sensibles / categoría especial:** afiliación a sistema de salud (Fonasa/Isapre) y
  remuneración de los colaboradores (módulo Remuneraciones); fecha de nacimiento de
  clientes; imágenes de terreno (pueden mostrar personas y patentes).
- Tracking: IP, user-agent, historial de accesos y de acciones.
- Biometría: **NO se trata en el servidor** — la huella / Face ID es solo local al
  dispositivo del usuario.

---

## 2. Lo que YA está implementado técnicamente

(No requiere trabajo legal, solo revisión de que sea suficiente.)

| Obligación | Implementación |
|---|---|
| Registrar el consentimiento | Tabla `consentimientos` (insert-only), checkbox obligatorio en el alta y en la activación de invitación, aviso a usuarios existentes para re-aceptar cuando cambie la versión. |
| Derecho de acceso / portabilidad | Botón "descargar mis datos" (JSON) para cada usuario y para cada cliente del Portal. |
| Derecho de supresión | Función de anonimización individual (reemplaza identificadores por placeholder, borra datos accesorios, conserva registros operativos sin nombre). La ejecuta el Super-Admin. |
| Derecho de oposición | Enlace "darse de baja" al pie de todos los correos a clientes. |
| Rectificación por el cliente | Formulario en el Portal que avisa al administrador de la empresa. |
| Retención limitada | Limpieza automática de logs y tokens: accesos 12 meses, códigos/enlaces temporales 30 días. Registro de la fecha de baja de cada empresa. |
| Transferencia internacional | Declarada en el borrador de Política de Privacidad. |
| Notificación de brechas | Procedimiento operativo de primeras 2 horas en el runbook de incidentes. |

---

## 3. Lo que necesitamos de vos (trabajo legal)

### 3.1 Redactar dos documentos (hoy son esqueletos)

Están publicados como borrador en `/privacidad` y `/terminos` del sitio, con la
**estructura** y los **datos fácticos correctos** (proveedores, transferencias,
categorías de datos, plazos de retención), y marcadores `[PENDIENTE: abogado]` donde
va el texto legal. Necesitamos:

- **Política de Privacidad** completa, conforme a la Ley 21.719.
- **Términos de Servicio** (relación Bitácora ↔ empresa cliente).

Insumos fácticos que ya tenemos para vos:
- Lista de proveedores y qué dato recibe cada uno → §3.3 de este documento.
- Inventario de datos por tabla → auditoría §5.
- Plazos de retención propuestos (conservadores, a validar) → §3.4.

### 3.2 Determinar la base de licitud de cada tratamiento

Hoy asumimos "consentimiento" de forma genérica. Necesitamos que definas, por
tratamiento:
- Usuarios/colaboradores de las empresas: ¿contrato de servicio con la empresa?,
  ¿relación laboral (para los datos de Remuneraciones)?, ¿interés legítimo?
- Clientes finales: ¿ejecución del contrato de la empresa?, ¿interés legítimo?
- Saludo de cumpleaños (fecha de nacimiento del cliente): ¿requiere consentimiento
  específico?
- **¿El consentimiento del representante de la empresa al registrarse cubre a los
  colaboradores que esa empresa invita, o cada colaborador debe aceptar por separado?**
  (Hoy: cada colaborador acepta al activar su invitación.)

### 3.3 Contratos con encargados de tratamiento (DPA)

Necesitamos un DPA firmado o aceptado con cada proveedor. Checklist para revisar uno
por uno (varios ya tienen su DPA estándar en sus Términos):

| Proveedor | Qué datos personales recibe | ¿DPA revisado/aceptado? |
|---|---|---|
| **Supabase** (base de datos, autenticación, archivos) | Todo | ☐ |
| **Vercel** (hosting del sitio web) | Logs de request, IP | ☐ |
| **Render** (hosting del backend) | Logs de request, IP | ☐ |
| **Anthropic** (IA — Informe y Asistente) | Datos de trabajos y contacto de clientes incluidos en las consultas; imágenes de terreno | ☐ (revisar retención / no-entrenamiento) |
| **Resend** (envío de correos) | Correo y nombre de destinatarios | ☐ |
| **Meta Platforms — WhatsApp Business** | Teléfono y contenido de mensajes de clientes y choferes | ☐ |
| **Flow** (pagos, si la empresa lo activa) | Datos de pago | ☐ |
| **mindicador.cl** (consulta UF/UTM) | Ninguno (no se le envían datos) | N/A |

### 3.4 Validar los plazos de retención

Propuesta implementada (conservadora). Confirmar contra plazos legales mínimos que
compiten (laboral, tributario, evidencia ante la APDP):

| Dato | Plazo propuesto |
|---|---|
| `accesos_usuario` (logs de acceso: IP, user-agent) | 12 meses |
| `portal_codigos` (códigos de 6 dígitos del Portal) | 30 días |
| `portal_accesos` (enlaces del Portal) | 30 días después de expirar |
| Tokens de verificación en dos pasos | Al vencer |
| Datos de una **empresa dada de baja** | **[PENDIENTE — no definido]** — hoy quedan indefinidamente; el sistema registra la fecha de baja pero no elimina nada solo. |
| Liquidaciones y datos laborales | **[PENDIENTE]** — probablemente varios años por obligación laboral. |

### 3.5 Transferencia internacional — mecanismo

La infraestructura (Supabase) y varios proveedores están en **Estados Unidos**.
Necesitamos que definas el mecanismo de resguardo que exige la Ley 21.719 para esa
transferencia (¿cláusulas contractuales tipo?, ¿país con nivel de protección adecuado
según la APDP?, ¿consentimiento informado del titular?) y cómo reflejarlo en la
Política de Privacidad. Evaluar si conviene migrar la base a la región de Supabase en
Sudamérica (São Paulo).

### 3.6 Delegado de Protección de Datos (DPD) y Evaluación de Impacto (EIPD)

- **DPD:** dado que el módulo Remuneraciones trata datos de salud + socioeconómicos de
  colaboradores, y que Bitácora lo hace para múltiples empresas cliente — ¿corresponde
  designar un DPD?
- **EIPD/DPIA:** ¿el tratamiento de datos sensibles a esta escala requiere una
  evaluación de impacto formal antes del 1-dic-2026?

### 3.7 Registro de Actividades de Tratamiento (RAT)

La APDP fiscaliza inventarios concretos. La auditoría §5 es un borrador técnico del
inventario; el RAT formal es un entregable legal. ¿Lo armás vos a partir de ese
borrador?

### 3.8 Plantillas de respuesta a solicitudes y a brechas

- Plantilla de respuesta a un ejercicio de derecho (acceso / rectificación /
  cancelación / oposición) — plazo legal de respuesta.
- Plantilla de **notificación de brecha** a la APDP y a los titulares afectados (el
  runbook tiene los pasos operativos, falta el texto y el plazo exacto).

---

## 4. Preguntas concretas para la reunión

1. ¿Bitácora es responsable, encargado, o ambos, y respecto de quién?
2. ¿El consentimiento del admin al registrarse cubre a sus colaboradores?
3. ¿Los datos de Remuneraciones (salud + sueldo) son "categoría especial" y qué
   tratamiento reforzado exigen?
4. ¿Alojar en EE.UU. es viable con resguardos, o hay que migrar a Sudamérica?
5. ¿Necesitamos DPD? ¿EIPD?
6. Plazo legal para responder un ejercicio de derechos y para notificar una brecha.
7. Plazo mínimo de conservación de liquidaciones / datos laborales tras la baja de un
   colaborador o de la empresa.
8. ¿La justificación textual de una impersonación de soporte debe mostrarse completa al
   titular cuando ejerce su derecho de acceso?

---

## 5. Archivos de referencia (en el repositorio)

- `docs/AUDITORIA_LEY21719.md` — auditoría técnica completa, 12 hallazgos, tabla ARCO,
  estado de implementación.
- `web/src/app/privacidad/page.tsx` y `web/src/app/terminos/page.tsx` — borradores con
  marcadores.
- `docs/RUNBOOK_INCIDENTES.md` — sección "sospecha de brecha de datos personales".
