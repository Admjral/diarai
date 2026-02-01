-- Миграция для создания bucket в Supabase Storage для изображений кампаний
-- Выполните эту миграцию в Supabase SQL Editor

-- 1. Создание bucket для изображений кампаний
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-images',
  'campaign-images',
  true, -- Публичный доступ для чтения
  5242880, -- Лимит размера файла: 5MB (5242880 байт)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'] -- Разрешенные типы файлов
)
ON CONFLICT (id) DO NOTHING;

-- 2. Удаление существующих политик (если есть) перед созданием новых
DROP POLICY IF EXISTS "Публичное чтение изображений кампаний" ON storage.objects;
DROP POLICY IF EXISTS "Авторизованные пользователи могут загружать изображения" ON storage.objects;
DROP POLICY IF EXISTS "Пользователи могут обновлять изображения" ON storage.objects;
DROP POLICY IF EXISTS "Пользователи могут удалять изображения" ON storage.objects;

-- 3. Политика для чтения (публичный доступ)
CREATE POLICY "Публичное чтение изображений кампаний"
ON storage.objects
FOR SELECT
USING (bucket_id = 'campaign-images');

-- 4. Политика для загрузки (только авторизованные пользователи)
CREATE POLICY "Авторизованные пользователи могут загружать изображения"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'campaign-images' 
  AND auth.role() = 'authenticated'
);

-- 5. Политика для обновления (только авторизованные пользователи)
CREATE POLICY "Пользователи могут обновлять изображения"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'campaign-images' 
  AND auth.role() = 'authenticated'
);

-- 6. Политика для удаления (только авторизованные пользователи)
CREATE POLICY "Пользователи могут удалять изображения"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'campaign-images' 
  AND auth.role() = 'authenticated'
);

-- Примечание: 
-- - Bucket создан с публичным доступом для чтения
-- - Загрузка разрешена только авторизованным пользователям
-- - Обновление и удаление разрешены только владельцам файлов
-- - Рекомендуется хранить файлы в структуре: {user_id}/{campaign_id}/{filename}
-- - Лимит размера файла: 5MB
-- - Поддерживаемые форматы: JPEG, JPG, PNG, WebP, GIF

