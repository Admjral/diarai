# DIAR AI - Инструкции для разработки

---

## Railway Service IDs

| Сервис | ID |
|--------|-----|
| backend | `46fb55af-941c-420c-9bdf-d0936055fdec` |
| frontend | `b120264f-9a6e-4aa7-855c-d25872303a5b` |
| messenger-service | `1d44198e-c2d3-450a-a13e-a893c7693367` |
| Postgres | `34c220c0-693c-4900-8dd9-a5789c5e888c` |
| environment | `e0ac84af-4a63-44db-8d83-7e4c2140f6ed` |
| project | `9359e0b8-249a-4fbd-93c0-d67a6139f954` |

## URLs

| Сервис | URL |
|--------|-----|
| Backend | `https://backend-production-be6a0.up.railway.app` |
| Frontend | `https://app.diar.pro` |

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
