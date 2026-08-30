# Resumen de trabajo — Fase 0 de seguridad + Tanda 2 de UX

Rama: `feat/fase0-y-ux-tanda-2` (12 commits, no mergeada a `main`, sin
push a ningún remoto). Cada commit corresponde a un ítem del encargo.

## Bloque A — Fase 0 de seguridad

1. **Helmet** — `app.use(helmet())` en `backend/src/server.ts`, antes
   de CORS y de cualquier ruta. Verificado en vivo (cabeceras
   presentes en `/health`).
2. **CORS restringido** — nueva env var `ALLOWED_ORIGINS` (coma-separada,
   `backend/src/env.ts`); sin configurar, cae a `http://localhost:3000`.
   Verificado en vivo: origen permitido devuelve el header
   `Access-Control-Allow-Origin`, uno no permitido no.
3. **Rate limiting** — `express-rate-limit`, 10 intentos/15 min por IP,
   centralizado en `backend/src/rateLimiters.ts` (fácil de ajustar).
   Aplicado a `/api/auth` (login + verificación de 2FA), `POST
   /api/usuarios/invitar` y `/api/encuesta`. Verificado en vivo: el
   intento 11 responde 429.
   - **Aviso**: mientras probaba el resto de esta tanda me quedé sin
     cupo varias veces contra mi propia IP de pruebas — es la
     protección funcionando como corresponde, no un bug, pero avisalo
     al equipo si alguien reporta "no puedo entrar" después de varios
     intentos fallidos legítimos (typos de contraseña, etc.).
4. **`npm audit`** —
   - `backend`, `web`, `packages/shared`: **0 vulnerabilidades**.
   - `mobile`: **10 moderadas**, todas en una sola cadena
     (`uuid → xcode → @expo/config-plugins → @expo/cli → expo`).
     **No hay fix sin `--force`**, y `--force` instalaría
     `expo@46.0.21` — una baja de versión mayor rompiendo el proyecto
     (`mobile/AGENTS.md` indica que la versión actual es Expo v57).
     **No se aplicó nada** — queda para que lo decidas vos; lo más
     seguro es esperar a que Expo publique un patch de `uuid` en la
     rama de versión actual, no forzar el downgrade.
5. **`.gitignore`** — ya cubría `.env`/`.env.local`/`.env.*.local` en
   los 4 workspaces (raíz + `web/.gitignore` propio). No hizo falta
   tocar nada.
6. **Historial de git** — `git log --all --full-history` y una
   búsqueda exhaustiva por nombre de archivo en todo el historial:
   **ningún `.env` fue commiteado nunca**, en ninguna rama. Nada que
   reportar.

## Bloque B — Resto del informe UX

7. **Dashboard: gráfico de ingresos dinámico** — `ingresosPorMes()`
   (`backend/src/agregacionesDashboard.ts`) ahora arranca en el primer
   mes con facturas reales (mínimo 3 meses, tope 12) en vez de fijar
   siempre 12. Verificado con 3 escenarios (empresa vacía, datos de
   hace 5 meses, datos de hace 20 meses).
8. **Accesos rápidos en Dashboard** — "Nueva OS" / "Nueva Cotización"
   junto al saludo.
9. **Dashboard vs Informes (duplicación)** — **TODO agregado, sin
   tocar UI**, en `web/src/app/dashboard/page.tsx` y
   `web/src/app/dashboard/informes/vision-general/page.tsx`, cada uno
   apuntando al otro.
10. **Tipos de Documento: pills con ícono "+"** — en
    `web/src/app/dashboard/configuracion/tipos-documento/page.tsx`.
11. **Documentos por vencer conectado a fichas — ya estaba hecho.**
    Investigué antes de tocar nada: `DocumentoForm` (componente
    compartido, `web/src/components/DocumentoForm.tsx`) ya está
    montado tanto en la ficha de Vehículo como en la de Colaborador,
    con alta de documento + fecha de vencimiento + archivo, y
    `GET /api/documentos/por-vencer` ya alimenta el panel "Documentos
    por vencer". **No hice ningún cambio** — lo verifiqué en vivo
    (la pantalla carga sin errores). Si el hallazgo original se basó
    en una versión más vieja del código, ya no aplica.
