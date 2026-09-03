# Auditoría de Dependencias (Supply Chain) — Bitácora

> **Fecha:** 3-sep-2026 · **Alcance:** solo lectura. `npm audit` / `npm outdated` por
> workspace. No se actualizó ninguna dependencia ni lockfile.
>
> Monorepo con npm workspaces: `web/`, `backend/`, `mobile/`, `packages/shared/`. Un
> único `package-lock.json` en la raíz (545 KB, commiteado).

---

## Resumen ejecutivo

| | |
|---|---|
| **Vulnerabilidades** | **20 en total, todas MODERATE. 0 high, 0 critical.** Backend: 3 (cadena `express`→`body-parser`→`qs`, con fix disponible sin cambio mayor). Mobile: 17 (transitivas de la toolchain de Expo y de `@react-navigation`). Web y shared: **0**. |
| **Desactualizados relevantes** | `@anthropic-ai/sdk` (0.68 → 0.123, trancado por el caret), `@supabase/supabase-js` (drift: declarado `^2.45`, resuelto 2.112.4, hay 2.115.0), `next` (16.3.2 → 16.3.4, patch probablemente de seguridad), `multer` (2.2 → 2.3). |
| **Sin mantenimiento** | **Ninguno.** `leaflet` 1.9.4 y `cors` 2.8.x están "terminados/estables", no abandonados. Ningún paquete `deprecated`. |
| **Paquetes sospechosos** | **Ninguno.** Todas las dependencias directas son reconocibles y tienen relación obvia con lo que hace la app. |
| **Lockfile / build** | Lockfile único commiteado ✓. Dockerfile del backend usa `npm ci` ✓. **Vercel no tiene `installCommand` explícito** en `vercel.json` — depende del default. Rangos `^` amplios en `@supabase/supabase-js` (la lib de auth). |

**Prioridad de acción:** ninguna urgencia (0 high/critical). Lo que sí conviene pronto:
`next` a 16.3.4, `npm audit fix` en backend (bump transitivo de `qs`), y decidir qué
hacer con `@anthropic-ai/sdk` (55 versiones de atraso en una lib pre-1.0).

---

## 1. Vulnerabilidades conocidas

| Sev. | Paquete | Instalada | Resuelve en | Directa/transitiva | Dónde | Nota |
|---|---|---|---|---|---|---|
| Moderate | `qs` | 6.15.3 | 6.15.4+ | transitiva (`express` → `body-parser` → `qs`) | backend | GHSA-x5fp-wj9c-mxmx (array-limit bypass) + GHSA-4mjr-xmp4-gh2g (DoS vía `isBuffer` controlado). `express@4.19.2` no lo declara pero `npm audit fix` bumpea el transitivo sin cambiar la major. Bajo impacto real: para explotarlo hay que mandar query strings malformados grandes; el rate limiting y `helmet` amortiguan. |
| Moderate | `body-parser` | 1.20.6 | (con el bump de `qs`) | transitiva (`express`) | backend | Solo "depende de un `qs` vulnerable". Se resuelve junto con `qs`. |
| Moderate | `express` | 4.22.2 | (con el bump de `qs`) | **directa** (`^4.19.2`) | backend | Idem — el 4.22.2 en sí no tiene CVE propio, arrastra el de `qs`. |
| Moderate | `decode-uri-component` | ≤ 0.4.2 | **sin fix** | transitiva (`@react-navigation/*` → `query-string` → `decode-uri-component`) | mobile | GHSA-vcc3-ghjq-m6fr (DoS por decodificación exponencial de input percent-encoded malformado). `@react-navigation` v7 todavía usa `query-string` para parsear deep links. **Impacto para Bitácora: bajo** — habría que hacer que un usuario abra un deep link `bitacora://` con un payload crafteado. No hay versión de `@react-navigation` que lo arregle hoy; trackear. |
| Moderate | `query-string` | 5.0.0–9.4.1 | **sin fix** | transitiva (`@react-navigation/core`) | mobile | Solo "depende de `decode-uri-component`". Idem arriba. |
| Moderate ×2 | `uuid` (v3/v5/v6 code path), `xcode` | — | expo (major) | transitiva (`@expo/config-plugins` → `xcode` → `uuid`) | mobile (toolchain) | GHSA (falta bounds check en `uuid` con `buf` provisto). Vive en la **toolchain de build de Expo** (`@expo/cli`, config plugins, prebuild) — **no en el runtime de la app**. `npm audit` sugiere "fix: expo 46.0.21" que es absurdo (SDK 57 » 46): su base de datos no entiende que 57 es más nuevo. Se resuelve solo cuando Expo publique un SDK con la toolchain actualizada. |
| Moderate ×~10 | `@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/metro-config`, `@expo/prebuild-config`, `@expo/inline-modules`, `@expo/local-build-cache-provider`, `@react-navigation/{native,core,elements,bottom-tabs,native-stack}` | — | — | transitivas | mobile (toolchain) | Todas cuelgan de las dos cadenas de arriba (`xcode`/`uuid` y `query-string`/`decode-uri-component`). No son 17 problemas distintos, son 2 causas con muchos paquetes en el medio. |

