import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Общий rate limiter для всех API endpoints
 * 100 запросов в минуту на IP адрес
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 100, // 100 запросов в минуту
  message: {
    error: 'Слишком много запросов с этого IP, пожалуйста, попробуйте позже.',
  },
  standardHeaders: true, // Возвращает информацию о лимите в заголовках `RateLimit-*`
  legacyHeaders: false, // Отключает заголовки `X-RateLimit-*`
  // Пропускаем health check и внутренние service-to-service запросы
  skip: (req: Request) =>
    req.path === '/health' ||
    req.path.startsWith('/api/messenger/session/') ||
    req.path === '/api/messenger/webhook',
});

/**
 * Строгий rate limiter для аутентификации
 * 5 запросов в минуту на IP адрес
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 5, // 5 запросов в минуту
  message: {
    error: 'Слишком много попыток входа. Пожалуйста, попробуйте через минуту.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Сбрасываем счетчик при успешной аутентификации
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter для AI endpoints (более строгий, так как AI запросы ресурсоемкие)
 * 20 запросов в минуту на пользователя
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 20, // 20 запросов в минуту
  message: {
    error: 'Слишком много AI запросов. Пожалуйста, подождите немного.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Используем userId из request (после аутентификации)
  keyGenerator: (req: Request) => {
    // Если пользователь аутентифицирован, используем его ID
    if (req.user?.userId) {
      return `user:${req.user.userId}`;
    }
    // Иначе используем стандартный механизм (не возвращаем IP напрямую)
    return undefined as any; // Позволяем express-rate-limit использовать стандартный механизм
  },
});

/**
 * Rate limiter для создания данных (POST запросы)
 * 30 запросов в минуту на пользователя
 */
export const createLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 30, // 30 запросов в минуту
  message: {
    error: 'Слишком много запросов на создание. Пожалуйста, подождите немного.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    if (req.user?.userId) {
      return `user:${req.user.userId}`;
    }
    return undefined as any;
  },
  // Применяем только к POST запросам
  skip: (req: Request) => req.method !== 'POST',
});

/**
 * Rate limiter для webhook endpoints (Kaspi и другие)
 * 100 запросов в минуту на IP
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 100, // 100 запросов в минуту
  message: {
    error: 'Слишком много webhook запросов.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Вспомогательная функция для обработки ошибок rate limit
 */
export const rateLimitHandler = (req: Request, res: Response) => {
  res.status(429).json({
    error: 'Слишком много запросов',
    message: 'Пожалуйста, попробуйте позже.',
    retryAfter: Math.ceil((req as any).rateLimit?.resetTime ? (req as any).rateLimit.resetTime - Date.now() : 60000) / 1000,
  });
};