12. **Vehículos vs Equipos (solapamiento)** — **TODO agregado, sin
    unificar**, en `web/src/app/dashboard/flota/vehiculos/page.tsx` y
    `web/src/app/dashboard/registros/equipos/page.tsx`.
13. **Card de Anthropic oculta en Integraciones** — filtro solo en el
    frontend (`web/src/app/dashboard/configuracion/integraciones/page.tsx`);
    `DEFINICIONES` en `backend/src/routes/integraciones.ts` sigue
    intacta.
14. **Asistente: modo panel** — botón para alternar burbuja/panel fijo,
    preferencia en `localStorage`, mobile (<640px) fuerza burbuja
    siempre. Verificado en vivo: toggle, persistencia tras recargar, y
    que el botón no aparece en mobile.
15. **Bug de recorte del chat en el borde derecho — no lo pude
    reproducir.** Probé un rango amplio de anchos de viewport
    (320px–1920px) con Chromium/Playwright contra el código actual: en
    ningún caso el panel del Asistente se sale del viewport — el
    `max-w-[calc(100vw-2rem)]` ya existente se comporta bien.
    Audité también todos los `z-index` del frontend: `z-50` ya es el
    máximo usado en toda la app (no hay nada que pueda taparlo desde
    arriba). Intenté un enfoque alternativo de posicionamiento
    (`inset-x` + `margin-left:auto`) pensando que podía ser más
    robusto, pero en la práctica introducía un recorte por el lado
    IZQUIERDO en pantallas angostas que no existía antes — lo revertí.
    **No se tocó el código de posicionamiento** (sigue como estaba).
    Si el bug persiste para vos, sería muy útil una captura de
    pantalla o el ancho de ventana/navegador exacto donde pasa — puede
    ser algo específico de Safari iOS u otro navegador con un
    viewport "real" distinto al que usa Chromium de escritorio.
16. **Dropdown de usuario: "Plan" y "Configuración" duplicados** —
    quitados de `DashboardShell.tsx`. Al investigar encontré que el
    link "Plan" del dropdown apuntaba a una pantalla **vieja y
    huérfana** (`web/src/app/dashboard/plan/page.tsx`, previa a la
    autogestión de plan que se construyó antes en esta sesión, sin
    ninguna otra referencia en el código) — la borré en vez de
    dejarla como código muerto sin entrada. El plan real y funcional
    sigue en Configuración > Plan, sin cambios.

## Bloque C — Documentación

17. **Diagramas `.mermaid` movidos a `docs/`** — estaban en
    `Documentacion/` (carpeta sin trackear en git). Se movieron los 6
    archivos (`.mermaid`) a `docs/` en la raíz. `Documentacion/` sigue
    existiendo con lo demás que tenía (`Fase0_Seguridad_PreLanzamiento.md`,
    la fuente de este mismo encargo) — no se tocó, no era parte de lo
    pedido.
18. **Links del README a los `.mermaid`** — revisado: el README
    **no tenía ningún link** a estos archivos (ni antes ni después del
    move), así que no había nada que corregir.

## Verificación general

- `npx tsc --noEmit` limpio en `backend`, `web` y `mobile`; build
  limpio en `packages/shared`.
- Backend reiniciado en limpio al final, arranca sin errores con
  todos los cambios (Helmet, CORS, rate limiting, gráfico dinámico).
- La mayoría de los cambios de UI se verificaron en vivo con una
  empresa/usuario de prueba desechables (creados y borrados en esta
  corrida, incluido un admin con 2FA TOTP ya activado para poder
  navegar Configuración sin quedar bloqueado por la exigencia de 2FA
  de admin/supervisor de la sesión anterior).

## Pendiente de tu revisión

- Ítem 4: vulnerabilidades de `mobile` (Expo) — ver arriba, no se tocó.
- Ítems 9 y 12: TODOs de decisión de producto en el código, listos
  para cuando quieras definir el modelo.
- Ítem 15: bug de recorte del chat no reproducido — puede ya estar
  resuelto, o depender de un navegador/dispositivo específico.
