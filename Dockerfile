FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY server/package.json ./package.json
RUN npm install --omit=dev && npm cache clean --force

COPY server/ ./

EXPOSE 3000

CMD ["node", "index.js"]
