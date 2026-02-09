import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { UnauthorizedError, NotFoundError } from '../utils/errors';

// Расширяем тип Request для добавления userId
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

/**
 * Middleware для получения и валидации userId из данных пользователя
 * Использовать после authMiddleware
 *
 * После успешной проверки добавляет req.userId
 */
export async function requireUserId(req: Request, res: Response, next: NextFunction) {
  try {
    const phone = req.user?.phone;
    const userIdFromToken = req.user?.userId;

    // Если userId уже есть в токене, используем его напрямую
    if (userIdFromToken) {
      const user = await prisma.user.findUnique({
        where: { id: userIdFromToken },
        select: { id: true }
      });

      if (!user) {
        return res.status(401).json({ error: 'Пользователь не найден' });
      }

      req.userId = user.id;
      return next();
    }

    // Fallback: поиск по номеру телефона
    if (!phone) {
      return res.status(401).json({ error: 'Unauthorized - данные пользователя не предоставлены' });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    req.userId = user.id;
    next();
  } catch (error) {
    console.error('[requireUserId] Ошибка:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Хелпер для получения userId по телефону
 * Кэширует результат в памяти на короткое время
 */
const userIdCache = new Map<string, { userId: number; timestamp: number }>();
const CACHE_TTL_MS = 60000; // 1 минута

export async function getUserIdByPhone(phone: string): Promise<number> {
  // Проверяем кэш
  const cached = userIdCache.get(phone);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.userId;
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true }
  });

  if (!user) {
    throw new NotFoundError('User', phone);
  }

  // Сохраняем в кэш
  userIdCache.set(phone, { userId: user.id, timestamp: Date.now() });

  // Очищаем устаревшие записи кэша
  if (userIdCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of userIdCache.entries()) {
      if (now - value.timestamp > CACHE_TTL_MS) {
        userIdCache.delete(key);
      }
    }
  }

  return user.id;
}
