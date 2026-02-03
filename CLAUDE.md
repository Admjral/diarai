# DIAR AI - Правила и уроки для разработки

## Railway CLI

### Проблема: `command not found: railway`
Railway CLI установлен через Homebrew и находится по полному пути:
```bash
/opt/homebrew/bin/railway
```

### Решение
Всегда использовать полный путь или добавить в PATH:
```bash
# Использовать полный путь
/opt/homebrew/bin/railway up

# Или добавить в ~/.zshrc
export PATH="/opt/homebrew/bin:$PATH"
```

---

## Dockerfile и railway.toml

### Проблема: COPY файлов не находит пути
Когда в `railway.toml` указан:
```toml
[build]
dockerfilePath = "server/Dockerfile"
```
Docker контекст запускается из **корня проекта**, а не из папки server.

### Решение
Все пути в Dockerfile должны быть относительно корня:
```dockerfile
# НЕПРАВИЛЬНО (если Dockerfile в server/)
COPY package*.json ./
COPY start.sh ./

# ПРАВИЛЬНО (пути от корня проекта)
COPY server/package*.json ./
COPY server/start.sh ./start.sh
COPY server/prisma ./prisma/
COPY server/ .
```

### Правило
Если `dockerfilePath` указывает в подпапку, а `builder = "DOCKERFILE"` без указания context, то контекст = корень репозитория.

---

## .dockerignore

### Проблема: Docker не видит нужные файлы
Если в .dockerignore указано:
```
server/
```
То вся папка server игнорируется при сборке.

### Решение
Игнорировать только ненужные подпапки:
```dockerignore
node_modules
dist
build
.git
.env
*.log

# НЕ игнорируем server/ - нужен для backend сборки
# Игнорируем только ненужное внутри:
server/node_modules
server/dist

messenger-service/
```

---

## Git Push Protection

### Проблема: Push отклоняется из-за секретов
GitHub блокирует push если в коммите есть токены или ключи:
```
remote: Push cannot contain secrets
```

### Решение
1. Удалить файл из индекса:
```bash
git rm --cached CLAUDE.md
```

2. Добавить в .gitignore:
```
CLAUDE.md
```

3. Перекоммитить без секретов:
```bash
git commit --amend
git push --force
```

### Правило
НИКОГДА не коммитить:
- GitHub токены (ghp_*)
- API ключи (sk-*, AKIA*)
- Пароли и секреты
- .env файлы с реальными данными

---

## PostgreSQL Enum Migrations

### Проблема: ALTER TYPE ADD VALUE в транзакции
PostgreSQL не позволяет добавлять значения в enum внутри транзакции:
```sql
-- ОШИБКА: P3009 migrate found failed migrations
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'Start';
```

### Решение
Использовать DO блок с прямой вставкой в pg_enum:
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Start'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Plan')
  ) THEN
    INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
    SELECT
      t.oid,
      'Start',
      (SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = t.oid)
    FROM pg_type t
    WHERE t.typname = 'Plan';
  END IF;
END
$$;
```

---

## Prisma Failed Migrations

### Проблема: P3009 - Migration failed to apply
После неудачной миграции Prisma блокирует дальнейшие миграции.

### Решение
1. Проверить статус миграций:
```bash
npx prisma migrate status
```

2. Если миграция failed, откатить её:
```bash
npx prisma migrate resolve --rolled-back "20260201210000_rename_free_to_start"
```

3. Исправить SQL миграции и повторить:
```bash
npx prisma migrate deploy
```

### Автоматизация в start.sh
```bash
# Проверить и откатить failed миграции
MIGRATION_STATUS=$(npx prisma migrate status 2>&1)
if echo "$MIGRATION_STATUS" | grep -q "failed"; then
  # Извлечь имя failed миграции (формат: имя_миграции Failed)
  FAILED_NAME=$(echo "$MIGRATION_STATUS" | grep -B1 "Failed" | head -1 | awk '{print $1}')
  if [ -n "$FAILED_NAME" ] && [ "$FAILED_NAME" != "Following" ]; then
    echo "Resolving failed migration: $FAILED_NAME"
    npx prisma migrate resolve --rolled-back "$FAILED_NAME"
  fi
