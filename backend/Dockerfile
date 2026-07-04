FROM node:22-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/
RUN npm ci --omit=dev --workspace=backend

COPY backend/ backend/

WORKDIR /app/backend

EXPOSE 3000

CMD ["node", "src/server.js"]
