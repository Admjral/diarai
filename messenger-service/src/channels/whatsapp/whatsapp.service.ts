import axios, { AxiosInstance } from 'axios';
import { log } from '../../utils/logger.js';
import { UnifiedMessage, WhatsAppCredentials } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';

interface WAHASession {
  name: string;
  status: string;
  config?: {
    webhooks?: Array<{ url: string; events: string[] }>;
  };
}

interface WAHAMessage {
  id: string;
  timestamp: number;
  from: string;
  to: string;
  body: string;
  fromMe: boolean;
  hasMedia: boolean;
  mediaUrl?: string;
  ack?: number;
  chatId?: string;
}

interface WAHAQRCode {
  value: string;
  status: string;
}

export class WhatsAppService {
  private client: AxiosInstance;
  private wahaUrl: string;

  constructor() {
    this.wahaUrl = process.env.WAHA_URL || 'http://localhost:3001';
    this.client = axios.create({
      baseURL: this.wahaUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.WAHA_API_KEY && {
          'X-Api-Key': process.env.WAHA_API_KEY,
        }),
      },
    });

    log.info('WhatsApp service initialized', { wahaUrl: this.wahaUrl });
  }

  /**
   * Создать новую сессию WhatsApp
   * WAHA Core поддерживает только сессию 'default'
   */
  async createSession(sessionId: string): Promise<WAHASession> {
    // WAHA Core поддерживает только 'default' сессию
    const wahaSessionName = 'default';
    const webhookUrl = `${process.env.MESSENGER_SERVICE_URL || 'http://localhost:3004'}/webhook/whatsapp`;

    const sessionConfig = {
      name: wahaSessionName,
      config: {
        webhooks: [
          {
            url: webhookUrl,
            events: ['message', 'message.ack', 'session.status'],
          },
        ],
      },
    };

    try {
      // Пробуем создать сессию
      const response = await this.client.post('/api/sessions', sessionConfig);
      log.info('WhatsApp session created', { sessionId, wahaSessionName });
      return response.data;
    } catch (error: any) {
      // Если сессия уже существует - обновляем через PUT и запускаем
      if (error?.response?.status === 422) {
        log.info('WhatsApp session already exists, updating', { wahaSessionName });
        try {
          const updateResponse = await this.client.put(`/api/sessions/${wahaSessionName}`, sessionConfig);
          // Запускаем сессию если она остановлена
          await this.startSession(wahaSessionName);
          return updateResponse.data;
        } catch (updateError) {
          log.error('Failed to update WhatsApp session', updateError, { wahaSessionName });
          throw updateError;
        }
      }
      log.error('Failed to create WhatsApp session', error, { sessionId });
      throw error;
    }
  }

  /**
   * Запустить остановленную сессию
   */
  async startSession(sessionId: string): Promise<void> {
    try {
      await this.client.post(`/api/sessions/${sessionId}/start`);
      log.info('WhatsApp session started', { sessionId });
    } catch (error: any) {
      // Игнорируем если сессия уже запущена
      if (error?.response?.status !== 422) {
        log.error('Failed to start WhatsApp session', error, { sessionId });
      }
    }
  }

  /**
   * Получить QR код для авторизации
   */
  async getQRCode(sessionId: string): Promise<WAHAQRCode> {
    try {
      // WAHA Core: используем 'default' сессию
      const wahaSession = 'default';
      const response = await this.client.get(`/api/${wahaSession}/auth/qr`, {
        params: { format: 'image' },
        responseType: 'arraybuffer',
      });
      // Конвертируем бинарное изображение в base64
      const base64 = Buffer.from(response.data).toString('base64');
      return { value: base64, status: 'scan' };
    } catch (error) {
      log.error('Failed to get QR code', error, { sessionId });
      throw error;
    }
  }

  /**
   * Получить статус сессии
   */
  async getSessionStatus(sessionId: string): Promise<WAHASession> {
    try {
      // WAHA Core: используем 'default' сессию
      const wahaSession = 'default';
      const response = await this.client.get(`/api/sessions/${wahaSession}`);
      return response.data;
    } catch (error) {
      log.error('Failed to get session status', error, { sessionId });
      throw error;
    }
  }

  /**
   * Удалить сессию
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.client.delete(`/api/sessions/${sessionId}`);
      log.info('WhatsApp session deleted', { sessionId });
    } catch (error) {
      log.error('Failed to delete session', error, { sessionId });
      throw error;
    }
  }

  /**
   * Отправить текстовое сообщение
   */
  async sendMessage(
    sessionId: string,
    chatId: string,
    text: string
  ): Promise<{ id: string }> {
    try {
      // WAHA Core: всегда используем 'default' сессию
      const wahaSession = 'default';
      // Форматируем chatId если нужно (добавляем @c.us)
      const formattedChatId = chatId.includes('@') ? chatId : `${chatId}@c.us`;

      const response = await this.client.post(`/api/sendText`, {
        session: wahaSession,
        chatId: formattedChatId,
        text,
      });

      log.info('WhatsApp message sent', {
        sessionId,
        chatId: formattedChatId,
        messageId: response.data.id,
      });

      return { id: response.data.id };
    } catch (error) {
      log.error('Failed to send WhatsApp message', error, { sessionId, chatId });
      throw error;
    }
  }

  /**
   * Отправить медиа
   */
  async sendMedia(
    sessionId: string,
    chatId: string,
    mediaUrl: string,
    caption?: string
  ): Promise<{ id: string }> {
    try {
      // WAHA Core: всегда используем 'default' сессию
      const wahaSession = 'default';
      const formattedChatId = chatId.includes('@') ? chatId : `${chatId}@c.us`;

      const response = await this.client.post(`/api/sendFile`, {
        session: wahaSession,
        chatId: formattedChatId,
        file: { url: mediaUrl },
        caption,
      });

      log.info('WhatsApp media sent', {
        sessionId,
        chatId: formattedChatId,
        messageId: response.data.id,
      });

      return { id: response.data.id };
    } catch (error) {
      log.error('Failed to send WhatsApp media', error, { sessionId, chatId });
      throw error;
    }
  }

  /**
   * Преобразовать WAHA сообщение в унифицированный формат
   */
  parseWebhookMessage(
    wahaMessage: WAHAMessage,
    userId: number
  ): UnifiedMessage {
    // Извлекаем номер телефона из chatId (убираем @c.us/@g.us)
    const messengerId = wahaMessage.from.split('@')[0];

    return {
      id: wahaMessage.id || uuidv4(),
      messengerType: 'whatsapp',
      messengerId,
      userId,
      text: wahaMessage.body || '',
      mediaUrls: wahaMessage.mediaUrl ? [wahaMessage.mediaUrl] : undefined,
      direction: wahaMessage.fromMe ? 'outbound' : 'inbound',
      status: this.mapAckToStatus(wahaMessage.ack),
      timestamp: new Date(wahaMessage.timestamp * 1000),
      rawData: wahaMessage as unknown as Record<string, unknown>,
    };
  }

  /**
   * Маппинг ack статуса WAHA на наш статус
   */
  private mapAckToStatus(ack?: number): UnifiedMessage['status'] {
    switch (ack) {
      case -1:
        return 'failed';
      case 0:
        return 'pending';
      case 1:
        return 'sent';
      case 2:
        return 'delivered';
      case 3:
        return 'read';
      default:
        return 'sent';
    }
  }

  /**
   * Получить список сессий
   */
  async listSessions(): Promise<WAHASession[]> {
    try {
      const response = await this.client.get('/api/sessions');
      return response.data;
    } catch (error) {
      log.error('Failed to list sessions', error);
      throw error;
    }
  }

  /**
   * Проверить здоровье WAHA
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/sessions');
      return response.status === 200;
    } catch (error) {
      log.error('WAHA health check failed', error);
      return false;
    }
  }
}

// Singleton
let whatsappService: WhatsAppService | null = null;

export function getWhatsAppService(): WhatsAppService {
  if (!whatsappService) {
    whatsappService = new WhatsAppService();
  }
  return whatsappService;
}
