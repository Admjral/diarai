#!/usr/bin/env node

/**
 * Интерактивный скрипт для настройки локального .env файла
 * Использование: node scripts/setup-local-env.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function questionSecret(query) {
  return new Promise(resolve => {
    // Скрываем ввод для секретных значений
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    
    let input = '';
    process.stdout.write(query);
    
    stdin.on('data', (char) => {
      char = char.toString();
      
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write('\n');
          resolve(input);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007f': // backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          input += char;
          process.stdout.write('*');
          break;
      }
    });
  });
}

async function main() {
  console.log('🚀 Настройка локального .env файла');
  console.log('==================================\n');
  
  const envPath = path.join(__dirname, '..', '.env');
  const templatePath = path.join(__dirname, '..', 'env.template');
  
  // Проверяем существование .env
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    console.log('📄 Найден существующий .env файл\n');
    const overwrite = await question('Перезаписать существующий файл? (y/n, по умолчанию n): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('✅ Оставляем существующий файл без изменений');
      rl.close();
      return;
    }
  } else {
    // Создаем из template
    if (fs.existsSync(templatePath)) {
      envContent = fs.readFileSync(templatePath, 'utf8');
      console.log('📄 Создаем .env из template\n');
    } else {
      console.log('❌ Файл env.template не найден!');
      rl.close();
      process.exit(1);
    }
  }
  
  console.log('\n📋 Настройка обязательных переменных:\n');
  
  // Обязательные переменные
  const requiredVars = {
    'DATABASE_URL': {
      prompt: 'DATABASE_URL (postgresql://postgres:ПАРОЛЬ@db.XXXXX.supabase.co:5432/postgres):\n  💡 Получите из: Supabase Dashboard → Settings → Database → Connection string → URI\n  Введите значение: ',
      secret: false,
      hint: 'postgresql://postgres:ВАШ_ПАРОЛЬ@db.YOUR_PROJECT_REF.supabase.co:5432/postgres'
    },
    'SUPABASE_URL': {
      prompt: 'SUPABASE_URL (https://XXXXX.supabase.co):\n  💡 Получите из: Supabase Dashboard → Settings → API → Project URL\n  Введите значение: ',
      secret: false,
      hint: 'https://YOUR_PROJECT_REF.supabase.co'
    },
    'SUPABASE_SERVICE_ROLE_KEY': {
      prompt: 'SUPABASE_SERVICE_ROLE_KEY (eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...):\n  💡 Получите из: Supabase Dashboard → Settings → API → service_role key\n  ⚠️  Секретное значение (ввод будет скрыт)\n  Введите значение: ',
      secret: true,
      hint: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    },
    'NODE_ENV': {
      prompt: 'NODE_ENV (development/production, по умолчанию development): ',
      secret: false,
      default: 'development'
    }
  };
  
  const values = {};
  
  for (const [varName, config] of Object.entries(requiredVars)) {
    let value = '';
    
    // Проверяем, есть ли уже значение в .env
    const regex = new RegExp(`^${varName}=(.+)$`, 'm');
    const match = envContent.match(regex);
    
    if (match && !match[1].includes('YOUR_') && !match[1].includes('ВАШ_')) {
      const existing = match[1].trim();
      const useExisting = await question(`\n${varName} уже установлен. Использовать существующее значение? (y/n, по умолчанию y): `);
      if (useExisting.toLowerCase() !== 'n') {
        values[varName] = existing;
        console.log(`✅ Используем существующее значение для ${varName}\n`);
        continue;
      }
    }
    
    if (config.secret) {
      value = await questionSecret(config.prompt);
    } else {
      value = await question(config.prompt);
    }
    
    if (!value.trim() && config.default) {
      value = config.default;
      console.log(`✅ Используем значение по умолчанию: ${value}\n`);
    } else if (!value.trim()) {
      console.log(`⚠️  Пропущено (можно настроить позже)\n`);
      values[varName] = '';
    } else {
      values[varName] = value.trim();
      console.log(`✅ ${varName} установлен\n`);
    }
  }
  
  // Обновляем .env файл
  let updatedContent = envContent;
  
  for (const [varName, value] of Object.entries(values)) {
    const regex = new RegExp(`^${varName}=.*$`, 'm');
    if (value) {
      if (regex.test(updatedContent)) {
        updatedContent = updatedContent.replace(regex, `${varName}=${value}`);
      } else {
        // Добавляем в конец, если переменной нет
        updatedContent += `\n${varName}=${value}`;
      }
    }
  }
  
  // Сохраняем файл
  fs.writeFileSync(envPath, updatedContent, 'utf8');
  
  console.log('\n✅ .env файл обновлен!');
  console.log('\n📋 Следующие шаги:');
  console.log('  1. Проверьте переменные: npm run check-env');
  console.log('  2. Настройте опциональные переменные в server/.env при необходимости');
  console.log('  3. Для продакшена: npm run setup-vercel-env\n');
  
  rl.close();
}

main().catch(err => {
  console.error('❌ Ошибка:', err);
  rl.close();
  process.exit(1);
});

