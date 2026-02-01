// IMPORTANT: Load environment variables FIRST, before any other imports
// that might read from process.env
import dotenv from 'dotenv';
dotenv.config();

// Validate required environment variables at startup
function validateEnvVars() {
  const requiredVars = ['DATABASE_URL'];
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ FATAL: Missing required environment variables:', missing.join(', '));
    console.error('Please set these variables in your .env file or Railway environment.');
    process.exit(1);
  }

  // JWT_SECRET - обязательно для auth, но сервер может запуститься для health check
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️  WARNING: JWT_SECRET not set. Authentication will fail.');
    console.warn('Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  } else if (process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET should be at least 32 characters for security.');
  }

  console.log('✅ Environment variables validated');
  console.log('   DATABASE_URL: set (' + (process.env.DATABASE_URL?.substring(0, 20) || '') + '...)');
  console.log('   JWT_SECRET: ' + (process.env.JWT_SECRET ? `set (${process.env.JWT_SECRET.length} chars)` : 'NOT SET'));
  console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('   PORT:', process.env.PORT || '3001');
}

validateEnvVars();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware, devAuthMiddleware } from './middleware/auth.middleware';
import { generalLimiter, aiLimiter, createLimiter, webhookLimiter } from './middleware/rateLimit.middleware';
import { requestLogger, log, Sentry } from './utils/logger';
import { getGeminiStatus } from './services/openai.service';

// Роуты
import authRoutes from './routes/auth.routes';
import leadsRoutes from './routes/leads.routes';
import dealsRoutes from './routes/deals.routes';
import tasksRoutes from './routes/tasks.routes';
import crmRoutes from './routes/crm.routes';
import dashboardRoutes from './routes/dashboard.routes';
import campaignsRoutes from './routes/campaigns.routes';
import userRoutes from './routes/user.routes';
import aiRoutes from './routes/ai.routes';
import walletRoutes from './routes/wallet.routes';
import supportRoutes from './routes/support.routes';
import adminRoutes from './routes/admin.routes';
import paymentRoutes from './routes/payment.routes';
import integrationsRoutes from './routes/integrations.routes';
import notificationsRoutes from './routes/notifications.routes';
import exportRoutes from './routes/export.routes';
import messengerRoutes from './routes/messenger.routes';
import paymentRequestRoutes from './routes/payment-request.routes';
import { getSessionByWhatsAppId, getSessionByInstagramAccount, getSessionByTelegramBot } from './controllers/messenger.controller';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy для Railway (reverse proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
// Настройка CORS для безопасной работы в продакшене
const corsOptions = {
  origin: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' 
    ? false // В продакшене без FRONTEND_URL запрещаем все запросы
    : 'http://localhost:5173'), // В development разрешаем локальный фронтенд
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  console.warn('⚠️  FRONTEND_URL не установлен в production. CORS будет заблокирован.');
}

// Инициализация Sentry для Express (если DSN настроен)
// Sentry middleware будет применен через errorHandler

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Статические файлы (uploads) - для локального хранения изображений
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));
log.info('Static file serving enabled', { uploadsDir });

// Rate limiting - применяем общий лимит ко всем запросам
app.use(generalLimiter);

// Структурированное логирование запросов
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Выбор middleware аутентификации в зависимости от режима
// В production всегда используем authMiddleware (JWT токены)
// В development можно использовать devAuthMiddleware для упрощения (через USE_DEV_AUTH=true)
const useDevAuth = process.env.USE_DEV_AUTH === 'true' && process.env.NODE_ENV !== 'production';
const auth = useDevAuth ? devAuthMiddleware : authMiddleware;

if (useDevAuth) {
  log.warn('Используется devAuthMiddleware (режим разработки)', {
    note: 'Для продакшена установите USE_DEV_AUTH=false или NODE_ENV=production',
  });
} else {
  log.info('Используется authMiddleware (собственные JWT токены)');
}

// Auth routes (публичные - без middleware)
app.use('/api/auth', authRoutes);

// API Routes с rate limiting
// AI endpoints - более строгий лимит
app.use('/api/ai', auth, aiLimiter, aiRoutes);

// Endpoints для создания данных - лимит на создание
app.use('/api/leads', auth, createLimiter, leadsRoutes);
app.use('/api/deals', auth, createLimiter, dealsRoutes);
app.use('/api/tasks', auth, createLimiter, tasksRoutes);
app.use('/api/campaigns', auth, createLimiter, campaignsRoutes);

// Остальные endpoints с общим лимитом (уже применен глобально)
app.use('/api/crm', auth, crmRoutes);
app.use('/api/dashboard', auth, dashboardRoutes);
app.use('/api/user', auth, userRoutes);
app.use('/api/wallet', auth, walletRoutes);
app.use('/api/support', auth, supportRoutes);
app.use('/api/admin', auth, adminRoutes);
app.use('/api/integrations', auth, integrationsRoutes);
app.use('/api/notifications', auth, notificationsRoutes);
app.use('/api/export', auth, exportRoutes);
app.use('/api/payment-requests', auth, paymentRequestRoutes);
// Messenger webhook - без auth (проверка API key внутри)
app.post('/api/messenger/webhook', webhookLimiter, (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.MESSENGER_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
}, (req, res) => {
  // Импортируем handleWebhook динамически чтобы избежать циклических зависимостей
  import('./controllers/messenger.controller').then(({ handleWebhook }) => {
    handleWebhook(req, res);
  });
});

// Session lookup для messenger-service (без auth - проверка API key внутри контроллера)
app.get('/api/messenger/session/whatsapp/:sessionId', getSessionByWhatsAppId);
app.get('/api/messenger/session/instagram/:accountId', getSessionByInstagramAccount);
app.get('/api/messenger/session/telegram/:botId', getSessionByTelegramBot);

// Остальные messenger маршруты - с auth
app.use('/api/messenger', auth, messengerRoutes);

// Payments - webhook limiter для webhook endpoints
app.use('/api/payments', paymentRoutes);
// Webhook endpoints получат webhookLimiter в самих роутах

// Error handler (включает Sentry, если настроен)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

app.listen(PORT, () => {
  log.info('Сервер запущен', {
    port: PORT,
    apiUrl: `http://localhost:${PORT}`,
    nodeEnv: process.env.NODE_ENV || 'development',
  });

  log.info('Rate Limiting активен', {
    general: '100 запросов/минуту',
    ai: '20 запросов/минуту',
    create: '30 запросов/минуту',
    webhooks: '100 запросов/минуту',
  });

  if (process.env.SENTRY_DSN) {
    log.info('Sentry мониторинг активен', {
      environment: process.env.NODE_ENV || 'development',
    });
  } else {
    log.warn('Sentry не настроен', {
      note: 'Для мониторинга ошибок добавьте SENTRY_DSN в .env',
    });
  }
  
  // Проверка Gemini API
  const geminiStatus = getGeminiStatus();
  if (geminiStatus.available) {
    log.info('Gemini API настроен и готов к использованию');
  } else if (geminiStatus.configured) {
    log.warn('Gemini API ключ настроен, но недоступен');
  } else {
    log.info('Gemini API не настроен. Используется fallback режим.', {
      note: 'Для включения AI добавьте GEMINI_API_KEY в .env',
    });
  }
});
