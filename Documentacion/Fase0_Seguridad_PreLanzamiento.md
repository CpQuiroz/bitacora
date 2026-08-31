# Fase 0 — Orden de casa antes de salir a producción

> Checklist de seguridad y buenas prácticas a completar **antes** de exponer Bitácora al
> público. El objetivo es que estos controles queden resueltos por diseño, no como parche
> después de un incidente. Se recomienda completar este documento en orden, marcando cada
> ítem al terminarlo.

---

## 1. Separar ambientes

Nunca desarrollar ni probar contra la base de datos que usarán clientes reales.

- [ ] Crear un **segundo proyecto Supabase** (producción), distinto al de desarrollo.
- [ ] Aplicar las 26 migraciones de `supabase/migrations/` en el proyecto nuevo, en orden.
- [ ] Confirmar que ningún dato de prueba/cliente de desarrollo se copia al ambiente de producción.
- [ ] Documentar en el equipo cuál es la URL/proyecto de cada ambiente, para evitar confusiones futuras.

## 2. Auditar RLS activamente

No basta con revisar el código de las políticas — hay que probar que realmente aíslan los datos.

- [ ] Crear 2 empresas de prueba en staging, cada una con su propio usuario.
- [ ] Autenticado como Usuario A, intentar leer/modificar datos de la Empresa B **directo contra la API** (Postman, curl o similar) — no solo navegando la UI, ya que la UI puede ocultar accesos que la API igual permite.
- [ ] Repetir la prueba para cada tabla sensible: `clientes`, `ordenes_servicio`, `facturas`, `gastos`, `presupuestos`.
- [ ] Si algo se filtra entre empresas, corregir la policy RLS correspondiente antes de continuar con el resto de la fase.

## 3. Rotar y centralizar secretos

- [ ] Generar keys **nuevas** para producción — no reutilizar las que se usan en desarrollo:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ANTHROPIC_API_KEY`
  - `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`
  - `RESEND_API_KEY` (si se activa)
  - `WHATSAPP_ACCESS_TOKEN` y afines (si se activa el bot)
- [ ] Cargar todas las keys de producción en el gestor de variables de entorno del proveedor de hosting (Vercel Environment Variables para el frontend, Render Secrets para el backend) — nunca en el repo.
- [ ] Verificar que `.env` esté listado en `.gitignore` en los 4 workspaces (`web`, `backend`, `mobile`, `packages/shared`).
- [ ] Revisar el historial de git con una herramienta como `git log -p -- '*.env'` o `trufflehog` para confirmar que nunca se commiteó un `.env` con valores reales. **Si se encuentra alguno, esa key debe rotarse igual**, aunque el archivo se haya borrado después — quedó expuesta en el historial.

## 4. Dependencias

- [ ] Correr `npm audit` en `web/`, `backend/`, `mobile/` y `packages/shared/`.
- [ ] Resolver todas las vulnerabilidades marcadas `high` o `critical`.
- [ ] Activar Dependabot en GitHub (Settings → Security → Dependabot alerts + Dependabot version updates) para que este chequeo sea continuo, no una tarea única.

## 5. Exposición de datos

- [ ] Confirmar que `SUPABASE_SERVICE_ROLE_KEY` (que salta el RLS) solo existe en variables de entorno del **backend**, nunca en el bundle del frontend (`web/`) ni de la app móvil (`mobile/`).
- [ ] Revisar los endpoints principales del backend y confirmar que no devuelven más campos de los necesarios (ej.: que el listado de usuarios no incluya tokens, hashes, o campos internos que el frontend no necesita mostrar).
- [ ] Revisar que los endpoints que reciben archivos (fotos, firmas, comprobantes) validen tipo y tamaño de archivo antes de subirlos al storage.

## 6. Cabeceras y configuración básica del backend

- [ ] Instalar y configurar `helmet` en Express (`app.use(helmet())`) para cabeceras de seguridad estándar (CSP, X-Frame-Options, X-Content-Type-Options).
- [ ] Configurar CORS restringido: el backend solo debe aceptar peticiones desde el dominio de producción definido, no `*`.
- [ ] Instalar `express-rate-limit` y aplicarlo al menos en: login, invitación de colaboradores, y la ruta pública de encuesta (`/encuesta`) — para mitigar fuerza bruta y spam.

## 7. Backups

- [ ] Activar backups automáticos diarios en el proyecto Supabase de producción.
- [ ] Si el plan lo permite, activar point-in-time recovery.
- [ ] **Probar una restauración real** al menos una vez antes del lanzamiento — un backup nunca probado no es un backup confiable.

## 8. Verificación final antes de salir

- [ ] Confirmar que 2FA está disponible/activado para el rol Admin en Supabase Auth.
- [ ] Confirmar que HTTPS está forzado en frontend y backend (Vercel/Render lo hacen por defecto — verificar igual).
- [ ] Repasar una vez más la lista de variables de entorno de producción, confirmando que ninguna corresponde al ambiente de desarrollo.

---

## Notas

- Este documento cubre exclusivamente **Fase 0** del plan de salida a producción. Las fases
  siguientes (elección de hosting, CI/CD, dominio/DNS, cumplimiento legal, monitoreo) se
  documentan por separado.
- Se recomienda completar Fase 0 íntegramente antes de avanzar a desplegar en Vercel/Render,
  ya que corregir un problema de RLS o una key filtrada es mucho más barato antes de tener
  usuarios reales que después.
