#!/bin/bash

# Скрипт для настройки переменных окружения на Vercel
# Использование: ./scripts/setup-vercel-env.sh

set -e

echo "🚀 Настройка переменных окружения на Vercel"
echo "=========================================="
echo ""

# Проверка наличия Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI не установлен!"
    echo "Установите: npm i -g vercel"
    exit 1
fi

# Проверка авторизации
if ! vercel whoami &> /dev/null; then
    echo "❌ Вы не авторизованы в Vercel CLI"
    echo "Выполните: vercel login"
    exit 1
fi

echo "✅ Vercel CLI готов"
echo ""

# Обязательные переменные
REQUIRED_VARS=(
    "DATABASE_URL"
    "SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
    "NODE_ENV"
)

# Опциональные переменные
OPTIONAL_VARS=(
    "OPENAI_API_KEY"
    "SENTRY_DSN"
    "LOG_LEVEL"
    "FRONTEND_URL"
)

echo "📋 Обязательные переменные:"
for var in "${REQUIRED_VARS[@]}"; do
    echo "  - $var"
done
echo ""

# Функция для добавления переменной
add_env_var() {
    local var_name=$1
    local is_secret=$2
    
    echo ""
    echo "🔧 Настройка: $var_name"
    
    if [ "$is_secret" = "true" ]; then
        echo "⚠️  Это секретная переменная - значение будет скрыто при вводе"
        read -sp "Введите значение для $var_name: " value
        echo ""
    else
        read -p "Введите значение для $var_name: " value
    fi
    
    if [ -z "$value" ]; then
        echo "⚠️  Пропущено (пустое значение)"
        return
    fi
    
    # Добавляем для Production
    echo "Добавление для Production..."
    if vercel env add "$var_name" production <<< "$value" 2>/dev/null; then
        echo "✅ $var_name добавлена для Production"
    else
        echo "⚠️  Ошибка при добавлении $var_name (возможно, уже существует)"
        read -p "Обновить существующую переменную? (y/n): " update
        if [ "$update" = "y" ] || [ "$update" = "Y" ]; then
            vercel env rm "$var_name" production --yes 2>/dev/null || true
            vercel env add "$var_name" production <<< "$value"
            echo "✅ $var_name обновлена для Production"
        fi
    fi
    
    # Предлагаем добавить для Preview
    read -p "Добавить для Preview окружения? (y/n): " add_preview
    if [ "$add_preview" = "y" ] || [ "$add_preview" = "Y" ]; then
        if vercel env add "$var_name" preview <<< "$value" 2>/dev/null; then
            echo "✅ $var_name добавлена для Preview"
        else
            echo "⚠️  Переменная уже существует для Preview"
        fi
    fi
}

# Добавляем обязательные переменные
echo "Начнем с обязательных переменных:"
echo ""

for var in "${REQUIRED_VARS[@]}"; do
    case $var in
        "DATABASE_URL")
            echo "💡 DATABASE_URL: postgresql://postgres:ПАРОЛЬ@db.XXXXX.supabase.co:5432/postgres"
            echo "   Получите из: Supabase Dashboard → Settings → Database → Connection string → URI"
            ;;
        "SUPABASE_URL")
            echo "💡 SUPABASE_URL: https://XXXXX.supabase.co"
            echo "   Получите из: Supabase Dashboard → Settings → API → Project URL"
            ;;
        "SUPABASE_SERVICE_ROLE_KEY")
            echo "💡 SUPABASE_SERVICE_ROLE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            echo "   Получите из: Supabase Dashboard → Settings → API → service_role key"
            ;;
        "NODE_ENV")
            echo "💡 NODE_ENV: production"
            ;;
    esac
    
    if [ "$var" = "SUPABASE_SERVICE_ROLE_KEY" ] || [ "$var" = "DATABASE_URL" ]; then
        add_env_var "$var" "true"
    else
        add_env_var "$var" "false"
    fi
done

# Опциональные переменные
echo ""
echo "📋 Опциональные переменные (можно пропустить, нажав Enter):"
read -p "Добавить опциональные переменные? (y/n): " add_optional

if [ "$add_optional" = "y" ] || [ "$add_optional" = "Y" ]; then
    for var in "${OPTIONAL_VARS[@]}"; do
        case $var in
            "OPENAI_API_KEY")
                echo "💡 OPENAI_API_KEY: sk-..."
                echo "   Получите из: https://platform.openai.com/api-keys"
                ;;
            "SENTRY_DSN")
                echo "💡 SENTRY_DSN: https://xxxxx@xxxxx.ingest.sentry.io/xxxxx"
                echo "   Получите из: https://sentry.io → ваш проект → Settings → Client Keys"
                ;;
            "LOG_LEVEL")
                echo "💡 LOG_LEVEL: info (или debug, warn, error)"
                ;;
            "FRONTEND_URL")
                echo "💡 FRONTEND_URL: https://diarai.vercel.app"
                ;;
        esac
        
        read -p "Добавить $var? (y/n): " add_var
        if [ "$add_var" = "y" ] || [ "$add_var" = "Y" ]; then
            if [ "$var" = "OPENAI_API_KEY" ] || [ "$var" = "SENTRY_DSN" ]; then
                add_env_var "$var" "true"
            else
                add_env_var "$var" "false"
            fi
        fi
    done
fi

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "📋 Следующие шаги:"
echo "  1. Проверьте переменные: vercel env ls"
echo "  2. Перезапустите деплой: vercel --prod"
echo "  3. Проверьте работу: curl https://server-wgba.vercel.app/health"
echo ""