fi
```

---

## Railway Deployment Checklist

### Перед деплоем:
- [ ] Проверить .dockerignore - не блокирует ли нужные файлы
- [ ] Проверить пути в Dockerfile относительно контекста
- [ ] Убедиться что start.sh executable (`chmod +x`)
- [ ] Проверить что нет секретов в коммитах
- [ ] Проверить переменные окружения в Railway Dashboard

### Команды деплоя:
```bash
# Деплой backend
cd /Users/adilhamitov/Downloads/diarai
/opt/homebrew/bin/railway up --service backend

# Проверить логи
/opt/homebrew/bin/railway logs --service backend

# Проверить статус
/opt/homebrew/bin/railway status
```

### Переменные окружения (обязательные):
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-min-32-chars
OPENAI_API_KEY=sk-...
NODE_ENV=production
```

---

## Структура проекта

```
diarai/
├── src/                    # Frontend (React + Vite)
├── server/                 # Backend (Express + Prisma)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   ├── Dockerfile
│   ├── start.sh
│   └── railway.toml
├── messenger-service/      # Отдельный сервис мессенджеров
├── .dockerignore
├── railway.toml            # Главный конфиг Railway
└── CLAUDE.md               # Этот файл
```

---

## Планы подписок

| План | Цена | Описание |
|------|------|----------|
| Start | ₸50,000/мес | Начальный план |
| Pro | ₸120,000/мес | Популярный |
| Business | ₸250,000/мес | Полный функционал |

Enum в Prisma: `Start`, `Pro`, `Business` (НЕ Free!)

---

## Частые ошибки

1. **Railway CLI не найден** → Использовать `/opt/homebrew/bin/railway`
2. **COPY not found в Docker** → Проверить пути относительно контекста (корень)
3. **GitHub push rejected** → Удалить секреты из коммита
4. **P3009 migration failed** → `prisma migrate resolve --rolled-back`
5. **Enum ADD VALUE error** → Использовать `ALTER TYPE ADD VALUE IF NOT EXISTS` вне транзакции
6. **Healthcheck failed** → Сервер не стартует за 5 минут, упростить start.sh

---

## Рабочее решение для Enum миграций (PostgreSQL)

### Проблема
`INSERT INTO pg_enum` не работает в PostgreSQL 12+ (ошибка с null oid).
`ALTER TYPE ADD VALUE` не работает внутри транзакции Prisma.

### Решение: 4-шаговый подход в start.sh

```bash
#!/bin/sh
set -e

# 1. Resolve failed migration (если есть)
npx prisma migrate resolve --rolled-back "migration_name" 2>/dev/null || true

# 2. Add enum value OUTSIDE transaction
cat > /tmp/add_enum.sql << 'EOSQL'
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'Start';
EOSQL
npx prisma db execute --file /tmp/add_enum.sql 2>/dev/null || true

# 3. Update data
cat > /tmp/fix_data.sql << 'EOSQL'
UPDATE "users" SET "plan" = 'Start' WHERE "plan" = 'Free';
EOSQL
npx prisma db execute --file /tmp/fix_data.sql 2>/dev/null || true

# 4. Mark migration as applied
npx prisma migrate resolve --applied "migration_name" 2>/dev/null || true

# 5. Run remaining migrations
npx prisma migrate deploy

# 6. Start server
node dist/index.js
```

### Ключевые моменты
- `npx prisma db execute` выполняет SQL **вне транзакции**
- `2>/dev/null || true` игнорирует ошибки (идемпотентность)
- Сначала `--rolled-back`, потом `--applied` для одной миграции

---

## Railway CLI - Полезные команды

```bash
# Путь к CLI
RAILWAY=/opt/homebrew/bin/railway

# Деплой
$RAILWAY up --service backend

# Принудительный редеплой (без изменений кода)
$RAILWAY redeploy --service backend --yes

# Рестарт (без пересборки)
$RAILWAY restart --service backend

# Список деплоев
$RAILWAY deployment list --service backend

# Build логи конкретного деплоя
$RAILWAY logs --service backend --build <deployment-id>

# Runtime логи конкретного деплоя
$RAILWAY logs --service backend --deployment <deployment-id>

# Текущие логи
$RAILWAY logs --service backend

# Статус проекта
$RAILWAY status
```

