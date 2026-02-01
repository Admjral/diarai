import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from '../src/middleware/errorHandler';
import { authMiddleware } from '../src/middleware/auth.middleware';

// Роуты
import leadsRoutes from '../src/routes/leads.routes';
import dealsRoutes from '../src/routes/deals.routes';
import tasksRoutes from '../src/routes/tasks.routes';
import crmRoutes from '../src/routes/crm.routes';
import dashboardRoutes from '../src/routes/dashboard.routes';
import campaignsRoutes from '../src/routes/campaigns.routes';
import userRoutes from '../src/routes/user.routes';
import aiRoutes from '../src/routes/ai.routes';
import walletRoutes from '../src/routes/wallet.routes';
import supportRoutes from '../src/routes/support.routes';
import adminRoutes from '../src/routes/admin.routes';
import paymentRoutes from '../src/routes/payment.routes';
import integrationsRoutes from '../src/routes/integrations.routes';
import exportRoutes from '../src/routes/export.routes';
import messengerRoutes from '../src/routes/messenger.routes';
import { createKaspiDepositOrder } from '../src/controllers/wallet.controller';
import { validateBody } from '../src/middleware/validation.middleware';
import { addFundsSchema } from '../src/validations/schemas';

dotenv.config();

const app = express();

// ВАЖНО: CORS должен быть ПЕРВЫМ middleware, даже до express.json()
// Это гарантирует, что CORS заголовки будут добавлены даже при ошибках

// CORS настройки - явно разрешаем фронтенд домен
// ВАЖНО: CORS должен быть настроен ПЕРВЫМ, до всех других middleware
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Разрешенные origins
    const allowedOrigins = [
      'https://diarai.vercel.app',
      'https://diarai2025.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173',
    ];
    
    // Разрешаем все vercel.app домены
    const vercelAppRegex = /^https:\/\/.*\.vercel\.app$/;
    
    // Если origin не указан (например, Postman, curl), разрешаем
    if (!origin) {
      return callback(null, true);
    }
    
    // Проверяем точное совпадение
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Проверяем vercel.app домены
    if (vercelAppRegex.test(origin)) {
      return callback(null, true);
    }
    
    // В development разрешаем все
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // В остальных случаях блокируем
    console.log('[CORS] Заблокирован origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-email'],
  exposedHeaders: ['Content-Type'],
  maxAge: 86400, // 24 часа
  optionsSuccessStatus: 200 // Для старых браузеров
};

// CORS middleware - должен быть ПЕРЕД всеми маршрутами
// Важно: применяем CORS до всех других middleware
app.use(cors(corsOptions));

// Обработка preflight запросов (OPTIONS)
app.options('*', cors(corsOptions));

// Добавляем CORS заголовки вручную для всех ответов (на случай, если cors middleware не сработает)
// Это гарантирует, что CORS заголовки будут даже при ошибках
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Проверяем и добавляем заголовки для разрешенных origins
  if (origin && (
    origin.includes('diarai.vercel.app') ||
    origin.includes('diarai2025.vercel.app') ||
    origin.includes('.vercel.app') ||
    origin.includes('localhost')
  )) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-user-email');
    res.header('Access-Control-Max-Age', '86400');
  }
  
  // Для OPTIONS запросов сразу отвечаем
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json());

