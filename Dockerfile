# Etapa 1: compila o editor React (pasta editor/) com o Vite. Esta etapa tem Node e as
# ferramentas de build; a imagem final recebe só o resultado (public/admin/editor/).
FROM node:22-alpine AS editor
WORKDIR /build/editor
COPY editor/package.json editor/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY editor/ ./
RUN npm run build

# Etapa 2: imagem final (API + site).
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app
# /data/uploads: imagens enviadas pelo painel (montada como volume no docker-compose).
RUN chown node:node /app \
    && mkdir -p /data/uploads && chown node:node /data/uploads
USER node

# Dependências primeiro (cache de camadas). Com package-lock.json usa `npm ci`
# (instalação reproduzível); sem ele, cai para `npm install`.
COPY --chown=node:node server/package.json server/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
    && npm cache clean --force

# Código da API e frontend estático (pasta public/, servida pelo Express).
COPY --chown=node:node server/ ./
COPY --chown=node:node public/ ./public/
COPY --from=editor --chown=node:node /build/public/admin/editor/ ./public/admin/editor/

EXPOSE 3000
CMD ["node", "index.js"]
