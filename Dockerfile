FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY server/package.json ./package.json
RUN npm install --omit=dev && npm cache clean --force

COPY server/ ./

EXPOSE 3000

CMD ["node", "index.js"]

# Frontend estático servido pela mesma origem da API.
COPY index.html catalogo.html curso.html curso-reforma-tributaria.html ./public/
COPY css ./public/css
COPY js ./public/js
COPY data ./public/data
COPY assets ./public/assets
