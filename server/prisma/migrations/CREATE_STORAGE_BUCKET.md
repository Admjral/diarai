# Создание bucket для изображений кампаний в Supabase Storage

## Как применить миграцию

### Вариант 1: Через Supabase Dashboard (рекомендуется)

1. Откройте ваш проект на [app.supabase.com](https://app.supabase.com)
2. Перейдите в **SQL Editor**
3. Создайте новый запрос
4. Скопируйте содержимое файла `create_campaign_images_bucket.sql`
5. Вставьте в редактор
6. Нажмите **Run** или **Ctrl+Enter**

### Вариант 2: Через Supabase CLI

```bash
supabase db push
```

Или если используете прямые SQL команды:

```bash
psql $DATABASE_URL -f prisma/migrations/create_campaign_images_bucket.sql
```

## Проверка создания bucket

После выполнения миграции:

1. Откройте **Storage** в Supabase Dashboard
2. Должен появиться bucket с именем `campaign-images`
3. Проверьте настройки:
   - Public bucket: ✅ (включен)
   - File size limit: 5MB
   - Allowed MIME types: image/jpeg, image/jpg, image/png, image/webp, image/gif

## Использование в коде

### Загрузка изображения

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Загрузка изображения
const { data, error } = await supabase.storage
  .from('campaign-images')
  .upload(`${userId}/${campaignId}/${filename}`, file);

if (error) {
  console.error('Ошибка загрузки:', error);
} else {
  // Получить публичный URL
  const { data: { publicUrl } } = supabase.storage
    .from('campaign-images')
    .getPublicUrl(data.path);
  
  console.log('URL изображения:', publicUrl);
}
```

### Получение публичного URL

```typescript
const { data: { publicUrl } } = supabase.storage
  .from('campaign-images')
  .getPublicUrl(`${userId}/${campaignId}/${filename}`);
```

### Удаление изображения

```typescript
const { error } = await supabase.storage
  .from('campaign-images')
  .remove([`${userId}/${campaignId}/${filename}`]);
```

## Структура хранения

Рекомендуемая структура папок:
```
campaign-images/
  ├── {user_id}/
  │   ├── {campaign_id}/
  │   │   ├── image-1.jpg
  │   │   ├── image-2.png
  │   │   └── ...
```

Это позволяет:
- Изолировать файлы по пользователям
- Легко находить файлы по кампании
- Упростить управление правами доступа

## Важные замечания

1. **Размер файлов**: Максимальный размер файла - 5MB. Для больших изображений используйте сжатие перед загрузкой.

2. **Форматы**: Поддерживаются только изображения (JPEG, PNG, WebP, GIF). Другие типы файлов будут отклонены.

3. **Публичный доступ**: Bucket настроен как публичный для чтения, что означает, что все изображения доступны по прямой ссылке. Если нужна приватность, измените `public: false` в миграции.

4. **Права доступа**: 
   - Чтение: публичное
   - Загрузка: только авторизованные пользователи
   - Удаление/Обновление: только владелец файла

5. **Очистка**: При удалении кампании рекомендуется также удалять связанные изображения из Storage.

