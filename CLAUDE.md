# DIAR AI - Инструкции для разработки

---

## Автономная работа

**ВАЖНО:** Claude должен выполнять все действия самостоятельно без запроса подтверждения:

1. **Git операции** — коммитить и пушить изменения автоматически после завершения задачи
2. **Деплой** — запускать редеплой всех затронутых сервисов через Railway API
3. **Миграции** — применяются автоматически через `start.sh` при деплое backend
4. **Проверка статуса** — проверять статус деплоя после запуска

### Порядок действий после изменений:
```bash
# 1. Коммит
git add <files> && git commit -m "описание"

# 2. Пуш (использовать токен из credentinals.txt)
git push https://<GITHUB_TOKEN>@github.com/Admjral/diarai.git main

# 3. Редеплой затронутых сервисов
curl -X POST 'https://backboard.railway.app/graphql/v2' \
  -H 'Authorization: Bearer <RAILWAY_TOKEN>' \
  -H 'Content-Type: application/json' \
  --data-raw '{"query":"mutation { serviceInstanceRedeploy(serviceId: \"<ID>\", environmentId: \"e0ac84af-4a63-44db-8d83-7e4c2140f6ed\") }"}'
```

### Какие сервисы редеплоить:
- Изменения в `server/` → backend
- Изменения в `src/` → frontend
- Изменения в `messenger-service/` → messenger-service

---

## Railway Service IDs

| Сервис | ID |
|--------|-----|
| backend | `46fb55af-941c-420c-9bdf-d0936055fdec` |
| frontend | `b120264f-9a6e-4aa7-855c-d25872303a5b` |
| messenger-service | `1d44198e-c2d3-450a-a13e-a893c7693367` |
| evolution-api | `9d966ef6-faf4-4f2a-80f1-536ea51c93b4` |
| Postgres | `34c220c0-693c-4900-8dd9-a5789c5e888c` |
| environment | `e0ac84af-4a63-44db-8d83-7e4c2140f6ed` |
| project | `9359e0b8-249a-4fbd-93c0-d67a6139f954` |

## URLs

| Сервис | URL |
|--------|-----|
| Backend | `https://backend-production-be6a0.up.railway.app` |
| Frontend | `https://app.diar.pro` |
| Evolution API | `https://evolution-api-production-76ab.up.railway.app` |
| Messenger Service | `https://messenger-service-production-b9c4.up.railway.app` |

---

## Railway API

### Триггер редеплоя
```bash
curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { serviceInstanceRedeploy(serviceId: \"SERVICE_ID\", environmentId: \"ENV_ID\") }"}'
```

### Установить переменную
```bash
curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { variableUpsert(input: { projectId: \"PROJECT_ID\", environmentId: \"ENV_ID\", serviceId: \"SERVICE_ID\", name: \"VAR_NAME\", value: \"VAR_VALUE\" }) }"}'
```

### Удалить/создать сервис (при проблемах с кешем)
```bash
# Удалить
curl -s -X POST ... -d '{"query":"mutation { serviceDelete(id: \"SERVICE_ID\") }"}'

# Создать
curl -s -X POST ... -d '{"query":"mutation { serviceCreate(input: { name: \"backend\", projectId: \"PROJECT_ID\" }) { id } }"}'

# Подключить к GitHub
curl -s -X POST ... -d '{"query":"mutation { serviceConnect(id: \"SERVICE_ID\", input: { repo: \"Admjral/diarai\", branch: \"main\" }) { id } }"}'
```

---

## Dockerfile

### ВАЖНО: Два разных Dockerfile!

| Сервис | Dockerfile | railway.toml |
|--------|------------|--------------|
| Backend | `server/Dockerfile` | `server/railway.toml` |
| Frontend | `Dockerfile` (корень) | НЕТ (удалён из корня) |

**КРИТИЧНО:** `railway.toml` в корне применяется ко ВСЕМ сервисам!
- Если frontend показывает ошибку `DATABASE_URL is not set` — он использует backend Dockerfile
- Решение: удалить `railway.toml` из корня, оставить только `server/railway.toml`

### Backend Dockerfile (server/Dockerfile)
```dockerfile
COPY server/package*.json ./
COPY server/prisma ./prisma/
COPY server/ .
```

### Frontend Dockerfile (корень)
```dockerfile
# Копировать ТОЛЬКО frontend файлы!
COPY package*.json ./
COPY public ./public
COPY src ./src
COPY index.html ./
COPY vite.config.ts ./
# НЕ копировать server/!
```

### Правило: копировать из builder stage
```dockerfile
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/start.sh ./start.sh
```

---

## Git

```bash
git push https://<GITHUB_TOKEN>@github.com/Admjral/diarai.git main
```

---

## Wallet Top-Up API

```
POST /api/wallet-topup           - Создать запрос
GET  /api/wallet-topup/my/active - Активный запрос
PUT  /api/wallet-topup/:id/paid  - Отметить "Оплатил"

GET  /api/wallet-topup/admin           - Все (admin)
PUT  /api/wallet-topup/admin/:id/approve
PUT  /api/wallet-topup/admin/:id/reject
```

