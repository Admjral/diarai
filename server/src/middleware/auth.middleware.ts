import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { log } from '../utils/logger';

// Функция для получения JWT_SECRET (вызывается после загрузки .env)
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
  }
  return secret;
}

// Расширяем тип Request для добавления user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
        role: string;
      };
    }
  }
}

interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Middleware для аутентификации через JWT токены
 *
 * Проверяет JWT токен из заголовка Authorization: Bearer <token>
 * и валидирует его через jsonwebtoken
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Получаем токен из заголовка Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      log.debug('Токен не предоставлен', {
        hasHeader: !!authHeader,
        headerFormat: authHeader ? 'неверный формат' : 'отсутствует',
      });
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    // Верификация токена
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;

    log.debug('Пользователь аутентифицирован', {
      userId: decoded.userId,
      userEmail: decoded.email,
    });

    // Добавляем user в request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error: any) {
    log.warn('Ошибка проверки токена', {
      errorMessage: error?.message,
      errorName: error?.name,
    });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истек. Пожалуйста, войдите заново.' });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Недействительный токен. Пожалуйста, войдите заново.' });
    }

    res.status(401).json({ error: 'Ошибка аутентификации' });
  }
}

/**
 * ВНИМАНИЕ: Dev middleware ТОЛЬКО для локальной разработки!
 * Никогда не используйте в production - это обходит всю аутентификацию.
 *
 * Условия использования:
 * 1. USE_DEV_AUTH=true в .env
 * 2. NODE_ENV=development
 * 3. Не на Vercel (нет VERCEL env var)
 */
export function devAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // КРИТИЧНО: Проверяем ВСЕ условия для безопасности
  const isDevEnvironment = process.env.NODE_ENV === 'development';
  const isNotVercel = !process.env.VERCEL;
  const isDevAuthEnabled = process.env.USE_DEV_AUTH === 'true';

  // Если хотя бы одно условие не выполнено - используем production auth
  if (!isDevEnvironment || !isNotVercel || !isDevAuthEnabled) {
    log.warn('devAuthMiddleware вызван в неподходящей среде, переключаюсь на authMiddleware', {
      isDevEnvironment,
      isNotVercel,
      isDevAuthEnabled,
    });
    return authMiddleware(req, res, next);
  }

  // В режиме разработки используем заголовки для идентификации пользователя
  const userId = parseInt(req.headers['x-user-id'] as string) || 1;
  const userEmail = req.headers['x-user-email'] as string || 'dev@example.com';

  log.debug('devAuthMiddleware используется (только локальная разработка)', {
    userId,
    userEmail,
  });

  req.user = {
    userId: userId,
    email: userEmail,
    role: 'user',
  };

  next();
}