---

## Railway Healthcheck

### Конфигурация (в railway.toml или Dashboard)
```toml
[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300  # 5 минут
```

### Причины фейла healthcheck
1. **Сервер долго стартует** - упростить start.sh, убрать loops
2. **Миграции зависают** - не использовать `npx prisma migrate status` в loop
3. **База недоступна** - проверить DATABASE_URL
4. **Порт не слушается** - проверить что сервер слушает `0.0.0.0:PORT`

### Логи для диагностики
```bash
# Build логи (сборка Docker)
$RAILWAY logs --service backend --build <id>

# Deploy логи (runtime, startup)
$RAILWAY logs --service backend --deployment <id>
```

---

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (сборка)
- Tailwind CSS
- Lucide React (иконки)
- Radix UI (компоненты)

### Backend
- Node.js 20 + Express
- TypeScript
- Prisma ORM
- PostgreSQL (Railway)
- JWT (аутентификация)
- Winston (логирование)

### Infrastructure
- Railway (хостинг, БД)
- Docker (контейнеризация)
- GitHub (репозиторий)

---

## API Endpoints

### Auth
```
POST /api/auth/register   - Регистрация
POST /api/auth/login      - Вход
GET  /api/auth/me         - Профиль
```

### CRM
```
GET/POST/PUT/DELETE /api/leads   - Лиды
GET/POST/PUT/DELETE /api/deals   - Сделки
GET/POST/PUT/DELETE /api/tasks   - Задачи
GET /api/crm/stats               - Статистика
```

### Campaigns
```
GET/POST/PUT/DELETE /api/campaigns
POST /api/ai/audience            - AI генерация аудитории
POST /api/ai/generate-image      - AI генерация изображений
```

### Wallet & Payments
```
GET  /api/wallet                 - Баланс
GET  /api/wallet/transactions    - История
POST /api/payment-requests       - Запрос на подписку
GET  /api/payment-requests/my    - Мои запросы на подписку
```

### Wallet Top-Up (пополнение кошелька)
```
POST /api/wallet-topup           - Создать запрос
GET  /api/wallet-topup/my/active - Активный запрос
PUT  /api/wallet-topup/:id/paid  - Отметить "Оплатил"
```

### Admin
```
GET  /api/admin/stats
GET  /api/admin/users
GET  /api/admin/payment-requests
PUT  /api/admin/payment-requests/:id/approve
PUT  /api/admin/payment-requests/:id/reject
GET  /api/wallet-topup/admin
GET  /api/wallet-topup/admin/count
PUT  /api/wallet-topup/admin/:id/approve
PUT  /api/wallet-topup/admin/:id/reject
```

---

## Переменные окружения

### Backend (обязательные)
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=min-32-characters-secret
NODE_ENV=production
PORT=8080
```

### Backend (опциональные)
```env
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
SENTRY_DSN=https://...
```

### Frontend
```env
VITE_API_URL=https://api.example.com
```

---

## Prisma Commands

```bash
# Генерация клиента
npx prisma generate

# Создание миграции (dev)
npx prisma migrate dev --name migration_name

# Применение миграций (prod)
npx prisma migrate deploy

# Статус миграций
npx prisma migrate status

# Resolve failed migration
npx prisma migrate resolve --rolled-back "migration_name"
npx prisma migrate resolve --applied "migration_name"

# Выполнить SQL вне транзакции
npx prisma db execute --file script.sql

# Открыть Prisma Studio
npx prisma studio
```

---

## Git Workflow

### Коммит с Co-Author
```bash
git commit -m "$(cat <<'EOF'
Описание изменений

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### Удаление секретов из истории
```bash
git rm --cached file_with_secret
echo "file_with_secret" >> .gitignore
git commit --amend
git push --force
```

---

## Kaspi Payment Flow

