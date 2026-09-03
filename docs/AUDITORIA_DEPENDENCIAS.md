# Auditoría de Dependencias (Supply Chain) — Bitácora

> **Fecha:** 3-sep-2026 · **Re-corrida:** 3-sep-2026 (~3h después de la primera —
> `npm audit` / `npm outdated` por workspace de nuevo). **Sin cambios materiales:** el
> lockfile y los `package.json` no se tocaron entre una y otra; las únicas diferencias
> son drift de versiones que publican a diario (`@aws-sdk/*`) y algún patch/minor de
> React Native. **Alcance:** solo lectura. No se actualizó ninguna dependencia ni
> lockfile.
>
> Monorepo con npm workspaces: `web/`, `backend/`, `mobile/`, `packages/shared/`. Un
> único `package-lock.json` en la raíz (~546 KB, commiteado). `npm ci --dry-run` pasa
> → lockfile sincronizado con los `package.json`. Node 22 / npm 10.9.

---

## Resumen ejecutivo

| | |
|---|---|
| **Vulnerabilidades** | **20 en total, todas MODERATE. 0 high, 0 critical.** Backend: 3 (cadena `express`→`body-parser`→`qs`, fix disponible sin cambio mayor). Mobile: 17 (transitivas de la toolchain de Expo y de `@react-navigation`, **2 causas raíz**, no 17 problemas). Web y `packages/shared`: **0**. |
| **Desactualizados relevantes** | `@anthropic-ai/sdk` (0.68.0 → 0.123.0, trancado por el caret sobre una lib pre-1.0), `next` (16.3.2 → 16.3.4, patch probablemente de seguridad — está pineado exacto), `@supabase/supabase-js` (instalado 2.112.4, hay 2.115.0; rango declarado `^2.45.0` demasiado amplio para la lib de auth), `multer` (2.2.0 → 2.3.0). |
| **Sin mantenimiento** | **Ninguno.** `leaflet` 1.9.4 y `cors` 2.8.6 están "terminados/estables", no abandonados. Cero paquetes `deprecated` en todo el árbol (`npm ls --all` no marca ninguno). |
| **Paquetes sospechosos** | **Ninguno.** Todas las dependencias directas de los 4 `package.json` son reconocibles y tienen relación obvia con la app. Sin typosquatting. |
| **Lockfile / build** | Lockfile único commiteado ✓. `backend/Dockerfile` usa `npm ci` ✓. **`web/vercel.json` sigue sin `installCommand` explícito** ⚠️. Rango `^2.45.0` amplio en `@supabase/supabase-js` (auth) ⚠️. |

**Prioridad de acción:** ninguna urgencia (0 high/critical). Lo que conviene pronto:

1. `next` → **16.3.4** (pineado exacto en `web/package.json`, cambio a mano; los patches de Next suelen traer fixes de seguridad). Alinear `eslint-config-next` igual.
2. `npm audit fix` **en el contexto del backend** (bump transitivo de `qs` 6.15.3 → 6.15.4; `fixAvailable` sin cambio de major).
3. Subir el rango declarado de `@supabase/supabase-js` a `^2.115.0` (o pinear) y regenerar lockfile.
4. Decidir qué hacer con `@anthropic-ai/sdk` (55 minors de atraso en una `0.x`).
5. Agregar `"installCommand": "npm ci"` a `web/vercel.json`.

Nada de esto está hecho — este informe es diagnóstico.

---

## 1. Vulnerabilidades conocidas (CVEs)

`npm audit` por workspace:

| Workspace | moderate | high | critical |
|---|---|---|---|
| raíz (todo el monorepo) | 20 | 0 | 0 |
| `backend` | 3 | 0 | 0 |
| `web` | **0** | 0 | 0 |
| `mobile` | 17 | 0 | 0 |
| `packages/shared` | **0** | 0 | 0 |

### Detalle

