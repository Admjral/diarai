import winston from 'winston';
import * as Sentry from '@sentry/node';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Request, Response, NextFunction } from 'express';

// Создаем директорию для логов, если её нет (только если не на Vercel)
// На Vercel (serverless) нельзя создавать директории, поэтому пропускаем
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const logsDir = isVercel ? null : join(process.cwd(), 'logs');

if (!isVercel && logsDir && !existsSync(logsDir)) {
  try {
    mkdirSync(logsDir, { recursive: true });
  } catch (error) {
    // Игнорируем ошибки создания директории (например, на Vercel)
    console.warn('Не удалось создать директорию для логов:', error);
  }
}

// Инициализация Sentry (если DSN настроен)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% в продакшене, 100% в разработке
  });
}

// Формат для логов
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Формат для консоли (читаемый)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  })
);

// Создание логгера
const transports: winston.transport[] = [];

// На Vercel не используем файловые транспорты (нельзя создавать файлы)
if (!isVercel && logsDir) {
  transports.push(
    // Запись ошибок в файл
    new winston.transports.File({
      filename: join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Запись всех логов в файл
    new winston.transports.File({
      filename: join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  defaultMeta: { service: 'diarai-server' },
  transports,
  // Обработка необработанных исключений (только если не на Vercel)
  exceptionHandlers: isVercel || !logsDir ? [] : [
    new winston.transports.File({ filename: join(logsDir, 'exceptions.log') }),
  ],
  // Обработка необработанных промисов (только если не на Vercel)
  rejectionHandlers: isVercel || !logsDir ? [] : [
    new winston.transports.File({ filename: join(logsDir, 'rejections.log') }),
  ],
});

// В development добавляем консольный вывод
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
} else {
  // В production тоже выводим в консоль, но в JSON формате
  logger.add(
    new winston.transports.Console({
      format: logFormat,
    })
  );
}

/**
 * Обертка для логирования с отправкой в Sentry
 */
export const log = {
  error: (message: string, error?: Error | any, context?: Record<string, any>) => {
    const meta = {
      ...context,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
          code: (error as any).code,
        },
      }),
    };

    logger.error(message, meta);

    // Отправляем в Sentry
    if (process.env.SENTRY_DSN && error) {
      Sentry.captureException(error, {
        level: 'error',
        tags: context,
        extra: meta,
      });
    } else if (process.env.SENTRY_DSN) {
      Sentry.captureMessage(message, {
        level: 'error',
        tags: context,
        extra: meta,
      });
    }
  },

  warn: (message: string, context?: Record<string, any>) => {
    logger.warn(message, context);
    if (process.env.SENTRY_DSN) {
      Sentry.captureMessage(message, {
        level: 'warning',
        tags: context,
      });
    }
  },

  info: (message: string, context?: Record<string, any>) => {
    logger.info(message, context);
  },

  debug: (message: string, context?: Record<string, any>) => {
    logger.debug(message, context);
  },

  http: (message: string, context?: Record<string, any>) => {
    logger.http(message, context);
  },
};

/**
 * Middleware для логирования HTTP запросов
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Логируем запрос
  log.http(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.userId,
  });

  // Логируем ответ
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    
    log[level](`${req.method} ${req.path} ${res.statusCode}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.userId,
    });
  });

  next();
};

/**
 * Экспорт Sentry для использования в других местах
 */
export { Sentry };

/**
 * Экспорт winston logger для прямого доступа (если нужно)
 */
export { logger };
