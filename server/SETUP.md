# Настройка Backend с Prisma и Supabase

## ✅ Что было сделано

1. **Создана полная Prisma схема** с моделями:
   - ✅ User
   - ✅ Lead
   - ✅ Deal
   - ✅ Task
   - ✅ Message
   - ✅ Campaign

2. **Все контроллеры используют Prisma** вместо mock данных:
   - ✅ LeadsController
   - ✅ DealsController
   - ✅ TasksController
   - ✅ CRMController
   - ✅ DashboardController
   - ✅ CampaignsController

3. **Создана структура backend сервера**:
   - Express сервер
   - Роуты для всех endpoints
   - Middleware для аутентификации и обработки ошибок
   - Prisma клиент

## 🚀 Шаги для запуска

### 1. Установите зависимости

```bash
cd server
npm install
```

### 2. Настройте DATABASE_URL

Создайте файл `.env` в папке `server/`:

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
PORT=3001
NODE_ENV=development
```

**Как получить DATABASE_URL:**
1. Откройте [app.supabase.com](https://app.supabase.com)
2. Ваш проект → **Settings** → **Database**
3. **Connection string** → **URI**
4. Замените `[YOUR-PASSWORD]` на пароль БД

### 3. Примените миграции Prisma

```bash
# Генерация Prisma клиента
npm run prisma:generate

# Создание и применение миграций
npm run prisma:migrate
```

При первом запуске Prisma создаст все таблицы в базе данных.

### 4. (Опционально) Заполните тестовыми данными

```bash
npm run prisma:seed
```

### 5. Запустите сервер

```bash
npm run dev
```

Сервер будет доступен на `http://localhost:3001`

## 📋 API Endpoints

Все endpoints требуют заголовки для разработки:
- `x-user-id`: ID пользователя
- `x-user-email`: Email пользователя

### Пример запроса:

```bash
curl -H "Content-Type: application/json" \
     -H "x-user-id: test-user-id" \
     -H "x-user-email: test@example.com" \
     http://localhost:3001/api/leads
```

## 🔄 Миграция с mock данных

Все контроллеры теперь используют Prisma:

- ❌ **Было**: `mockData.leads`, `mockData.deals`, `mockData.tasks`
- ✅ **Стало**: `prisma.lead.findMany()`, `prisma.deal.findMany()`, `prisma.task.findMany()`

Все данные сохраняются в Supabase PostgreSQL и изолированы по пользователям.

## ⚠️ Важно

1. **Аутентификация**: В продакшене замените `devAuthMiddleware` на `authMiddleware` для проверки JWT токенов
2. **RLS (Row Level Security)**: Настройте RLS политики в Supabase для безопасности данных
3. **Миграции**: Все изменения схемы делайте через Prisma миграции

## 📚 Документация

Подробная документация в `server/README.md`



