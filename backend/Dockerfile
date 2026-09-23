# Construir desde la raíz: docker build -f backend/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY backend backend
RUN npm run build -w backend
RUN npm prune --omit=dev
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/package.json
RUN mkdir /app/backend/uploads && chown -R node:node /app/backend/uploads
USER node
WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]