| Sev. | Paquete | Instalada | Resuelve en | Directa/transitiva | Dónde | Nota |
|---|---|---|---|---|---|---|
| Moderate | `qs` | 6.15.3 | 6.15.4+ | transitiva (`express` → `body-parser` → `qs`) | backend | **GHSA-x5fp-wj9c-mxmx** (array-limit bypass vía coma en bracket-key, CVSS 3.7) + **GHSA-4mjr-xmp4-gh2g** (DoS vía `isBuffer` controlado, CVSS 5.3). `npm audit` marca `fixAvailable: true` **sin** cambio de major — bumpea sólo el transitivo. Impacto real bajo: hay que mandar query strings malformados grandes; `helmet` + rate limiting amortiguan. |
| Moderate | `body-parser` | 1.20.6 | (con el bump de `qs`) | transitiva (`express`) | backend | Sólo "depende de un `qs` vulnerable". Se resuelve junto con `qs`. |
| Moderate | `express` | 4.22.2 | (con el bump de `qs`) | **directa** (`^4.19.2`) | backend | El 4.22.2 en sí no tiene CVE propio — arrastra el de `qs`/`body-parser`. |
| Moderate | `decode-uri-component` | ≤ 0.4.2 | **sin fix upstream** | transitiva (`@react-navigation/*` → `query-string` → `decode-uri-component`) | mobile | **GHSA-vcc3-ghjq-m6fr** (DoS por decodificación exponencial de percent-encoding malformado). `@react-navigation` v7 todavía usa `query-string` para parsear deep links. **Impacto para Bitácora: bajo** — habría que lograr que un usuario abra un deep link `bitacora://` con payload crafteado. No hay versión de `@react-navigation` que lo arregle hoy → **trackear**. |
| Moderate | `query-string` | 5.0.0–9.4.1 | **sin fix** | transitiva (`@react-navigation/core`) | mobile | Sólo "depende de `decode-uri-component`". Idem. |
| Moderate | `uuid` | <11.1.1 (code path v3/v5/v6) | expo (major, según `npm audit`) | transitiva (`@expo/config-plugins` → `xcode` → `uuid`) | mobile (toolchain) | **GHSA-w5hq-g745-h8pq** (falta bounds-check cuando se pasa `buf`; CVSS 7.5 en la escala, pero npm lo rankea moderate en contexto). Vive en la **toolchain de build de Expo** (prebuild / config plugins), **no en el runtime de la app**. |
| Moderate | `xcode` | ≥ 0.9.2 | expo (major) | transitiva (`@expo/config-plugins`) | mobile (toolchain) | Sólo "depende de un `uuid` vulnerable". Toolchain, no runtime. |
| Moderate ×13 | `expo`, `@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/inline-modules`, `@expo/local-build-cache-provider`, `@expo/metro-config`, `@expo/prebuild-config`, `@react-navigation/{native,core,elements,bottom-tabs,native-stack}` | — | ver abajo | transitivas | mobile (toolchain + nav) | Todas cuelgan de las **2 cadenas de arriba** (`xcode`/`uuid` y `query-string`/`decode-uri-component`). No son 17 problemas distintos: son 2 causas con muchos paquetes intermedios que "dependen de una versión vulnerable de…". |

**`npm audit` sugiere "fix: expo 46.0.21" para las cadenas de Expo — es un artefacto:** la base
de datos de advisories no entiende que SDK 57 » SDK 46, así que propone "bajar" a una
versión antiquísima. La realidad: **estas se resuelven solas cuando Expo publique un SDK
con la toolchain actualizada.** No hay acción posible hoy sin romper la app.

### Prioridad especial (paquetes que tocan datos sensibles / superficie de ataque)

| Área | Paquete | Instalado | Estado |
|---|---|---|---|
| Auth / sesión | `@supabase/supabase-js` | 2.112.4 | **Sin CVE.** Hay 2.115.0 (ver §2 y §4). |
| Auth / sesión | *(no hay lib de JWT propia — la maneja `supabase-js`)* | — | — |
| Seguridad HTTP | `helmet` | 8.3.0 | **Sin CVE**, versión actual. |
| Seguridad HTTP | `cors` | 2.8.6 | **Sin CVE**, versión actual. |
| Seguridad HTTP | `express-rate-limit` | 8.7.0 | **Sin CVE**, versión actual. |
| Uploads | `multer` | 2.2.0 | **Sin CVE.** La línea 2.x no tiene los problemas de la 1.x. Hay 2.3.0. |
| Storage | `@aws-sdk/client-s3` + `s3-request-presigner` | 3.1116.0 | **Sin CVE.** |
| PDF | `pdfkit` | 0.20.1 | **Sin CVE.** Hay 0.20.2 (patch trivial). |
| IA | `@anthropic-ai/sdk` | 0.68.0 | **Sin CVE**, pero muy atrasado (ver §2). |
| Observabilidad | `@sentry/node` | 10.x (según lockfile) | **Sin CVE**, al día. Opt-in vía `SENTRY_DSN`. |

**Ningún paquete de la cadena de autenticación, HTTP, storage, PDF o IA tiene una
vulnerabilidad conocida hoy.**

---

## 2. Paquetes desactualizados

