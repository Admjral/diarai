# Backend Dockerfile for Railway deployment
# Build version: 2026-02-03-v7-root-context
# NOTE: Build context is repository ROOT, not server/
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем файлы зависимостей (пути относительно ROOT репозитория)
COPY server/package*.json ./
COPY server/prisma ./prisma/

# Устанавливаем все зависимости (включая devDependencies для сборки)
RUN npm install

# Генерируем Prisma Client
RUN npx prisma generate

# Копируем исходный код из server/
COPY server/ .

# Собираем TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем файлы зависимостей
COPY server/package*.json ./
COPY server/prisma ./prisma/

# Устанавливаем только production зависимости
RUN npm install --omit=dev

# Генерируем Prisma Client
RUN npx prisma generate

# Копируем собранный код
COPY --from=builder /app/dist ./dist

# Копируем start скрипт
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
