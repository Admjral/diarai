#!/usr/bin/env node

/**
 * Скрипт для проверки наличия обязательных переменных окружения
 * Использование: node scripts/check-env.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const requiredVars = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NODE_ENV',
];

const optionalVars = [
  'OPENAI_API_KEY',
  'SENTRY_DSN',
  'LOG_LEVEL',
  'FRONTEND_URL',
  'KASPI_MERCHANT_ID',
  'KASPI_API_KEY',
  'KASPI_WEBHOOK_SECRET',
];

console.log('🔍 Проверка переменных окружения...\n');

let hasErrors = false;
const missing = [];
const present = [];
const optionalPresent = [];

// Проверка обязательных переменных
requiredVars.forEach((varName) => {
  const value = process.env[varName];
  if (!value || value.trim() === '' || value.includes('YOUR_') || value.includes('ВАШ_')) {
    missing.push(varName);
    hasErrors = true;
    console.log(`❌ ${varName}: отсутствует или не настроена`);
  } else {
    present.push(varName);
    // Скрываем значение для безопасности
    const displayValue = varName.includes('KEY') || varName.includes('PASSWORD') || varName.includes('SECRET')
      ? `${value.substring(0, 10)}...`
      : value;
    console.log(`✅ ${varName}: ${displayValue}`);
  }
});

// Проверка опциональных переменных
console.log('\n📋 Опциональные переменные:');
optionalVars.forEach((varName) => {
  const value = process.env[varName];
  if (value && !value.includes('YOUR_') && !value.includes('ВАШ_')) {
    optionalPresent.push(varName);
    const displayValue = varName.includes('KEY') || varName.includes('SECRET')
      ? `${value.substring(0, 10)}...`
      : value;
    console.log(`  ✅ ${varName}: ${displayValue}`);
  } else {
    console.log(`  ⚪ ${varName}: не настроена`);
  }
});

// Итоговый результат
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ ОШИБКА: Не все обязательные переменные настроены!\n');
  console.log('Отсутствующие переменные:');
  missing.forEach((varName) => {
    console.log(`  - ${varName}`);
  });
  console.log('\n💡 Инструкция:');
  console.log('  1. Откройте server/.env');
  console.log('  2. Заполните все обязательные переменные');
  console.log('  3. См. server/env.template для примеров\n');
  process.exit(1);
} else {
  console.log('✅ Все обязательные переменные настроены!\n');
  console.log(`Настроено обязательных: ${present.length}/${requiredVars.length}`);
  console.log(`Настроено опциональных: ${optionalPresent.length}/${optionalVars.length}\n`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️  ВАЖНО: Для продакшена на Vercel также нужно настроить переменные:');
    console.log('  vercel env add DATABASE_URL production');
    console.log('  vercel env add SUPABASE_URL production');
    console.log('  vercel env add SUPABASE_SERVICE_ROLE_KEY production');
    console.log('  vercel env add NODE_ENV production\n');
  }
  
  process.exit(0);
}