| Paquete | Instalada | Última | Gap | Recomendación |
|---|---|---|---|---|
| `@anthropic-ai/sdk` (backend) | 0.68.0 | 0.123.0 | **~55 minors, pre-1.0** | **Revisar changelog antes.** En una `0.x` cada minor puede traer breaking changes. El `^0.68.0` lo trancó en 0.68.x. Revisar releases 0.68→0.123 (cambios en `messages.create`, tools, streaming), actualizar en branch y probar los 4 usos (`analisis_foto`, `informe_os`, `extraer_guia`, `asistente`). Sin CVE, pero deuda que crece. |
| `@supabase/supabase-js` (los 4 workspaces) | 2.112.4 | 2.115.0 | minor | **Actualizar** — `^2.45.0` ya lo permite, es regenerar lockfile. De paso **subir el rango declarado** (§4). Riesgo bajo (mismo major). |
| `next` (web) | 16.3.2 | 16.3.4 | patch | **Actualizar ahora.** Pineado exacto (`"next": "16.3.2"`) → cambio a mano a `16.3.4`. Patches de Next ≈ fixes de seguridad. Mismo major, riesgo bajo. Subir `eslint-config-next` a 16.3.4 también. |
| `multer` (backend) | 2.2.0 | 2.3.0 | minor | **Actualizar.** Toca uploads. `^2.0.0` lo permite; minor dentro de 2.x. |
| `pdfkit` (backend) | 0.20.1 | 0.20.2 | patch | Trivial, cuando toque. |
| `express` (backend) | 4.22.2 | 5.2.1 | **major** | **Esperar.** Express 5 es estable pero cambia comportamiento (routing, `req.query` inmutable, validación en `res.status`, middlewares de error). **Sin tests e2e, una migración mayor tiene alto riesgo de regresión silenciosa.** Quedarse en 4.x (con soporte) y sólo bumpear el transitivo de `qs`. Reevaluar con suite de tests. |
| `@aws-sdk/client-s3` + `s3-request-presigner` (backend) | 3.1116.0 | 3.1126.0 | patch | El AWS SDK publica a diario. `^3.600.0` lo permite; regenerar lockfile cuando toque. Sin urgencia. |
| `@react-native-async-storage/async-storage` (mobile) | 2.2.0 | 3.1.1 | **major** | **No tocar a mano.** Correr `npx expo install --check` y aceptar lo que Expo recomiende para SDK 57. |
| `react` / `react-native` (mobile) | 19.2.3 / 0.86.3 | 19.2.8 / 0.87.1 | patch / minor | **No tocar a mano** — Expo SDK 57 pinea estas versiones. Cambiarlas rompe la compat. Esperar SDK 58. (Nota: `web` usa `react@19.2.8` y `mobile` `react@19.2.3` — el móvil lo fija Expo, es esperable.) |
| `react-native-safe-area-context` (mobile) | 5.7.0 | 5.9.1 | minor | `npx expo install --check` — Expo la pinea. |
| `react-native-screens` (mobile) | 4.26.2 | 4.27.0 | minor | Idem. |
| `react-native-svg` (mobile) | 15.15.4 | 15.15.5 | patch | Idem (pineada exacta). |
| `react-native-view-shot` (mobile) | 5.1.0 | 5.1.1 | patch | Idem (pineada exacta). |
| `typescript` | **5.9.3** (backend/web/shared) vs **6.0.3** (mobile) | 7.0.2 | — | **Drift dentro del monorepo:** `mobile/` en TS 6, el resto en TS 5.9. Alinear a una sola versión. TS 7 es major, no urgente. |
| `@types/node` | 20.19.43 | 26.4.1 | major | Dev. Alinear con Node real (Node 22 → `@types/node@22`). Bajo impacto. |
| `@types/express` / `@types/multer` (backend) | 4.17.25 / 1.4.13 | 5.0.6 / 2.2.0 | major | Dev. Sólo tienen sentido si se sube `express`/`multer` de major — hoy no. Dejar. |
| `@types/react-dom` (web) | 19.2.5 | 19.2.7 | patch | Dev, trivial. |
| `dotenv` (backend) | 16.6.1 | 17.4.2 | major | Dev-ish. `dotenv` 17 cambió defaults menores. No urgente. |
| `eslint` (web) | 9.39.5 | 10.9.1 | major | Dev. Junto con `eslint-config-next` — esperar a que Next soporte eslint 10 oficialmente. |
| `tsx` | 4.23.12 | 4.23.13 | patch | Trivial. |

### Expo SDK 57 — plugins con incompatibilidad conocida

Hubo un caso real: **`@sentry/react-native` no compila con SDK 57 en EAS** — se removió
del móvil (`@sentry/node` se mantiene sólo en el backend). También se removió
`expo-maps` (crasheaba nativo sin API key de Google Maps).