**Backend, web y `packages/shared` no tienen vulnerabilidades.**

### Prioridad especial (paquetes que tocan datos sensibles / superficie de ataque)

- **`@supabase/supabase-js` (auth/sesión):** **sin CVE.** Instalado 2.112.4, hay 2.115.0.
- **`helmet` 8.3.0, `cors` 2.8.6, `express-rate-limit` 8.7.0 (seguridad HTTP):** **sin CVE**, versiones actuales.
- **`multer` 2.2.0 (uploads):** **sin CVE.** Multer 2.x ya no tiene los problemas de la línea 1.x. Hay 2.3.0.
- **`@aws-sdk/client-s3` (storage):** **sin CVE.**
- **`pdfkit` 0.20.1 (PDF):** **sin CVE.**
- **`@anthropic-ai/sdk` 0.68.0:** **sin CVE**, pero muy atrasado (ver sección 2).

---

## 2. Paquetes desactualizados

| Paquete | Instalada | Última | Gap | Recomendación |
|---|---|---|---|---|
| `@anthropic-ai/sdk` (backend) | 0.68.0 | 0.123.0 | **~55 minors, pre-1.0** | **Revisar changelog antes de actualizar.** En una lib `0.x`, cada minor puede traer breaking changes. El caret `^0.68.0` lo trancó en 0.68.x. Revisar releases entre 0.68 y 0.123 (cambios de API en `messages.create`, tools, streaming), actualizar en un branch y probar los 4 puntos de uso (`analisis_foto`, `informe_os`, `extraer_guia`, `asistente`). No urgente (sin CVE) pero es deuda que crece. |
| `@supabase/supabase-js` (todos) | 2.112.4 | 2.115.0 | minor | **Actualizar** — `^2.45.0` ya lo permite, es solo regenerar el lockfile (`npm install`). De paso **subir el rango declarado** (ver sección 4). Bajo riesgo (2.112 → 2.115 es minor, mismo major). |
| `next` (web) | 16.3.2 | 16.3.4 | patch | **Actualizar ahora.** Está pineado exacto (`"next": "16.3.2"`), así que hay que cambiarlo a mano a `16.3.4`. Los patches de Next suelen incluir fixes de seguridad. Mismo major, riesgo bajo. Actualizar `eslint-config-next` igual (16.3.2 → 16.3.4). |
| `multer` (backend) | 2.2.0 | 2.3.0 | minor | **Actualizar.** Toca uploads. `^2.0.0` lo permite; minor dentro de 2.x. |
| `pdfkit` (backend) | 0.20.1 | 0.20.2 | patch | Actualizar cuando toque, trivial. |
| `express` (backend) | 4.22.2 | 5.2.1 | **major** | **Esperar.** Express 5 es estable pero cambia comportamiento (routing, `req.query` inmutable, `res.status` con validación, middlewares de error). **Sin tests e2e, una migración mayor tiene alto riesgo de regresión silenciosa.** Quedarse en 4.x (que sigue con soporte) y solo bumpear el transitivo de `qs`. Reevaluar cuando haya suite de tests. |
| `@react-native-async-storage/async-storage` (mobile) | 2.2.0 | 3.1.1 | **major** | **No tocar a mano** — lo maneja Expo. Correr `npx expo install --check` y aceptar lo que Expo recomiende para SDK 57. |
| `react` / `react-native` (mobile) | 19.2.3 / 0.86.3 | 19.2.8 / 0.87.1 | patch/minor | **No tocar a mano** — Expo SDK 57 pinea estas versiones. Cambiarlas rompe la compat con Expo. Esperar el SDK 58. |
| `react-native-{svg,screens,safe-area-context,view-shot}` (mobile) | varias | patches | patch | `npx expo install --check` — son las que Expo pinea. |
| `typescript` | 5.9.3 (backend/web/shared) vs **6.0.3 (mobile)** | 7.0.2 | — | **Drift dentro del monorepo:** `mobile/` tiene TS 6, el resto TS 5.9. Alinear a una sola versión (5.9 o 6, no ambas). TS 7 es major, no urgente. |
| `@types/node` | 20.19.43 | 26.4.1 | major | Dev. Alinear con la versión de Node real (Node 22 → `@types/node@22`). Bajo impacto. |
| `dotenv` (backend) | 16.6.1 | 17.4.2 | major | Dev-ish. `dotenv` 17 cambió defaults menores. No urgente. |
| `eslint` (web) | 9.39.5 | 10.9.1 | major | Dev. Junto con `eslint-config-next` — esperar a que Next soporte eslint 10 oficialmente. |
| `@aws-sdk/*` (backend) | 3.1116 | 3.1125 | patch | El AWS SDK publica a diario. `^3.600.0` lo permite; regenerar lockfile cuando toque. |
| `tsx` | 4.23.12 | 4.23.13 | patch | Trivial. |

