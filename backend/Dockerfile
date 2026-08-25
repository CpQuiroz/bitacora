# ============================================================
# BITÁCORA — Dockerfile del backend
# Corre igual en Cloud Run, AWS Fargate, Azure Container Apps,
# o un servidor propio — no depende de ningún proveedor
# ============================================================

FROM node:20-slim AS base
WORKDIR /app

# --- dependencias ---
COPY package*.json ./
RUN npm ci --omit=dev

# --- código ---
COPY . .
RUN npm run build

# --- imagen final, liviana ---
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/package.json ./package.json

# El puerto se lee de la variable PORT — así funciona igual
# en Cloud Run (que la asigna) como en cualquier otro lado
EXPOSE 8080
CMD ["node", "dist/server.js"]
