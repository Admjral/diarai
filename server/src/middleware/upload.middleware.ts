import multer from 'multer';
import path from 'path';
import { Request } from 'express';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // 10MB default

// Разрешенные MIME типы для изображений
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

// Разрешенные MIME типы для документов
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

// Все разрешенные типы
const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];

/**
 * Multer storage - используем memory storage для обработки в коде
 */
const storage = multer.memoryStorage();

/**
 * Фильтр файлов - проверяет MIME тип
 */
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) => {
  // Определяем какой тип проверять на основе field name
  const allowedTypes = file.fieldname === 'image'
    ? ALLOWED_IMAGE_TYPES
    : ALL_ALLOWED_TYPES;

  if (allowedTypes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new Error(
      `Недопустимый тип файла: ${file.mimetype}. ` +
      `Разрешены: ${allowedTypes.join(', ')}`
    ));
  }
};

/**
 * Middleware для загрузки одного изображения
 */
export const uploadImage = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(
        `Недопустимый тип изображения: ${file.mimetype}. ` +
        `Разрешены: ${ALLOWED_IMAGE_TYPES.join(', ')}`
      ));
    }
  },
}).single('image');

/**
 * Middleware для загрузки нескольких изображений
 */
export const uploadImages = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(
        `Недопустимый тип изображения: ${file.mimetype}. ` +
        `Разрешены: ${ALLOWED_IMAGE_TYPES.join(', ')}`
      ));
    }
  },
}).array('images', 10);

/**
 * Middleware для загрузки документа
 */
export const uploadDocument = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(
        `Недопустимый тип документа: ${file.mimetype}. ` +
        `Разрешены: ${ALLOWED_DOCUMENT_TYPES.join(', ')}`
      ));
    }
  },
}).single('document');

/**
 * Middleware для загрузки любого файла (изображение или документ)
 */
export const uploadFile = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter,
}).single('file');

/**
 * Middleware для смешанной загрузки (изображение кампании + документы)
 */
export const uploadCampaignFiles = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },
  fileFilter,
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'documents', maxCount: 4 },
]);

/**
 * Обработчик ошибок multer
 */
export function handleMulterError(error: any): { status: number; message: string } {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return {
          status: 400,
          message: `Размер файла превышает максимальный лимит (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        };
      case 'LIMIT_FILE_COUNT':
        return {
          status: 400,
          message: 'Превышено максимальное количество файлов',
        };
      case 'LIMIT_UNEXPECTED_FILE':
        return {
          status: 400,
          message: `Неожиданное поле файла: ${error.field}`,
        };
      default:
        return {
          status: 400,
          message: `Ошибка загрузки файла: ${error.message}`,
        };
    }
  }

  return {
    status: 400,
    message: error.message || 'Ошибка загрузки файла',
  };
}