### Файлы
- `server/src/controllers/wallet-topup.controller.ts`
- `server/src/routes/wallet-topup.routes.ts`
- `src/components/Wallet.tsx`
- `src/components/AdminPanel.tsx`

---

## Railway (Frontend)

Frontend деплоится на Railway (НЕ Vercel!).

### Принудительный редеплой
```bash
curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { serviceInstanceRedeploy(serviceId: \"b120264f-9a6e-4aa7-855c-d25872303a5b\", environmentId: \"e0ac84af-4a63-44db-8d83-7e4c2140f6ed\") }"}'
```

### Проверить статус деплоя
```bash
curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { deployments(first: 3, input: { serviceId: \"SERVICE_ID\" }) { edges { node { id status createdAt } } } }"}'
```

### Получить логи деплоя
```bash
curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { deploymentLogs(deploymentId: \"DEPLOYMENT_ID\", limit: 50) { message timestamp } }"}'
```

### Очистка кеша браузера
После деплоя пользователю нужно:
- **Mac:** `Cmd + Shift + R`
- **Windows:** `Ctrl + Shift + R`

---

## Wallet Top-Up Flow (QR)

**ВАЖНО:** Пополнение кошелька через статический QR-код Kaspi, НЕ через Kaspi API!

```
User: Ввод суммы → QR код → Нажал "Оплатил"
Admin: Видит запрос → Подтверждает → Баланс увеличен
```

Файлы:
- QR картинка: `public/kaspi-qr.png`
- Frontend: `src/components/Wallet.tsx` использует `walletTopUpAPI`
- Backend: `/api/wallet-topup` (НЕ `/api/wallet/add`)

Если ошибка "Kaspi.kz credentials not configured" - frontend использует старый код!

---

## Gemini AI (НЕ OpenAI!)

Проект использует **Google Gemini**, не OpenAI. Переменная окружения: `GEMINI_API_KEY`

### Модели
| Задача | Модель |
|--------|--------|
| Генерация текста | `gemini-2.0-flash` |
| Генерация изображений | `gemini-2.0-flash-exp-image-generation` |

### Файл
`server/src/services/openai.service.ts` (название осталось от OpenAI, но внутри Gemini)

