import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'messenger-service' },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
    }),
  ],
});

// Wrapper для удобства
export const log = {
  error: (message: string, error?: Error | unknown, context?: Record<string, unknown>) => {
    const meta = {
      ...context,
      ...(error instanceof Error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      }),
    };
    logger.error(message, meta);
  },

  warn: (message: string, context?: Record<string, unknown>) => {
    logger.warn(message, context);
  },

  info: (message: string, context?: Record<string, unknown>) => {
    logger.info(message, context);
  },

  debug: (message: string, context?: Record<string, unknown>) => {
    logger.debug(message, context);
  },

  http: (message: string, context?: Record<string, unknown>) => {
    logger.http(message, context);
  },
};
