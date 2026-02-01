import axios from 'axios';
import { log } from '../utils/logger.js';

interface SessionUserData {
  userId: number;
  aiEnabled: boolean;
  aiSystemPrompt?: string;
  escalationKeywords?: string[];
}

interface SessionCache {
  [sessionId: string]: {
    data: SessionUserData;
    expiresAt: number;
  };
}

/**
 * Сервис для получения данных пользователя по sessionId
 * Кэширует данные на 5 минут для уменьшения нагрузки на backend
 */
export class SessionService {
  private diarBackendUrl: string;
  private diarApiKey: string;
  private cache: SessionCache = {};
  private cacheTTL = 5 * 60 * 1000; // 5 минут

  constructor() {
    this.diarBackendUrl = process.env.DIAR_BACKEND_URL || 'http://localhost:3001';
    this.diarApiKey = process.env.DIAR_API_KEY || '';

    log.info('Session service initialized', { backendUrl: this.diarBackendUrl });
  }

  /**
   * Получить данные пользователя по sessionId WhatsApp
   */
  async getUserByWhatsAppSession(sessionId: string): Promise<SessionUserData | null> {
    // Проверяем кэш
    const cached = this.getFromCache(sessionId);
    if (cached) {
      log.debug('Session data from cache', { sessionId, userId: cached.userId });
      return cached;
    }

    try {
      const response = await axios.get(
        `${this.diarBackendUrl}/api/messenger/session/whatsapp/${encodeURIComponent(sessionId)}`,
        {
          headers: {
            'X-API-Key': this.diarApiKey,
          },
          timeout: 5000,
        }
      );

      if (response.data?.success && response.data?.data) {
        const data: SessionUserData = {
          userId: response.data.data.userId,
          aiEnabled: response.data.data.aiEnabled ?? true,
          aiSystemPrompt: response.data.data.aiSystemPrompt,
          escalationKeywords: response.data.data.escalationKeywords,
        };

        this.setCache(sessionId, data);
        log.info('Session data fetched from backend', { sessionId, userId: data.userId });
        return data;
      }

      log.warn('Session not found in backend', { sessionId });
      return null;
    } catch (error) {
      log.error('Failed to fetch session data from backend', error, { sessionId });
      return null;
    }
  }

  /**
   * Получить данные пользователя по Instagram account ID
   */
  async getUserByInstagramAccount(instagramAccountId: string): Promise<SessionUserData | null> {
    const cacheKey = `instagram:${instagramAccountId}`;

    // Проверяем кэш
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      log.debug('Instagram session data from cache', { instagramAccountId, userId: cached.userId });
      return cached;
    }

    try {
      const response = await axios.get(
        `${this.diarBackendUrl}/api/messenger/session/instagram/${encodeURIComponent(instagramAccountId)}`,
        {
          headers: {
            'X-API-Key': this.diarApiKey,
          },
          timeout: 5000,
        }
      );

      if (response.data?.success && response.data?.data) {
        const data: SessionUserData = {
          userId: response.data.data.userId,
          aiEnabled: response.data.data.aiEnabled ?? true,
          aiSystemPrompt: response.data.data.aiSystemPrompt,
          escalationKeywords: response.data.data.escalationKeywords,
        };

        this.setCache(cacheKey, data);
        log.info('Instagram session data fetched', { instagramAccountId, userId: data.userId });
        return data;
      }

      log.warn('Instagram account not found', { instagramAccountId });
      return null;
    } catch (error) {
      log.error('Failed to fetch Instagram session data', error, { instagramAccountId });
      return null;
    }
  }

  /**
   * Получить данные пользователя по Telegram bot token hash
   */
  async getUserByTelegramBot(botId: string): Promise<SessionUserData | null> {
    const cacheKey = `telegram:${botId}`;

    // Проверяем кэш
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      log.debug('Telegram session data from cache', { botId, userId: cached.userId });
      return cached;
    }

    try {
      const response = await axios.get(
        `${this.diarBackendUrl}/api/messenger/session/telegram/${encodeURIComponent(botId)}`,
        {
          headers: {
            'X-API-Key': this.diarApiKey,
          },
          timeout: 5000,
        }
      );

      if (response.data?.success && response.data?.data) {
        const data: SessionUserData = {
          userId: response.data.data.userId,
          aiEnabled: response.data.data.aiEnabled ?? true,
          aiSystemPrompt: response.data.data.aiSystemPrompt,
          escalationKeywords: response.data.data.escalationKeywords,
        };

        this.setCache(cacheKey, data);
        log.info('Telegram session data fetched', { botId, userId: data.userId });
        return data;
      }

      log.warn('Telegram bot not found', { botId });
      return null;
    } catch (error) {
      log.error('Failed to fetch Telegram session data', error, { botId });
      return null;
    }
  }

  /**
   * Инвалидировать кэш для сессии
   */
  invalidateCache(sessionId: string): void {
    delete this.cache[sessionId];
    log.debug('Session cache invalidated', { sessionId });
  }

  /**
   * Очистить весь кэш
   */
  clearCache(): void {
    this.cache = {};
    log.debug('Session cache cleared');
  }

  private getFromCache(key: string): SessionUserData | null {
    const cached = this.cache[key];
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    // Удаляем просроченный кэш
    if (cached) {
      delete this.cache[key];
    }
    return null;
  }

  private setCache(key: string, data: SessionUserData): void {
    this.cache[key] = {
      data,
      expiresAt: Date.now() + this.cacheTTL,
    };
  }
}

// Singleton
let sessionService: SessionService | null = null;

export function getSessionService(): SessionService {
  if (!sessionService) {
    sessionService = new SessionService();
  }
  return sessionService;
}