### Проверка API ключа
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY"
```

### Добавить ключ в Railway
```bash
curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { variableUpsert(input: { projectId: \"9359e0b8-249a-4fbd-93c0-d67a6139f954\", environmentId: \"e0ac84af-4a63-44db-8d83-7e4c2140f6ed\", serviceId: \"46fb55af-941c-420c-9bdf-d0936055fdec\", name: \"GEMINI_API_KEY\", value: \"YOUR_KEY\" }) }"}'
```

---

## WhatsApp Integration (Evolution API)

**ВАЖНО:** Проект использует **Evolution API**, НЕ WAHA!

### Почему Evolution API?
- Multi-session: каждый пользователь = своя WhatsApp сессия
- WAHA Core поддерживал только 1 сессию 'default'
- Evolution API бесплатный open-source

### Переменные окружения
```env
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=your-api-key
```

### Docker
```bash
docker run -d -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=your-key \
  atendai/evolution-api:latest
```

### API Endpoints (Evolution vs WAHA)
| Операция | Evolution API | WAHA (deprecated) |
|----------|---------------|-------------------|
| Создать сессию | `POST /instance/create` | `POST /api/sessions` |
| QR код | `GET /instance/connect/{instance}` | `GET /api/{session}/auth/qr` |
| Статус | `GET /instance/connectionState/{instance}` | `GET /api/sessions/{session}` |
| Отправить текст | `POST /message/sendText/{instance}` | `POST /api/sendText` |

### Webhook события
- `MESSAGES_UPSERT` — входящее сообщение
- `MESSAGES_UPDATE` — статус доставки
- `CONNECTION_UPDATE` — статус подключения
- `QRCODE_UPDATED` — обновление QR кода

### Файлы
- `messenger-service/src/channels/whatsapp/whatsapp.service.ts`
- `messenger-service/src/routes/webhook.routes.ts`
- `messenger-service/docker-compose.yml`

### Формат номера телефона
Evolution API использует **только цифры** (без `@c.us`):
```typescript
// Правильно
number: "77001234567"

// Неправильно (WAHA формат)
chatId: "77001234567@c.us"
```

### Маппинг статусов подключения
Frontend ожидает WAHA-совместимые статусы. Evolution → WAHA маппинг:
| Evolution | WAHA (для frontend) | isConnected |
|-----------|---------------------|-------------|
| `open` | `WORKING` | true |
| `connecting` | `STARTING` | false |
| `qrcode` | `SCAN_QR_CODE` | false |
| `close` | `STOPPED` | false |

### Миграция с WAHA
1. Существующие пользователи с сессией 'default' потеряют подключение
2. Нужно повторно отсканировать QR код
3. Новые сессии создаются как `user-{userId}-wa` (sanitized)

### Рабочая конфигурация Evolution API на Railway

**Обязательные переменные:**
```env
# Аутентификация
AUTHENTICATION_TYPE=apikey
AUTHENTICATION_API_KEY=your-secret-key

# База данных (использует общий Postgres)
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://user:pass@postgres.railway.internal:5432/railway?schema=evolution

# Кеширование (без Redis)
CACHE_REDIS_ENABLED=false
CACHE_LOCAL_ENABLED=true

# Webhook
WEBHOOK_GLOBAL_URL=https://messenger-service-production-b9c4.up.railway.app/webhook/whatsapp
WEBHOOK_GLOBAL_ENABLED=true
WEBHOOK_EVENTS_MESSAGES_UPSERT=true
WEBHOOK_EVENTS_CONNECTION_UPDATE=true
WEBHOOK_EVENTS_QRCODE_UPDATED=true

# Прочее
PORT=8080
LOG_LEVEL=ERROR
```

### Проверка работы
```bash
# Health check
curl https://evolution-api-production-76ab.up.railway.app/

# Список instances (с API ключом)
curl https://evolution-api-production-76ab.up.railway.app/instance/fetchInstances \
  -H "apikey: your-secret-key"
```

---

## Важные уроки

1. **Auth middleware** уже применён в `index.ts` - роуты НЕ должны импортировать его повторно
2. **Railway кеширует репозиторий** - при проблемах удалить и пересоздать сервис
3. **dockerfilePath** для backend в `server/railway.toml`, НЕ в корне
4. **railway.toml в корне** применяется ко ВСЕМ сервисам — удалить если мешает frontend
5. **Railway frontend** - редеплой через API или push в main
6. **GitHub credentials** хранятся в `credentinals.txt` (НЕ коммитить!)
7. **Wallet top-up** использует QR-код, не Kaspi API - если видишь ошибку про KASPI_MERCHANT_ID, frontend устарел
8. **AI использует Gemini**, не OpenAI - если ошибка про OpenAI API key, проверь GEMINI_API_KEY
9. **Два деплоя при push** - нормально, оба сервиса подключены к одному репо
10. **WhatsApp использует Evolution API**, не WAHA - если ошибка про WAHA_URL, обнови на EVOLUTION_API_URL
11. **Evolution API multi-session** — каждый пользователь получает свой instance, не 'default'
12. **Формат телефона в Evolution** — только цифры без @c.us (77001234567, не 77001234567@c.us)
13. **Evolution API на Railway** — требует Docker image `atendai/evolution-api:latest`
14. **Дублирующиеся домены** — при создании нового домена старый не удаляется автоматически
15. **Evolution API DATABASE_PROVIDER** — обязательно указать `DATABASE_PROVIDER=postgresql` и `DATABASE_CONNECTION_URI`
16. **Evolution API Redis** — по умолчанию требует Redis, но можно отключить: `CACHE_REDIS_ENABLED=false`, `CACHE_LOCAL_ENABLED=true`
17. **Удаление Railway домена** — `mutation { serviceDomainDelete(id: "DOMAIN_ID") }` через GraphQL API
18. **Backend ↔ Messenger-service** — backend требует `MESSENGER_SERVICE_URL` и `MESSENGER_API_KEY` для связи с messenger-service
19. **Evolution API статусы** — Evolution возвращает `open/close/qrcode/not_found`, frontend ожидает WAHA-совместимые. Маппинг в `whatsapp.service.ts`: `open→WORKING`, `close→STOPPED`, `qrcode→SCAN_QR_CODE`, `not_found→NO_SESSION`
20. **Генерация изображений** — использует `gemini-2.0-flash-exp-image-generation`, файл `openai.service.ts` (название осталось от OpenAI, но внутри Gemini)
21. **Рекламные платформы** — доступны только Instagram, Facebook, Google Ads, TikTok, YouTube (VK и Telegram Ads удалены)
22. **Порты для локальной разработки**:
    - Backend: 3001
    - Frontend (Vite): 5173
    - Messenger-service: 3002
    - Evolution API: 8080
    - Redis: 6379
23. **BACKEND_URL на Railway** — обязательно установить для корректных URL изображений (иначе будет localhost)
24. **Генерация изображений base64** — storage.service.ts умеет обрабатывать data: URL (не только http/https)
25. **Evolution API сессии теряются** — если `DATABASE_ENABLED=false`, сессии пропадают при редеплое. Обязательные переменные для персистентности:
    - `DATABASE_ENABLED=true`
    - `DATABASE_PROVIDER=postgresql`
    - `DATABASE_CONNECTION_URI=...`
    - `DATABASE_SAVE_DATA_INSTANCE=true`
26. **Чаты WhatsApp не загружаются** — если телефон показывает "подключено", но чаты пустые, проверь Evolution API `/instance/fetchInstances`. Если массив пуст `[]`, нужно пересканировать QR код
27. **Бюджет кампаний списывается с кошелька** — при создании кампании бюджет резервируется с кошелька пользователя (тип транзакции `campaign_budget`). Кампанию нельзя создать если баланс меньше бюджета. Период бюджета: 7/30/custom дней
