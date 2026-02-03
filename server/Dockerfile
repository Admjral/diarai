# Backend Dockerfile for Railway deployment
# Build version: 2026-02-03-v6-server-context
# NOTE: Build context is server/ directory
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем файлы зависимостей (относительно server/)
COPY package*.json ./
COPY prisma ./prisma/

# Устанавливаем все зависимости (включая devDependencies для сборки)
RUN npm install

# Генерируем Prisma Client
RUN npx prisma generate

# Копируем исходный код
COPY . .

# Собираем TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
COPY prisma ./prisma/

# Устанавливаем только production зависимости
RUN npm install --omit=dev

# Генерируем Prisma Client
RUN npx prisma generate

# Копируем собранный код
COPY --from=builder /app/dist ./dist

# Копируем start скрипт
COPY start.sh ./start.sh
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
