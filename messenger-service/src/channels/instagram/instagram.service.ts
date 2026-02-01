import axios, { AxiosInstance } from 'axios';
import { log } from '../../utils/logger.js';
import { UnifiedMessage } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

interface InstagramMessage {
  id: string;
  created_time: string;
  message?: string;
  from: {
    id: string;
    username?: string;
    name?: string;
  };
  to?: {
    data: Array<{ id: string }>;
  };
  attachments?: {
    data: Array<{
      id: string;
      type: string;
      image_data?: { url: string };
      video_data?: { url: string };
    }>;
  };
}

interface InstagramWebhookEntry {
  id: string;
  time: number;
  messaging?: Array<{
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
      mid: string;
      text?: string;
      attachments?: Array<{
        type: string;
        payload: { url: string };
      }>;
    };
  }>;
}

interface InstagramWebhookPayload {
  object: string;
  entry: InstagramWebhookEntry[];
}

export class InstagramService {
  private client: AxiosInstance;
  private pageId: string;
  private instagramAccountId: string;

  constructor() {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    this.pageId = process.env.INSTAGRAM_PAGE_ID || '';
    this.instagramAccountId = process.env.INSTAGRAM_ACCOUNT_ID || '';

    this.client = axios.create({
      baseURL: 'https://graph.facebook.com/v18.0',
      timeout: 30000,
      params: {
        access_token: accessToken,
      },
    });

    if (accessToken) {
      log.info('Instagram service initialized');
    } else {
      log.warn('Instagram access token not configured');
    }
  }

  /**
   * Отправить текстовое сообщение
   */
  async sendMessage(recipientId: string, text: string): Promise<{ id: string }> {
    try {
      const response = await this.client.post(`/${this.pageId}/messages`, {
        recipient: { id: recipientId },
        message: { text },
      });

      log.info('Instagram message sent', {
        recipientId,
        messageId: response.data.message_id,
      });

      return { id: response.data.message_id };
    } catch (error) {
      log.error('Failed to send Instagram message', error, { recipientId });
      throw error;
    }
  }

  /**
   * Отправить медиа
   */
  async sendMedia(
    recipientId: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' = 'image'
  ): Promise<{ id: string }> {
    try {
      const response = await this.client.post(`/${this.pageId}/messages`, {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: mediaType,
            payload: { url: mediaUrl },
          },
        },
      });

      log.info('Instagram media sent', {
        recipientId,
        messageId: response.data.message_id,
      });

      return { id: response.data.message_id };
    } catch (error) {
      log.error('Failed to send Instagram media', error, { recipientId });
      throw error;
    }
  }

  /**
   * Получить информацию о Instagram аккаунте
   */
  async getAccountInfo(): Promise<{ id: string; username: string; name: string } | null> {
    try {
      const response = await this.client.get(`/${this.instagramAccountId}`, {
        params: {
          fields: 'id,username,name',
        },
      });

      return {
        id: response.data.id,
        username: response.data.username,
        name: response.data.name || response.data.username,
      };
    } catch (error) {
      log.error('Failed to get Instagram account info', error);
      return null;
    }
  }

  /**
   * Верифицировать webhook (challenge)
   */
  verifyWebhook(
    mode: string,
    token: string,
    challenge: string
  ): string | null {
    const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      log.info('Instagram webhook verified');
      return challenge;
    }

    log.warn('Instagram webhook verification failed', { mode, token });
    return null;
  }

  /**
   * Верифицировать подпись webhook
   */
  verifyWebhookSignature(
    signature: string,
    payload: string
  ): boolean {
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    if (!appSecret) {
      log.warn('Instagram app secret not configured');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(providedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Парсинг webhook payload
   */
  parseWebhookPayload(payload: InstagramWebhookPayload, userId: number): UnifiedMessage[] {
    const messages: UnifiedMessage[] = [];

    if (payload.object !== 'instagram') {
      return messages;
    }

    for (const entry of payload.entry) {
      if (!entry.messaging) continue;

      for (const messagingEvent of entry.messaging) {
        if (!messagingEvent.message) continue;

        const msg = messagingEvent.message;
        const mediaUrls: string[] = [];

        // Собираем медиа
        if (msg.attachments) {
          for (const attachment of msg.attachments) {
            if (attachment.payload?.url) {
              mediaUrls.push(attachment.payload.url);
            }
          }
        }

        messages.push({
          id: msg.mid || uuidv4(),
          messengerType: 'instagram',
          messengerId: messagingEvent.sender.id,
          userId,
          text: msg.text || '',
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
          direction: 'inbound',
          status: 'received',
          timestamp: new Date(messagingEvent.timestamp),
          rawData: messagingEvent as unknown as Record<string, unknown>,
        });
      }
    }

    return messages;
  }

  /**
   * Получить историю сообщений
   */
  async getConversations(): Promise<Array<{ id: string; participants: string[] }>> {
    try {
      const response = await this.client.get(`/${this.pageId}/conversations`, {
        params: {
          platform: 'instagram',
          fields: 'id,participants',
        },
      });

      return response.data.data || [];
    } catch (error) {
      log.error('Failed to get Instagram conversations', error);
      return [];
    }
  }

  /**
   * Получить сообщения разговора
   */
  async getConversationMessages(
    conversationId: string,
    limit: number = 50
  ): Promise<InstagramMessage[]> {
    try {
      const response = await this.client.get(`/${conversationId}/messages`, {
        params: {
          fields: 'id,created_time,from,to,message,attachments',
          limit,
        },
      });

      return response.data.data || [];
    } catch (error) {
      log.error('Failed to get conversation messages', error, { conversationId });
      return [];
    }
  }

  /**
   * Проверить здоровье
   */
  async healthCheck(): Promise<boolean> {
    try {
      const info = await this.getAccountInfo();
      return info !== null;
    } catch {
      return false;
    }
  }
}

// Singleton
let instagramService: InstagramService | null = null;

export function getInstagramService(): InstagramService {
  if (!instagramService) {
    instagramService = new InstagramService();
  }
  return instagramService;
}