### Expo SDK 57 — plugins con incompatibilidad conocida

Ya hubo un caso real: **`@sentry/react-native`** no compila con SDK 57 en EAS
(`AUDITORIA_RESILIENCIA.md` no lo cubre; está en el historial del proyecto). Del resto
de los plugins instalados (`expo-local-authentication`, `expo-auth-session`,
`expo-web-browser`, `expo-crypto`, `@react-navigation/*`), **ninguno tiene reporte de
incompatibilidad conocida con SDK 57** — todos se instalaron con `npx expo install`
(que elige la versión compatible) y compilan (`expo export` local pasa). El único
bloqueo actual de builds es la **caída de infra de EAS** (caché de Maven), no un plugin.

**Regla para adelante:** instalar plugins de Expo siempre con `npx expo install <pkg>`
(no `npm install`), y correr `npx expo-doctor` antes de un build.

---

## 3. Paquetes sin mantenimiento

**Ninguno amerita reemplazo.**

| Paquete | Último release real | Estado |
|---|---|---|
| `leaflet` 1.9.4 | 2023 (metadata tocada 2025) | **Estable/"terminado".** 1.9.x es la línea estable actual; Leaflet 2.0 está en beta. No abandonado, es una lib madura de mapas que no necesita cambios frecuentes. Riesgo bajo. |
| `cors` 2.8.6 | 2026-01 (metadata) / código de hace años | **Estable.** Middleware chico (~200 líneas), hace una cosa. No abandonado. |
| `pdfkit` 0.20.2 | 2026-08 | Activo. |
| `@react-native-community/netinfo` 12.0.1 | 2026-02 | Activo, es el paquete oficial. Pineado exacto (`"12.0.1"`) — considerar `~12.0.1`. |
| `recharts` 3.10.1 | 2026-08 | Activo. |
| `react-native-view-shot` 5.1.0 | 2026-06 | Activo (hay 5.1.1). Pineado exacto. |

Ninguna dependencia directa marcada `deprecated` por npm.

---

## 4. Integridad del lockfile y build

| Chequeo | Estado |
|---|---|
| `package-lock.json` commiteado | ✅ Uno solo en la raíz (workspaces comparten lockfile). No hay lockfiles sueltos por workspace (correcto). |
| Backend usa `npm ci` (no `npm install`) | ✅ `backend/Dockerfile:28` → `RUN npm ci`. |
| Vercel usa `npm ci` | ⚠️ **`web/vercel.json` no tiene `installCommand`.** Vercel por defecto usa `npm ci` **si detecta un lockfile** (que existe), pero dejarlo implícito es frágil — si cambia el comportamiento de Vercel o alguien toca la config, podría pasar a `npm install` y resolver versiones distintas a las testeadas. **Recomendación:** agregar `"installCommand": "npm ci"` a `vercel.json`. |
| Rangos `^`/`~` en libs sensibles | ⚠️ `@supabase/supabase-js: "^2.45.0"` — rango enorme sobre **la librería de autenticación**. Resuelve hoy a 2.112.4 pero un `npm install` en otra máquina/fecha podría traer cualquier `2.x`. `multer: "^2.0.0"` (uploads) — idem, más acotado. **Recomendación:** subir `@supabase/supabase-js` a `"^2.115.0"` (o pinear `"2.115.0"`) y `multer` a `"^2.3.0"`. `express`, `helmet`, `cors`, `express-rate-limit` tienen rangos razonables. |
| Drift declarado vs lockfile | `@supabase/supabase-js` declarado `^2.45.0`, lockfile 2.112.4 (coincide con la nota del proyecto sobre v2.112 + WebSocket nativo de Node 22). `@anthropic-ai/sdk` declarado `^0.68.0`, lockfile 0.68.0. `next` declarado `16.3.2` exacto, lockfile 16.3.2. Sin drift problemático, pero los rangos amplios (arriba) son la deuda. |

