import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { log } from '../utils/logger';

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // 10MB default

/**
 * Локальный сервис хранения файлов
 * Используется вместо Supabase Storage для полного контроля над данными
 */
class LocalStorageService {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = UPLOADS_DIR;
    this.ensureUploadsDir();
    log.info('LocalStorageService initialized', { uploadsDir: this.uploadsDir });
  }

  /**
   * Убедиться что директория uploads существует
   */
  private async ensureUploadsDir(): Promise<void> {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      log.error('Failed to create uploads directory', error);
    }
  }

  /**
   * Загрузить файл из Buffer
   */
  async uploadBuffer(
    buffer: Buffer,
    originalName: string,
    subfolder?: string
  ): Promise<{ url: string; filename: string; size: number }> {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }

    const ext = path.extname(originalName).toLowerCase() || '.bin';
    const filename = `${crypto.randomUUID()}${ext}`;

    // Определяем путь с учетом подпапки
    const targetDir = subfolder
      ? path.join(this.uploadsDir, subfolder)
      : this.uploadsDir;

    await fs.mkdir(targetDir, { recursive: true });

    const filepath = path.join(targetDir, filename);

    await fs.writeFile(filepath, buffer);

    const relativePath = subfolder
      ? `/uploads/${subfolder}/${filename}`
      : `/uploads/${filename}`;

    log.info('File uploaded', { filename, size: buffer.length, path: relativePath });

    return {
      url: relativePath,
      filename,
      size: buffer.length,
    };
  }

  /**
   * Загрузить файл из base64 строки
   */
  async uploadBase64(
    base64Data: string,
    originalName: string,
    subfolder?: string
  ): Promise<{ url: string; filename: string; size: number }> {
    // Удаляем data URL prefix если есть
    const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    return this.uploadBuffer(buffer, originalName, subfolder);
  }

  /**
   * Загрузить файл из URL (скачать и сохранить)
   */
  async uploadFromUrl(
    url: string,
    subfolder?: string
  ): Promise<{ url: string; filename: string; size: number }> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Пытаемся определить расширение из URL или content-type
    let ext = path.extname(new URL(url).pathname) || '';
    if (!ext) {
      const contentType = response.headers.get('content-type') || '';
      const extMap: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'application/pdf': '.pdf',
      };
      ext = extMap[contentType] || '.bin';
    }

    const originalName = `downloaded${ext}`;
    return this.uploadBuffer(buffer, originalName, subfolder);
  }

  /**
   * Удалить файл
   */
  async delete(fileUrl: string): Promise<void> {
    try {
      // Конвертируем URL в путь файла
      const relativePath = fileUrl.replace('/uploads/', '');
      const filepath = path.join(this.uploadsDir, relativePath);

      await fs.unlink(filepath);
      log.info('File deleted', { filepath });
    } catch (error) {
      log.error('Failed to delete file', error, { fileUrl });
      // Не выбрасываем ошибку - файл может не существовать
    }
  }

  /**
   * Проверить существует ли файл
   */
  async exists(fileUrl: string): Promise<boolean> {
    try {
      const relativePath = fileUrl.replace('/uploads/', '');
      const filepath = path.join(this.uploadsDir, relativePath);
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Получить полный URL файла (для frontend)
   */
  getPublicUrl(relativePath: string): string {
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;

    // Если уже полный URL, возвращаем как есть
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }

    // Если начинается с /uploads/, добавляем base URL
    if (relativePath.startsWith('/uploads/')) {
      return `${backendUrl}${relativePath}`;
    }

    // Иначе добавляем /uploads/
    return `${backendUrl}/uploads/${relativePath}`;
  }

  /**
   * Получить путь к директории uploads
   */
  getUploadsDir(): string {
    return this.uploadsDir;
  }
}

// Singleton
let storageService: LocalStorageService | null = null;

export function getStorageService(): LocalStorageService {
  if (!storageService) {
    storageService = new LocalStorageService();
  }
  return storageService;
}

export { LocalStorageService };
