#!/usr/bin/env node

/**
 * Скрипт для проверки готовности системы к работе
 * Проверяет переменные окружения, подключение к БД, и готовность к деплою
 * Использование: node scripts/verify-setup.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 Проверка готовности системы...\n');
console.log('='.repeat(50));

let allChecksPassed = true;

// 1. Проверка переменных окружения
console.log('\n📋 1. Проверка переменных окружения');
console.log('-'.repeat(50));

const requiredVars = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NODE_ENV'];
const missingVars = [];

requiredVars.forEach((varName) => {
  const value = process.env[varName];
  if (!value || value.trim() === '' || value.includes('YOUR_') || value.includes('ВАШ_')) {
    missingVars.push(varName);
    allChecksPassed = false;
    console.log(`❌ ${varName}: отсутствует или не настроена`);
  } else {
    const displayValue = varName.includes('KEY') || varName.includes('PASSWORD') || varName.includes('SECRET')
      ? `${value.substring(0, 15)}...`
      : value;
    console.log(`✅ ${varName}: ${displayValue}`);
  }
});

if (missingVars.length > 0) {
  console.log(`\n⚠️  Отсутствуют переменные: ${missingVars.join(', ')}`);
  console.log('💡 Запустите: npm run setup-local-env');
}

// 2. Проверка подключения к базе данных
console.log('\n📋 2. Проверка подключения к базе данных');
console.log('-'.repeat(50));

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('YOUR_') && !process.env.DATABASE_URL.includes('ВАШ_')) {
  try {
    const prisma = new PrismaClient();
    // Простой запрос для проверки подключения
    prisma.$connect()
      .then(() => {
        console.log('✅ Подключение к базе данных успешно');
        return prisma.$disconnect();
      })
      .then(() => {
        checkSupabase();
      })
      .catch((error) => {
        console.log('❌ Ошибка подключения к базе данных:');
        console.log(`   ${error.message}`);
        allChecksPassed = false;
        checkSupabase();
      });
  } catch (error) {
    console.log('❌ Не удалось создать Prisma клиент:');
    console.log(`   ${error.message}`);
    allChecksPassed = false;
    checkSupabase();
  }
} else {
  console.log('⚠️  DATABASE_URL не настроен, пропускаем проверку БД');
  checkSupabase();
}

// 3. Проверка Supabase
function checkSupabase() {
  console.log('\n📋 3. Проверка Supabase');
  console.log('-'.repeat(50));

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_URL.includes('YOUR_') && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('YOUR_')) {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      console.log('✅ Supabase клиент создан успешно');
      console.log(`   URL: ${process.env.SUPABASE_URL}`);
    } catch (error) {
      console.log('❌ Ошибка создания Supabase клиента:');
      console.log(`   ${error.message}`);
      allChecksPassed = false;
    }
  } else {
    console.log('⚠️  Supabase credentials не настроены, пропускаем проверку');
  }

  checkVercel();
}

// 4. Проверка Vercel CLI
function checkVercel() {
  console.log('\n📋 4. Проверка Vercel CLI');
  console.log('-'.repeat(50));

  const { execSync } = require('child_process');
  
  try {
    const version = execSync('vercel --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
    console.log(`✅ Vercel CLI установлен: ${version}`);
    
    try {
      const whoami = execSync('vercel whoami', { encoding: 'utf8', stdio: 'pipe' }).trim();
      console.log(`✅ Авторизован в Vercel как: ${whoami}`);
    } catch (error) {
      console.log('⚠️  Не авторизован в Vercel');
      console.log('💡 Выполните: vercel login');
    }
  } catch (error) {
    console.log('⚠️  Vercel CLI не установлен');
    console.log('💡 Установите: npm i -g vercel');
  }

  finalSummary();
}

// 5. Итоговая сводка
function finalSummary() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 ИТОГОВАЯ СВОДКА');
  console.log('='.repeat(50));

  if (allChecksPassed && missingVars.length === 0) {
    console.log('\n✅ Все проверки пройдены! Система готова к работе.\n');
    
    if (process.env.NODE_ENV === 'production') {
      console.log('📋 Следующие шаги для продакшена:');
      console.log('  1. Настройте переменные на Vercel: npm run setup-vercel-env');
      console.log('  2. Перезапустите деплой: vercel --prod');
      console.log('  3. Проверьте работу: curl https://server-wgba.vercel.app/health\n');
    } else {
      console.log('📋 Следующие шаги:');
      console.log('  1. Запустите сервер: npm run dev');
      console.log('  2. Проверьте работу: curl http://localhost:3001/health\n');
    }
    
    process.exit(0);
  } else {
    console.log('\n⚠️  Некоторые проверки не пройдены.\n');
    
    if (missingVars.length > 0) {
      console.log('🔧 Что нужно сделать:');
      console.log('  1. Настройте переменные окружения: npm run setup-local-env');
      console.log('  2. Проверьте настройку: npm run check-env\n');
    }
    
    process.exit(1);
  }
}

