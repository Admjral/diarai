# DIAR AI Backend Dockerfile
# Version: v9-2026-02-03-16:15
# Railway deployment with Docker
# CACHE INVALIDATION: 1707055300

FROM node:20-slim AS builder

# Force cache invalidation by echoing build timestamp
RUN echo "Build timestamp: 2026-02-03T16:15:00Z" && date

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

# Копируем собранный код и start скрипт из builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/start.sh ./start.sh
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