---

## 5. Paquetes sospechosos

Revisadas todas las dependencias **directas** de los 4 `package.json`. **Ninguna
sospechosa:**

- Scopes oficiales conocidos: `@expo/*`, `@react-navigation/*`, `@react-native-*`,
  `@supabase/*`, `@anthropic-ai/*`, `@aws-sdk/*`, `@sentry/*`, `@types/*`.
- Paquetes sueltos: `expo`, `expo-*` (todos del scope de Expo), `react`, `react-dom`,
  `react-native`, `next`, `leaflet`, `recharts`, `pdfkit`, `multer`, `helmet`, `cors`,
  `dotenv`, `express`, `express-rate-limit`, `tsx`, `typescript`.
- **Sin typosquatting**: ningún nombre parecido-pero-no-idéntico a uno conocido (no hay
  `expres`, `helmt`, `axioss`, `crossenv`, etc.).
- Todos tienen relación obvia con lo que hace Bitácora (web Next + móvil Expo + backend
  Express + Supabase + PDF + mapas + gráficos + IA).

---

## 6. Recomendación de chequeo continuo

Hoy **no hay ningún chequeo de dependencias en CI**. Los dos workflows existentes
(`check-migraciones-prod.yml`, `keep-warm.yml`) no tocan `npm audit`. Propuesta —
mismo patrón liviano, **para revisar antes de commitear, NO implementado todavía**.

> **Ambos archivos se corrigieron tras una revisión el 3-sep** (ver los recuadros en
> cada sub-sección). El error principal de la primera versión: tratar el monorepo como
> 4 proyectos npm separados, cuando es **un solo lockfile con workspaces** — tanto
> Dependabot como `npm audit` se configuran una sola vez en la raíz.

### 6.1 `.github/dependabot.yml` (nativo de GitHub, sin workflow que mantener)

> **Corregido tras revisión (3-sep):** la primera versión tenía **un bloque `directory`
> por workspace** — eso está **mal** para npm workspaces con lockfile único: Dependabot
> espera un `package-lock.json` en cada `directory` y no lo hay → falla o genera PRs
> rotas. Con workspaces va **un solo bloque `npm` con `directory: "/"`** (el
> `package.json` raíz que declara `workspaces`); Dependabot descubre las 4 carpetas y
> edita el lockfile raíz. Como ya no se puede agrupar por carpeta, se agrupa por
> `patterns` (glob sobre el nombre del paquete).

