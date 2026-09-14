# ============================================================
# BITÁCORA — Dockerfile del backend
#
# IMPORTANTE: el build context es la RAÍZ del monorepo, no backend/.
#   - Render: Root Directory vacío, Dockerfile Path = backend/Dockerfile
#   - Local:  docker build -f backend/Dockerfile .
#
# El backend depende de @bitacora/shared (workspace de npm), así que el
# build necesita ver packages/shared/ y el package-lock.json de la raíz.
# ============================================================

# Node 22: @supabase/supabase-js v2 (realtime-js) necesita un WebSocket
# global nativo, que recién existe sin flags desde Node 22. Con node:20
# el backend crashea al arrancar ("native WebSocket not found").
FROM node:22-slim AS base
WORKDIR /app

# --- dependencias ---
# Solo los manifests primero, para que la capa de npm ci se cachee
# mientras no cambien. Hacen falta los package.json de TODOS los
# workspaces que lista la raíz (web, mobile, backend, packages/*) o
# npm ci se queja de que el lockfile no cuadra.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY web/package.json ./web/
COPY mobile/package.json ./mobile/
# --ignore-scripts: `mobile` tiene un postinstall (`cd .. && npm run
# build:packages`, para los builds de EAS) que acá se dispararía durante
# `npm ci` y fallaría — todavía no copiamos packages/shared/tsconfig.json
# ni src/, y packages/design-tokens ni packages/ui se copian NUNCA a
# esta imagen (el backend no los necesita en runtime). El shared se compila
# explícito más abajo, cuando el código ya está. El backend no tiene
# dependencias nativas, así que saltear los scripts de install es seguro.
RUN npm ci --ignore-scripts

# --- código + build ---
# Solo lo que el backend necesita compilar: shared primero (genera su
# dist/), backend después. build:shared / build:backend son scripts de
# la raíz que hacen `npm run build -w <workspace>`.
COPY packages/shared ./packages/shared
COPY backend ./backend
RUN npm run build:shared && npm run build:backend

# Deja node_modules solo con dependencias de producción (quita
# typescript, tsx, @types/*, etc.) antes de copiarlo a la imagen final.
#
# --ignore-scripts (mismo motivo que el `npm ci` de arriba): `npm
# prune` reconcilia el árbol de node_modules y eso vuelve a disparar el
# postinstall de `mobile` (`cd .. && npm run build:packages` ->
# `npm run build -w packages/design-tokens`) — pero esta imagen JAMÁS
# copia packages/design-tokens ni packages/ui (el backend no los usa en
# runtime), así que ese workspace no existe en el filesystem del build
# y npm revienta con "No workspaces found: --workspace=packages/
# design-tokens". Bug real (14-sep-2026): esto rompió TODOS los
# deploys desde el commit que agregó packages/design-tokens y cambió
# el postinstall de mobile de build:shared a build:packages
# (28c7f49, 10-sep) — nadie lo notó porque verificar.sh no construye
# la imagen Docker. Prune sigue quitando devDependencies igual que
# antes; --ignore-scripts solo evita que dispare scripts que no hacen
# falta para eso.
RUN npm prune --omit=dev --ignore-scripts

# --- imagen final, liviana ---
FROM node:22-slim
WORKDIR /app/backend
ENV NODE_ENV=production

# node_modules hoisteado de la raíz (incluye el symlink
# @bitacora/shared -> ../../packages/shared, que Docker preserva).
COPY --from=base /app/node_modules /app/node_modules
# El destino del symlink: package.json (main: dist/index.js) + el dist ya compilado.
COPY --from=base /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=base /app/packages/shared/dist /app/packages/shared/dist
# El backend en sí.
COPY --from=base /app/backend/package.json ./package.json
COPY --from=base /app/backend/dist ./dist

# El puerto se lee de la variable PORT (Render la asigna).
EXPOSE 8080
CMD ["node", "dist/server.js"]