Del resto de los plugins instalados —`expo-image-picker`, `expo-location`,
`expo-local-authentication`, `expo-auth-session`, `expo-web-browser`, `expo-crypto`,
`expo-image-manipulator`, `expo-constants`, `expo-status-bar`, `@react-navigation/*`—
**ninguno tiene reporte de incompatibilidad conocida con SDK 57.** Todos se instalaron
con `npx expo install` (que elige la versión compatible) y `expo export` local pasa.

**Regla para adelante:** instalar plugins de Expo siempre con `npx expo install <pkg>`
(nunca `npm install`), y correr `npx expo-doctor` antes de cada build.

---

## 3. Paquetes sin mantenimiento

**Ninguno amerita reemplazo.** `npm ls --all` no marca ningún paquete `deprecated` en
todo el árbol.

| Paquete | Último cambio en registro | Estado |
|---|---|---|
| `leaflet` 1.9.4 | 2025-08 | **Estable / "terminado".** 1.9.x es la línea estable; Leaflet 2.0 está en beta. Lib madura de mapas, no necesita cambios frecuentes. Riesgo bajo. |
| `cors` 2.8.6 | 2026-01 | **Estable.** Middleware chico (~200 líneas), hace una cosa. No abandonado. |
| `@react-native-community/netinfo` 12.0.1 | 2026-02 | Activo, es el paquete oficial de la comunidad RN. Pineado exacto (`"12.0.1"`) — considerar `~12.0.1`. |
| `pdfkit` 0.20.2 | 2026-08 | Activo. |
| `recharts` 3.10.1 | 2026-08 | Activo. |
| `express` 4.x | 2026-08 (la línea 4.x sigue recibiendo patches) | La 4.x tiene soporte; la 5.x es el futuro (ver §2). |

---

## 4. Integridad del lockfile y build

| Chequeo | Estado |
|---|---|
| `package-lock.json` commiteado | ✅ **Uno solo en la raíz** (~546 KB). Los workspaces comparten lockfile — no hay lockfiles sueltos por carpeta (correcto para npm workspaces). |
| Lockfile sincronizado con los `package.json` | ✅ `npm ci --dry-run` pasa sin errores. Si alguien hubiera editado un `package.json` sin `npm install`, esto fallaría. |
| Backend usa `npm ci` (no `npm install`) | ✅ `backend/Dockerfile:28` → `RUN npm ci`. El comentario del Dockerfile ya explica por qué (capa cacheable + `npm ci` valida el lockfile). |
| Vercel usa `npm ci` | ⚠️ **`web/vercel.json` no tiene `installCommand`.** Vercel por defecto usa `npm ci` **si detecta un lockfile** (existe), pero dejarlo implícito es frágil. **Recomendación:** agregar `"installCommand": "npm ci"` a `vercel.json` — una línea, elimina la ambigüedad. |
| Rangos `^`/`~` en libs sensibles | ⚠️ **`@supabase/supabase-js: "^2.45.0"`** — rango enorme sobre **la librería de autenticación/sesión**. Resuelve hoy a 2.112.4, pero un `npm install` en otra máquina/fecha podría traer cualquier `2.x`. **Recomendación:** subir a `"^2.115.0"` (o pinear `"2.115.0"`). `multer: "^2.0.0"` (uploads) — más acotado pero misma idea, subir a `"^2.3.0"`. `express` (`^4.19.2`), `helmet` (`^8.3.0`), `cors` (`^2.8.5`), `express-rate-limit` (`^8.7.0`) tienen rangos razonables. |
| Drift declarado vs. lockfile | `@supabase/supabase-js` declarado `^2.45.0` → lockfile 2.112.4 (coincide con la nota del proyecto sobre v2.112+ y el WebSocket nativo de Node 22). `@anthropic-ai/sdk` `^0.68.0` → 0.68.0. `next` `16.3.2` exacto → 16.3.2. `react`/`react-dom` en `web` pineados `19.2.8` exacto. Sin drift problemático; los rangos amplios de arriba son la deuda. |
| `packages/shared` en el build de Vercel | El `buildCommand` de `vercel.json` hace `npm run build:shared` antes de `next build` — correcto, `@bitacora/shared` se compila desde fuente. |

---

## 5. Paquetes sospechosos

Revisadas **todas las dependencias directas** de los 5 `package.json` (raíz vacío;
backend, web, mobile, shared). **Ninguna sospechosa:**

