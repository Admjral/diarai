import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { log } from '../utils/logger.js';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      serviceAuth?: {
        serviceName: string;
        userId?: number;
      };
    }
  }
}

/**
 * Middleware для аутентификации между сервисами
 * Проверяет API ключ от DIAR backend
 */
export function serviceAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedKey = process.env.DIAR_API_KEY;

  log.debug('Auth middleware', {
    path: req.path,
    method: req.method,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length,
    hasExpectedKey: !!expectedKey,
    keysMatch: apiKey === expectedKey,
  });

  if (!expectedKey) {
    log.warn('DIAR_API_KEY not configured');
    res.status(500).json({ error: 'Service not configured' });
    return;
  }

  if (!apiKey) {
    log.warn('Missing API key in request', { path: req.path });
    res.status(401).json({ error: 'API key required' });
    return;
  }

  if (apiKey !== expectedKey) {
    log.warn('Invalid API key', { path: req.path, receivedLength: apiKey?.length });
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  // Извлекаем userId из заголовков если есть
  const userId = req.headers['x-user-id'] as string;

  req.serviceAuth = {
    serviceName: 'diar-backend',
    userId: userId ? parseInt(userId, 10) : undefined,
  };

  next();
}

/**
 * Middleware для проверки webhook подписей
 * Использует HMAC-SHA256 для верификации
 */
export function webhookSignatureMiddleware(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.headers['x-webhook-signature'] as string;

    // В development режиме логируем предупреждение но пропускаем
    if (process.env.NODE_ENV === 'development' && !signature) {
      log.debug('Webhook signature check skipped in development');
      next();
      return;
    }

    // В production требуем подпись
    if (!signature && process.env.NODE_ENV === 'production') {
      log.warn('Missing webhook signature in production');
      res.status(401).json({ error: 'Signature required' });
      return;
    }

    // Если подпись предоставлена - всегда проверяем
    if (signature) {
      try {
        // Вычисляем ожидаемую подпись
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');

        // Используем timing-safe сравнение для защиты от timing attacks
        const signatureBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);

        if (signatureBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
          log.warn('Invalid webhook signature', { path: req.path });
          res.status(403).json({ error: 'Invalid signature' });
          return;
        }

        log.debug('Webhook signature verified successfully');
      } catch (error) {
        log.error('Signature verification error', error);
        res.status(500).json({ error: 'Signature verification failed' });
        return;
      }
    }

    next();
  };
}
