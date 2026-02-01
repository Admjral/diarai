-- Добавление enum Role и поля role в таблицу users

-- Создаем enum Role
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('user', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Добавляем поле role в таблицу users, если его еще нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'user';
    END IF;
END $$;

