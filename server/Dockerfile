# Backend Dockerfile for Railway deployment
# Build version: 2026-02-01-v5-root-context
# NOTE: This Dockerfile is run from repository ROOT via railway.toml
# All paths are relative to the root directory, not server/
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем файлы зависимостей (пути относительно ROOT)
COPY server/package*.json ./
COPY server/prisma ./prisma/

# Устанавливаем все зависимости (включая devDependencies для сборки)
RUN npm install

# Генерируем Prisma Client
RUN npx prisma generate

# Копируем исходный код сервера
COPY server/ .

# Собираем TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем файлы зависимостей (из server/)
COPY server/package*.json ./
COPY server/prisma ./prisma/

# Устанавливаем только production зависимости
RUN npm install --omit=dev

# Генерируем Prisma Client
RUN npx prisma generate

# Копируем собранный код
COPY --from=builder /app/dist ./dist

# Копируем start скрипт (из server/)
COPY server/start.sh ./start.sh
RUN chmod +x ./start.sh

# Создаем директорию для uploads
RUN mkdir -p /app/uploads

# Переменные окружения
ENV NODE_ENV=production
ENV UPLOADS_DIR=/app/uploads

# Railway динамически задает PORT
EXPOSE ${PORT}

# Запускаем с миграциями
CMD ["./start.sh"]