```yaml
version: 2
updates:
  # --- npm: UN bloque para todo el monorepo (workspaces + lockfile raíz) ---
  - package-ecosystem: "npm"
    directory: "/"
    schedule: { interval: "weekly", day: "monday" }
    open-pull-requests-limit: 8
    # target-branch por defecto = la default branch (main). Merge de una
    # PR de Dependabot = deploy automático (Vercel + Render). NUNCA activar
    # auto-merge: revisar y mergear a mano, sobre todo bumps de runtime.
    groups:
      # Security primero, todo junto — que un fix de CVE no espere a que
      # cuadre con el resto.
      security:
        applies-to: security-updates
        patterns: ["*"]
      # Version updates, agrupados por área para no ahogarse en PRs.
      backend:
        applies-to: version-updates
        patterns:
          - "express*"
          - "helmet"
          - "cors"
          - "multer"
          - "pdfkit"
          - "dotenv"
          - "@aws-sdk/*"
          - "@sentry/node"
          - "@anthropic-ai/sdk"
        update-types: ["minor", "patch"]
      frontend-web:
        applies-to: version-updates
        patterns:
          - "next"
          - "eslint-config-next"
          - "recharts"
          - "leaflet"
          - "@supabase/supabase-js"
        update-types: ["minor", "patch"]
      tooling:
        applies-to: version-updates
        patterns:
          - "typescript"
          - "tsx"
          - "eslint"
          - "@types/*"
        update-types: ["minor", "patch"]
    ignore:
      # Express 5 = migración mayor, se decide a mano (ver §2). Sin tests e2e.
      - dependency-name: "express"
        update-types: ["version-update:semver-major"]
      # Todo lo que pinea Expo SDK 57 — se actualiza SOLO con
      # `npx expo install` (Dependabot rompe la compat). Dependabot no va a
      # avisar de estos, ni siquiera de CVEs: para eso está la status page
      # de Expo y `npx expo install --check` / `npx expo-doctor`.
      - dependency-name: "expo"
      - dependency-name: "expo-*"
      - dependency-name: "@expo/*"
      - dependency-name: "react"
      - dependency-name: "react-dom"
      - dependency-name: "react-native"
      - dependency-name: "react-native-*"
      - dependency-name: "@react-native-*"
      - dependency-name: "@react-navigation/*"
      # Majors de dev tooling — a mano (TS 7, eslint 10, @types/node 26…)
      - dependency-name: "typescript"
        update-types: ["version-update:semver-major"]
      - dependency-name: "eslint"
        update-types: ["version-update:semver-major"]
      - dependency-name: "@types/node"
        update-types: ["version-update:semver-major"]

  # --- Los propios workflows de GitHub Actions ---
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule: { interval: "monthly" }
```

**Además del archivo, para que las security updates funcionen en un repo privado:**
Settings → Code security → activar **"Dependabot alerts"** y **"Dependabot security
updates"** (no vienen prendidos por defecto en repos privados). El bloque de
`version-updates` del yml funciona sin eso; el de `security-updates` no.

### 6.2 `.github/workflows/deps-audit.yml` (gate en PR, mismo estilo que los existentes)

> **Corregido tras revisión (3-sep):** la primera versión hacía un loop
> `for dir in . backend web mobile packages/shared; do (cd $dir && npm audit)`. Eso **no
> sirve**: `npm audit` desde una subcarpeta sin lockfile propio sube hasta el lockfile
> raíz y audita **todo el árbol** — el loop corre el mismo audit completo 5 veces. Con
> workspaces se corre **una sola vez en la raíz** (cubre los 4). Además: cache de npm
> (el `npm ci` de este monorepo es lento) y un cron semanal (un CVE nuevo puede salir
> sobre una dependencia que no cambió).

```yaml
name: Auditoría de dependencias

on:
  pull_request:
    paths:
      - "**/package.json"
      - "package-lock.json"
  schedule:
    - cron: "0 9 * * 1"   # lunes 09:00 UTC — CVEs nuevos sobre deps sin cambios
  workflow_dispatch: {}

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
      # npm ci ya valida que el lockfile esté sincronizado con los
      # package.json (si alguien editó uno sin `npm install`, esto falla).
      - run: npm ci
      # Un solo audit en la raíz cubre los 4 workspaces (lockfile único).
      # Falla solo ante high/critical — las moderate se ven pero no
      # bloquean (hoy hay 20 moderate transitivas de Expo/nav sin fix).
      - name: npm audit (todo el monorepo)
        run: npm audit --audit-level=high
      - name: Detalle informativo (no bloquea)
        if: always()
        run: npm audit --audit-level=moderate || true
```

**Antes de commitear esto — decisiones abiertas:**
- **Umbral `--audit-level=high`**: hoy pasa (0 high/critical). Si en algún momento
  aparece un high transitivo sin fix upstream, va a bloquear todas las PRs hasta que se
  agregue un `--omit` o se acepte el riesgo. Alternativa: dejarlo informativo
  (`|| true`) y revisar el resumen a mano.
- **Repo privado + minutos de Actions**: el cron semanal + cada PR que toca deps consume
  minutos. Con el plan actual de GitHub debería sobrar, pero tenerlo presente.
- **Dependabot → `main` directo**: sus PRs apuntan a `main`, y mergear `main` deploya.
  Si preferís un colchón, poner `target-branch: "develop"` en el `dependabot.yml` y
  mergear `develop → main` por lotes revisados. Hoy no hay branch `develop`.
