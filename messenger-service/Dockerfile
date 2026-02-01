# Messenger Service Dockerfile for Railway deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем все зависимости (включая devDependencies для сборки)
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем только production зависимости
RUN npm ci --only=production

# Копируем собранный код
COPY --from=builder /app/dist ./dist

# Переменные окружения
ENV NODE_ENV=production

# Railway динамически задает PORT
EXPOSE ${PORT}

# Запускаем приложение
CMD ["node", "dist/index.js"]
