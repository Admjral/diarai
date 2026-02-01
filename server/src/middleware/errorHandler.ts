import { Request, Response, NextFunction } from 'express';
import { log, Sentry } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Логируем ошибку через структурированный логгер
  log.error('Ошибка в обработчике запроса', err, {
    url: req.url,
    method: req.method,
    userId: req.user?.userId,
    userEmail: req.user?.email,
    headers: req.headers,
  });

  // Проверяем, не был ли ответ уже отправлен
  if (res.headersSent) {
    return next(err);
  }

  // Всегда передаем детали ошибки
  const errorDetails: any = {
    message: String(err.message || 'Неизвестная ошибка'),
    name: String(err.name || 'Error'),
    code: String((err as any).code || 'UNKNOWN'),
  };

  // Проверяем, связана ли ошибка с отсутствием модели Wallet
  if (err.message?.includes('wallet') || 
      err.message?.includes('Wallet') ||
      err.message?.includes('is not a function') ||
      err.message?.includes('Unknown model') ||
      err.message?.includes('prisma.wallet')) {
    errorDetails.code = 'PRISMA_MODEL_NOT_FOUND';
    errorDetails.solution = 'Выполните: cd server && npm run prisma:generate';
    errorDetails.steps = [
      '1. Откройте терминал',
      '2. Перейдите в папку server: cd server',
      '3. Запустите: npm run prisma:generate',
      '4. Перезапустите сервер: npm run dev'
    ];
  }

  // Добавляем дополнительную информацию в режиме разработки
  if (process.env.NODE_ENV === 'development') {
    if ((err as any).stack) {
      errorDetails.stack = String((err as any).stack).split('\n').slice(0, 10).join('\n');
    }
    if ((err as any).meta) {
      errorDetails.meta = (err as any).meta;
    }
  }

  // Отправляем в Sentry с контекстом запроса
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag('url', req.url);
      scope.setTag('method', req.method);
      scope.setUser({
        id: req.user?.userId,
        email: req.user?.email,
      });
      scope.setContext('request', {
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: req.body,
      });
      scope.setContext('error', errorDetails);
      Sentry.captureException(err);
    });
  }

  res.status(500).json({
    error: err.message || 'Внутренняя ошибка сервера',
    message: err.message,
    details: errorDetails,
  });
}

