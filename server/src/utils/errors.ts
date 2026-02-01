/**
 * Кастомные классы ошибок для приложения
 * Позволяют типизированно обрабатывать различные виды ошибок
 */

/**
 * Базовый класс для ошибок приложения
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Ошибка недостаточного баланса
 */
export class InsufficientFundsError extends AppError {
  public balance: number;
  public currency: string;
  public requiredAmount: number;

  constructor(balance: number, currency: string, requiredAmount: number) {
    super(
      `Недостаточно средств. Баланс: ${balance} ${currency}, требуется: ${requiredAmount} ${currency}`,
      400
    );
    this.name = 'InsufficientFundsError';
    this.balance = balance;
    this.currency = currency;
    this.requiredAmount = requiredAmount;
  }
}

/**
 * Ошибка неавторизованного доступа
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Ошибка доступа запрещен
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * Ошибка ресурс не найден
 */
export class NotFoundError extends AppError {
  public resourceType: string;
  public resourceId?: string | number;

  constructor(resourceType: string, resourceId?: string | number) {
    const message = resourceId
      ? `${resourceType} с ID ${resourceId} не найден`
      : `${resourceType} не найден`;
    super(message, 404);
    this.name = 'NotFoundError';
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * Ошибка валидации данных
 */
export class ValidationError extends AppError {
  public field?: string;
  public details?: Record<string, string>;

  constructor(message: string, field?: string, details?: Record<string, string>) {
    super(message, 400);
    this.name = 'ValidationError';
    this.field = field;
    this.details = details;
  }
}

/**
 * Ошибка конфликта (например, дублирование данных)
 */
export class ConflictError extends AppError {
  public conflictField?: string;

  constructor(message: string, conflictField?: string) {
    super(message, 409);
    this.name = 'ConflictError';
    this.conflictField = conflictField;
  }
}

/**
 * Ошибка внешнего сервиса (API, база данных и т.д.)
 */
export class ExternalServiceError extends AppError {
  public serviceName: string;
  public originalError?: Error;

  constructor(serviceName: string, message: string, originalError?: Error) {
    super(`Ошибка сервиса ${serviceName}: ${message}`, 503);
    this.name = 'ExternalServiceError';
    this.serviceName = serviceName;
    this.originalError = originalError;
  }
}

/**
 * Ошибка rate limiting
 */
export class RateLimitError extends AppError {
  public retryAfter?: number;

  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Проверка является ли ошибка операционной (ожидаемой)
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}