### Ссылка для оплаты
```
https://pay.kaspi.kz/pay/7wfg2vrb
```

### Процесс
1. Клиент выбирает план (Start/Pro/Business)
2. Клиент переходит по ссылке Kaspi и оплачивает
3. Клиент нажимает "Я оплатил" → создаётся PaymentRequest
4. Админ проверяет оплату в Kaspi
5. Админ одобряет → user.plan обновляется

### Цены
| План | Сумма |
|------|-------|
| Start | ₸50,000 |
| Pro | ₸120,000 |
| Business | ₸250,000 |

---

## Wallet Top-Up Flow (QR-код Kaspi)

### Описание
Пополнение кошелька через QR-код Kaspi с ручным подтверждением админом.

### Ссылка для оплаты
```
https://pay.kaspi.kz/pay/7wfg2vrb
```

### QR-код
Файл: `public/kaspi-qr.png`

### Процесс (User Flow)
```
1. Дашборд → Кошелек → "Пополнить"
2. Ввод суммы → "Подтвердить" → status: pending_payment
3. QR-код + "Оплатить по ссылке" (для мобильных)
4. "Оплатил" → status: paid
5. Ожидание подтверждения админа
```

### Процесс (Admin Flow)
```
1. AdminPanel → "Пополнения" (вкладка с badge)
2. Видит запросы со статусом "Оплатил"
3. "Подтвердить" → баланс кошелька увеличивается
   или "Отклонить" → status: rejected
```

### API Endpoints

#### User endpoints
```
POST /api/wallet-topup           - Создать запрос на пополнение
GET  /api/wallet-topup/my        - Мои запросы
GET  /api/wallet-topup/my/active - Активный запрос (для проверки статуса)
PUT  /api/wallet-topup/:id/paid  - Отметить "Оплатил"
```

#### Admin endpoints
```
GET  /api/wallet-topup/admin           - Все запросы
GET  /api/wallet-topup/admin/count     - Кол-во pending (для badge)
PUT  /api/wallet-topup/admin/:id/approve - Подтвердить пополнение
PUT  /api/wallet-topup/admin/:id/reject  - Отклонить
```

### Модель данных
```prisma
model WalletTopUpRequest {
  id          Int                 @id @default(autoincrement())
  userId      Int
  user        User                @relation(fields: [userId], references: [id])
  amount      Decimal             @db.Decimal(10, 2)
  status      WalletTopUpStatus   @default(pending_payment)
  note        String?             // Заметка клиента
  adminNote   String?             // Заметка админа
  paidAt      DateTime?           // Когда нажал "Оплатил"
  processedAt DateTime?           // Когда обработан
  processedBy Int?                // userId админа

  @@map("wallet_topup_requests")
}

enum WalletTopUpStatus {
  pending_payment  // Создан, ждём оплаты
  paid             // Оплатил, ждём админа
  approved         // Подтверждено, деньги зачислены
  rejected         // Отклонено
}
```

### Файлы
| Файл | Описание |
|------|----------|
| `server/src/controllers/wallet-topup.controller.ts` | Контроллер |
| `server/src/routes/wallet-topup.routes.ts` | Маршруты |
| `src/components/Wallet.tsx` | UI пополнения (3-шаговый flow) |
| `src/components/AdminPanel.tsx` | Вкладка "Пополнения" |
| `src/lib/api.ts` | `walletTopUpAPI` объект |
| `public/kaspi-qr.png` | QR-код для сканирования |

### Важно
- Минимальная сумма: 100 ₸
- Один активный запрос на пользователя
- При approve создаётся WalletTransaction с type='deposit'
- Badge показывает кол-во запросов со статусом 'paid'

---

## Debugging

### Проверка сервера
```bash
curl https://your-api.railway.app/health
```

### Проверка БД подключения
```bash
# В контейнере или локально
npx prisma db pull
```

### Логи в реальном времени
```bash
$RAILWAY logs --service backend -f
```

### Проверка enum значений в БД
```sql
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Plan');
```

### Проверка пользователей с определённым планом
```sql
SELECT id, email, plan FROM users WHERE plan = 'Free';
```
