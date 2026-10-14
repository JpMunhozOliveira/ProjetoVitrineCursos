FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app
RUN chown node:node /app
USER node

# Dependências primeiro (cache de camadas). Com package-lock.json usa `npm ci`
# (instalação reproduzível); sem ele, cai para `npm install`.
COPY --chown=node:node server/package.json server/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
    && npm cache clean --force

# Código da API e frontend estático (pasta public/, servida pelo Express).
COPY --chown=node:node server/ ./
COPY --chown=node:node public/ ./public/

EXPOSE 3000
CMD ["node", "index.js"]