- **Scopes oficiales:** `@expo/*`, `@react-navigation/*`, `@react-native-community/*`,
  `@supabase/*`, `@anthropic-ai/*`, `@aws-sdk/*`, `@sentry/*`, `@types/*`,
  `@tailwindcss/*`, `@bitacora/shared` (workspace propio).
- **Paquetes sueltos:** `expo`, `expo-*` (todos del scope Expo), `react`, `react-dom`,
  `react-native`, `react-native-*`, `next`, `leaflet`, `recharts`, `pdfkit`, `multer`,
  `helmet`, `cors`, `dotenv`, `express`, `express-rate-limit`, `tailwindcss`, `tsx`,
  `typescript`.
- **Sin typosquatting:** ningún nombre parecido-pero-no-idéntico a uno conocido (no hay
  `expres`, `helmt`, `axioss`, `crossenv`, `dotnev`, etc.).
- Todas tienen relación obvia con lo que hace Bitácora (web Next + móvil Expo + backend
  Express + Supabase + S3 + PDF + mapas + gráficos + IA de Anthropic).

---

## 6. Recomendación de chequeo continuo

Hoy **no hay ningún chequeo de dependencias en CI**. Los dos workflows existentes
(`check-migraciones-prod.yml`, `keep-warm.yml`) no tocan `npm audit`. Propuesta —
mismo patrón liviano, **NO implementado todavía** (revisar antes de commitear):

> **Ambos archivos ya venían corregidos de la primera pasada del 3-sep** — el error
> original era tratar el monorepo como 4 proyectos npm separados. Es **un solo lockfile
> con workspaces**: Dependabot y `npm audit` se configuran **una sola vez en la raíz**.

### 6.1 `.github/dependabot.yml` (nativo de GitHub, sin workflow que mantener)

```yaml
version: 2
updates:
  # --- npm: UN bloque para todo el monorepo (workspaces + lockfile raíz) ---
  - package-ecosystem: "npm"
    directory: "/"
    schedule: { interval: "weekly", day: "monday" }
    open-pull-requests-limit: 8
    # target-branch por defecto = main. Merge de una PR de Dependabot =
    # deploy automático (Vercel + Render). NUNCA activar auto-merge:
    # revisar y mergear a mano, sobre todo bumps de runtime.
    groups:
      security:
        applies-to: security-updates
        patterns: ["*"]
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
      # Express 5 = migración mayor, a mano (§2). Sin tests e2e.
      - dependency-name: "express"
        update-types: ["version-update:semver-major"]
      # Todo lo que pinea Expo SDK 57 — se actualiza SOLO con
      # `npx expo install` (Dependabot rompe la compat). Para CVEs de
      # estos: status page de Expo + `npx expo install --check` / expo-doctor.
      - dependency-name: "expo"
      - dependency-name: "expo-*"
      - dependency-name: "@expo/*"
      - dependency-name: "react"
      - dependency-name: "react-dom"
      - dependency-name: "react-native"
      - dependency-name: "react-native-*"
      - dependency-name: "@react-native-community/*"
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

**Además del archivo, en un repo privado:** Settings → Code security → activar
**"Dependabot alerts"** y **"Dependabot security updates"** (no vienen prendidos por
defecto en repos privados). El bloque `version-updates` funciona sin eso; el de
`security-updates` no.

### 6.2 `.github/workflows/deps-audit.yml` (gate en PR, mismo estilo que los existentes)

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
      # npm ci valida que el lockfile esté sincronizado con los package.json.
      - run: npm ci
      # Un solo audit en la raíz cubre los 4 workspaces (lockfile único).
      # Falla sólo ante high/critical — las moderate se ven pero no bloquean
      # (hoy hay 20 moderate transitivas de Expo/nav sin fix upstream).
      - name: npm audit (todo el monorepo)
        run: npm audit --audit-level=high
      - name: Detalle informativo (no bloquea)
        if: always()
        run: npm audit --audit-level=moderate || true
```

**Antes de commitear — decisiones abiertas:**

- **Umbral `--audit-level=high`:** hoy pasa (0 high/critical). Si aparece un high
  transitivo sin fix upstream, bloquea todas las PRs hasta agregar un `--omit` o
  aceptar el riesgo. Alternativa: dejarlo informativo (`|| true`).
- **Repo privado + minutos de Actions:** el cron semanal + cada PR que toca deps
  consume minutos. Con el plan actual debería sobrar.
- **Dependabot → `main` directo:** sus PRs apuntan a `main`, y mergear `main` deploya.
  Si querés colchón: `target-branch: "develop"` y mergear `develop → main` por lotes.
  Hoy no hay branch `develop`.
