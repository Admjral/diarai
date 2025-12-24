# Деплой сервера на Vercel (отдельный проект)

## Важно!
Если фронтенд уже задеплоен на Vercel, сервер нужно деплоить как **отдельный проект**.

## Шаги для деплоя:

### 1. Перейдите в папку server

```bash
cd server
```

### 2. Инициализируйте новый проект Vercel

```bash
vercel
```

**Важно:** Когда Vercel спросит:
- **Link to existing project?** → **No** (создаем новый проект)
- **Project name?** → `diarai-server` (или любое другое имя)
- **Directory?** → `./` (текущая директория - server)

### 3. Добавьте переменные окружения

После первого деплоя добавьте переменные:

```bash
# Из папки server
vercel env add DATABASE_URL production
vercel env add OPENAI_API_KEY production  # опционально
```

Или через веб-интерфейс:
1. Откройте проект на [vercel.com](https://vercel.com)
2. Выберите проект `diarai-server`
3. Settings → Environment Variables
4. Добавьте:
   - `DATABASE_URL` = ваша строка подключения к Supabase
   - `OPENAI_API_KEY` = ваш ключ OpenAI (если нужен)

### 4. Задеплойте в продакшен

```bash
vercel --prod
```

## Альтернатива: Через GitHub

1. На [vercel.com](https://vercel.com) создайте **новый проект**
2. Подключите тот же репозиторий GitHub
3. В настройках проекта:
   - **Root Directory**: `server` ⚠️ ВАЖНО!
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: (оставьте пустым)
   - **Install Command**: `npm install`
4. Добавьте переменные окружения
5. Deploy

## Проверка

После деплоя получите URL сервера:

```bash
vercel ls
```

Или в Vercel Dashboard → ваш проект → Domain

Сервер будет доступен по адресу типа: `https://diarai-server.vercel.app`

## Обновление API URL во фронтенде

После деплоя сервера обновите `VITE_API_URL` в настройках фронтенда на Vercel:

1. Откройте проект фронтенда на Vercel
2. Settings → Environment Variables
3. Обновите `VITE_API_URL` на URL вашего сервера (например: `https://diarai-server.vercel.app`)