// Логирование запросов - ДОЛЖНО БЫТЬ ПЕРВЫМ
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} ${req.url}`);
  
  // Специальное логирование для kaspi маршрутов
  if (req.path.includes('kaspi') || req.url.includes('kaspi')) {
    console.log('[api/index.ts] ⚠️⚠️⚠️ KASPI МАРШРУТ ОБНАРУЖЕН:', {
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
    });
  }
  next();
});

// Корневой маршрут для проверки работоспособности
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'DIAR AI Server API',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api/*'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// КАСПИ МАРШРУТЫ - РЕГИСТРИРУЕМ ПЕРВЫМИ!
// ============================================
// Простой тестовый маршрут для проверки
app.all('/api/wallet/kaspi/*', (req, res, next) => {
  console.log('[api/index.ts] ⚠️⚠️⚠️ KASPI МАРШРУТ ПЕРЕХВАЧЕН:', req.method, req.path, req.url);
  next();
});
const kaspiHandler = async (req: any, res: any, next: any) => {
  console.log('[api/index.ts] ⚠️ Kaspi handler вызван:', req.method, req.path, req.url);
  try {
    await createKaspiDepositOrder(req, res);
  } catch (error) {
    console.error('[api/index.ts] Ошибка в kaspi handler:', error);
    next(error);
  }
};

// Тестовый маршрут для проверки kaspi (без middleware)
app.post('/api/wallet/kaspi/test', (req, res) => {
  console.log('[api/index.ts] ✅ Тестовый маршрут kaspi/test вызван');
  res.json({ 
    success: true, 
    message: 'Тестовый маршрут kaspi работает',
    timestamp: new Date().toISOString(),
    path: req.path,
    url: req.url
  });
});

// Основные kaspi маршруты
app.post('/api/wallet/kaspi/create-order', 
  (req, res, next) => {
    console.log('[api/index.ts] 🔵 POST /api/wallet/kaspi/create-order - middleware 1');
    next();
  },
  authMiddleware,
  (req, res, next) => {
    console.log('[api/index.ts] 🔵 POST /api/wallet/kaspi/create-order - после auth');
    next();
  },
  validateBody(addFundsSchema),
  (req, res, next) => {
    console.log('[api/index.ts] 🔵 POST /api/wallet/kaspi/create-order - после validation');
    next();
  },
  kaspiHandler
);

app.post('/api/wallet/kaspi/createOrder', 
  authMiddleware, 
  validateBody(addFundsSchema), 
  kaspiHandler
);

app.post('/api/wallet/kaspi/create_order', 
  authMiddleware, 
  validateBody(addFundsSchema), 
  kaspiHandler
);
// ============================================

// API Routes
app.use('/api/leads', authMiddleware, leadsRoutes);
app.use('/api/deals', authMiddleware, dealsRoutes);
app.use('/api/tasks', authMiddleware, tasksRoutes);
app.use('/api/crm', authMiddleware, crmRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/campaigns', authMiddleware, campaignsRoutes);
app.use('/api/user', authMiddleware, userRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);

// Регистрация wallet routes с логированием (kaspi маршруты уже зарегистрированы выше)
// ВАЖНО: Этот роутер обрабатывает только НЕ-kaspi маршруты
app.use('/api/wallet', (req, res, next) => {
  // Пропускаем kaspi маршруты - они обрабатываются прямыми маршрутами выше
  if (req.path && (req.path.includes('kaspi') || req.path.startsWith('/kaspi'))) {
    console.log('[api/index.ts] ⚠️ Kaspi маршрут попал в wallet router - это не должно происходить!', req.path);
    // Не вызываем next() - это остановит обработку в этом middleware
    // Express должен был найти прямой маршрут выше
    return next('route'); // Пытаемся пропустить этот роутер
  }
  console.log('[api/index.ts] Wallet route accessed (не kaspi):', req.method, req.path, req.url);
  next();
}, authMiddleware, walletRoutes);
app.use('/api/support', authMiddleware, supportRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
// Payment routes - аутентификация внутри роутера (кроме webhook)
app.use('/api/payments', paymentRoutes);
// Интеграции роут
app.use('/api/integrations', (req, res, next) => {
  console.log('[api/index.ts] Integrations route accessed:', req.method, req.path, req.url);
  next();
}, authMiddleware, integrationsRoutes);

// Messenger routes - аутентификация внутри роутера (кроме webhook)
app.use('/api/messenger', messengerRoutes);

// Error handler - добавляем CORS заголовки даже при ошибках
app.use((err: any, req: any, res: any, next: any) => {
  // Добавляем CORS заголовки перед обработкой ошибки
  const origin = req.headers.origin;
  if (origin && (
    origin.includes('diarai.vercel.app') ||
    origin.includes('diarai2025.vercel.app') ||
    origin.includes('.vercel.app') ||
    origin.includes('localhost')
  )) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-user-email');
  }
  
  // Передаем ошибку в errorHandler
  errorHandler(err, req, res, next);
});

// 404 handler - добавляем CORS заголовки
app.use((req, res) => {
  // Добавляем CORS заголовки
  const origin = req.headers.origin;
  if (origin && (
    origin.includes('diarai.vercel.app') ||
    origin.includes('diarai2025.vercel.app') ||
    origin.includes('.vercel.app') ||
    origin.includes('localhost')
  )) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-user-email');
  }
  
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Обработка ошибок инициализации - добавляем CORS даже при критических ошибках
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Экспорт для Vercel serverless функции
// Обертка для добавления CORS заголовков даже при ошибках инициализации
export default async (req: any, res: any) => {
  // ВАЖНО: Добавляем CORS заголовки СРАЗУ, до любой обработки
  const origin = req.headers?.origin || req.headers?.Origin;
  const isAllowedOrigin = origin && (
    origin.includes('diarai.vercel.app') ||
    origin.includes('diarai2025.vercel.app') ||
    origin.includes('.vercel.app') ||
    origin.includes('localhost')
  );
  
  // Функция для добавления CORS заголовков
  const addCorsHeaders = () => {
    if (isAllowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-user-email');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
  };
  
  // Добавляем CORS заголовки сразу
  addCorsHeaders();
  
  // Для OPTIONS запросов сразу отвечаем с CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Обрабатываем запрос через Express app
  try {
    // Пробуем обработать через Express
    return new Promise((resolve, reject) => {
      // Добавляем обработчик для гарантированного добавления CORS при ошибках
      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        addCorsHeaders();
        return originalEnd.apply(this, args);
      };
      
      app(req, res, (err: any) => {
        if (err) {
          addCorsHeaders();
          if (!res.headersSent) {
            res.status(500).json({
              error: 'Internal Server Error',
              message: 'Сервер не может обработать запрос. Проверьте переменные окружения на Vercel.',
              details: process.env.NODE_ENV === 'development' ? err.message : undefined,
            });
          }
          resolve(undefined);
        } else {
          resolve(undefined);
        }
      });
    });
  } catch (error: any) {
    console.error('[FATAL] Error handling request:', error);
    // Даже при ошибке возвращаем ответ с CORS заголовками
    addCorsHeaders();
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Сервер не может обработать запрос. Проверьте переменные окружения на Vercel.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
};

