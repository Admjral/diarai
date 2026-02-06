import axios, { AxiosInstance } from 'axios';
import { log } from '../../utils/logger.js';
import {
  UnifiedMessage,
  EvolutionInstance,
  EvolutionQRCode,
  EvolutionMessage,
  EvolutionConnectionState,
  EvolutionMessageStatus,
  EvolutionCreateInstanceResponse,
  EvolutionSendMessageResponse,
} from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * WhatsApp Service using Evolution API
 * Supports multi-session (each user gets their own instance)
 */
export class WhatsAppService {
  private client: AxiosInstance;
  private evolutionUrl: string;
  private apiKey: string;

  constructor() {
    this.evolutionUrl = process.env.EVOLUTION_API_URL || process.env.WAHA_URL || 'http://localhost:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || process.env.WAHA_API_KEY || '';

    this.client = axios.create({
      baseURL: this.evolutionUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
      },
    });

    log.info('WhatsApp service initialized (Evolution API)', {
      evolutionUrl: this.evolutionUrl,
    });
  }

  /**
   * Создать новую WhatsApp instance (сессию)
   * Multi-session: каждый пользователь получает уникальное имя instance
   */
  async createSession(sessionId: string): Promise<EvolutionInstance> {
    const instanceName = this.sanitizeInstanceName(sessionId);
    const webhookUrl = `${process.env.MESSENGER_SERVICE_URL || 'http://localhost:3002'}/webhook/whatsapp`;

    const instanceConfig = {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      reject_call: true,
      groups_ignore: false,
      always_online: false,
      read_messages: false,
      read_status: false,
      webhook: {
        url: webhookUrl,
        webhook_by_events: false,
        webhook_base64: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
          'SEND_MESSAGE',
        ],
      },
    };

    try {
      const response = await this.client.post<EvolutionCreateInstanceResponse>(
        '/instance/create',
        instanceConfig
      );
      log.info('WhatsApp instance created', { instanceName, sessionId });

      return {
        instanceName: response.data.instance.instanceName,
        instanceId: response.data.instance.instanceId,
        status: 'qrcode' as EvolutionConnectionState,
        serverUrl: this.evolutionUrl,
        apikey: response.data.hash,
      };
    } catch (error: any) {
      // Instance уже существует - получаем статус
      if (
        error?.response?.status === 403 ||
        error?.response?.status === 400 ||
        error?.response?.data?.message?.includes('already') ||
        error?.response?.data?.message?.includes('exists')
      ) {
        log.info('Instance already exists, fetching status', { instanceName });
        return this.getSessionStatus(sessionId);
      }
      log.error('Failed to create WhatsApp instance', error, { sessionId });
      throw error;
    }
  }

  /**
   * Получить QR код для авторизации
   */
  async getQRCode(sessionId: string): Promise<EvolutionQRCode> {
    const instanceName = this.sanitizeInstanceName(sessionId);

    try {
      const response = await this.client.get(`/instance/connect/${instanceName}`);

      // Evolution API возвращает QR в разных форматах
      const data = response.data;

      return {
        code: data.code || data.qrcode?.code || '',
        base64: data.base64 || data.qrcode?.base64 || '',
        pairingCode: data.pairingCode || data.qrcode?.pairingCode,
        count: data.count || data.qrcode?.count || 0,
      };
    } catch (error: any) {
      // Если instance уже подключен, QR не нужен
      if (error?.response?.status === 404 || error?.response?.data?.message?.includes('connected')) {
        log.info('Instance already connected, no QR needed', { sessionId });
        return {
          code: '',
          base64: '',
          count: 0,
        };
      }
      log.error('Failed to get QR code', error, { sessionId });
      throw error;
    }
  }

  /**
   * Получить статус сессии/instance
   */
  async getSessionStatus(sessionId: string): Promise<EvolutionInstance> {
    const instanceName = this.sanitizeInstanceName(sessionId);

    try {
      const response = await this.client.get(`/instance/connectionState/${instanceName}`);

      const state = response.data?.instance?.state || response.data?.state || 'close';

      return {
        instanceName,
        instanceId: response.data?.instance?.instanceId || '',
        status: state as EvolutionConnectionState,
        serverUrl: this.evolutionUrl,
        profileName: response.data?.instance?.profileName,
        profilePictureUrl: response.data?.instance?.profilePictureUrl,
      };
    } catch (error: any) {
      // Instance не существует
      if (error?.response?.status === 404) {
        return {
          instanceName,
          status: 'not_found' as EvolutionConnectionState,
          serverUrl: this.evolutionUrl,
        };
      }
      log.error('Failed to get session status', error, { sessionId });
      throw error;
    }
  }

  /**
   * Удалить instance
   */
  async deleteSession(sessionId: string): Promise<void> {
    const instanceName = this.sanitizeInstanceName(sessionId);

    try {
      await this.client.delete(`/instance/delete/${instanceName}`);
      log.info('WhatsApp instance deleted', { instanceName, sessionId });
    } catch (error: any) {
      if (error?.response?.status === 404) {
        log.info('Instance already deleted or not found', { instanceName });
        return;
      }
      log.error('Failed to delete instance', error, { sessionId });
      throw error;
    }
  }

  /**
   * Logout instance (отключить WhatsApp без удаления)
   */
  async logoutSession(sessionId: string): Promise<void> {
    const instanceName = this.sanitizeInstanceName(sessionId);

    try {
      await this.client.delete(`/instance/logout/${instanceName}`);
      log.info('WhatsApp instance logged out', { instanceName });
    } catch (error) {
      log.error('Failed to logout instance', error, { sessionId });
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
    const instanceName = this.sanitizeInstanceName(sessionId);
    const formattedNumber = this.formatPhoneNumber(chatId);

    try {
      const response = await this.client.post<EvolutionSendMessageResponse>(
        `/message/sendText/${instanceName}`,
        {
          number: formattedNumber,
          options: {
            delay: 1200,
            presence: 'composing',
          },
          textMessage: {
            text,
          },
        }
      );

      const messageId = response.data?.key?.id || uuidv4();

      log.info('WhatsApp message sent', {
        instanceName,
        chatId: formattedNumber,
        messageId,
      });

      return { id: messageId };
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
    const instanceName = this.sanitizeInstanceName(sessionId);
    const formattedNumber = this.formatPhoneNumber(chatId);

    // Определяем тип медиа по URL
    const mediaType = this.detectMediaType(mediaUrl);

    try {
      const response = await this.client.post<EvolutionSendMessageResponse>(
        `/message/sendMedia/${instanceName}`,
        {
          number: formattedNumber,
          options: {
            delay: 1500,
            presence: 'composing',
          },
          mediaMessage: {
            mediatype: mediaType,
            media: mediaUrl,
            caption,
          },
        }
      );

      const messageId = response.data?.key?.id || uuidv4();

      log.info('WhatsApp media sent', {
        instanceName,
        chatId: formattedNumber,
        messageId,
        mediaType,
      });

      return { id: messageId };
    } catch (error) {
      log.error('Failed to send WhatsApp media', error, { sessionId, chatId });
      throw error;
    }
  }

  /**
   * Преобразовать Evolution API webhook message в унифицированный формат
   */
  parseWebhookMessage(
    data: EvolutionMessage,
    instanceName: string,
    userId: number
  ): UnifiedMessage {
    // Извлекаем номер телефона из remoteJid
    const remoteJid = data.key.remoteJid;
    const messengerId = remoteJid.split('@')[0];

    // Извлекаем текст из различных типов сообщений
    let text = '';
    if (data.message?.conversation) {
      text = data.message.conversation;
    } else if (data.message?.extendedTextMessage?.text) {
      text = data.message.extendedTextMessage.text;
    } else if (data.message?.imageMessage?.caption) {
      text = data.message.imageMessage.caption;
    } else if (data.message?.videoMessage?.caption) {
      text = data.message.videoMessage.caption;
    }

    // Извлекаем медиа URLs
    const mediaUrls: string[] = [];
    if (data.message?.imageMessage?.url) {
      mediaUrls.push(data.message.imageMessage.url);
    }
    if (data.message?.videoMessage?.url) {
      mediaUrls.push(data.message.videoMessage.url);
    }
    if (data.message?.audioMessage?.url) {
      mediaUrls.push(data.message.audioMessage.url);
    }
    if (data.message?.documentMessage?.url) {
      mediaUrls.push(data.message.documentMessage.url);
    }
    if (data.message?.stickerMessage?.url) {
      mediaUrls.push(data.message.stickerMessage.url);
    }

    return {
      id: data.key.id || uuidv4(),
      messengerType: 'whatsapp',
      messengerId,
      userId,
      text: text || '',
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      senderName: data.pushName,
      direction: data.key.fromMe ? 'outbound' : 'inbound',
      status: this.mapStatusToUnified(data.status),
      timestamp: data.messageTimestamp
        ? new Date(data.messageTimestamp * 1000)
        : new Date(),
      rawData: data as unknown as Record<string, unknown>,
    };
  }

  /**
   * Маппинг статуса Evolution в унифицированный статус
   */
  private mapStatusToUnified(
    status?: EvolutionMessageStatus
  ): UnifiedMessage['status'] {
    switch (status) {
      case 'ERROR':
        return 'failed';
      case 'PENDING':
        return 'pending';
      case 'SERVER_ACK':
        return 'sent';
      case 'DELIVERY_ACK':
        return 'delivered';
      case 'READ':
      case 'PLAYED':
        return 'read';
      default:
        return 'sent';
    }
  }

  /**
   * Маппинг статуса подключения Evolution в WAHA-совместимый формат
   * Для обратной совместимости с frontend
   */
  mapConnectionStatus(state: EvolutionConnectionState): string {
    switch (state) {
      case 'open':
        return 'WORKING';
      case 'connecting':
        return 'STARTING';
      case 'qrcode':
        return 'SCAN_QR_CODE';
      case 'close':
        return 'STOPPED';
      case 'not_found':
        return 'NO_SESSION';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Проверить, подключен ли instance
   */
  isConnected(state: EvolutionConnectionState): boolean {
    return state === 'open';
  }

  /**
   * Санитизация имени instance (Evolution требует alphanumeric)
   */
  private sanitizeInstanceName(sessionId: string): string {
    return sessionId.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  }

  /**
   * Форматирование номера телефона для Evolution API
   */
  private formatPhoneNumber(chatId: string): string {
    // Убираем @c.us/@g.us суффикс если есть
    let phone = chatId.split('@')[0];
    // Убираем все нецифровые символы
    phone = phone.replace(/\D/g, '');
    return phone;
  }

  /**
   * Определить тип медиа по URL
   */
  private detectMediaType(url: string): 'image' | 'video' | 'audio' | 'document' {
    const lower = url.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp)/.test(lower)) {
      return 'image';
    }
    if (/\.(mp4|avi|mov|webm)/.test(lower)) {
      return 'video';
    }
    if (/\.(mp3|wav|ogg|aac|m4a)/.test(lower)) {
      return 'audio';
    }
    return 'document';
  }

  /**
   * Получить список всех instances
   */
  async listSessions(): Promise<EvolutionInstance[]> {
    try {
      const response = await this.client.get('/instance/fetchInstances');
      return (response.data || []).map((inst: any) => ({
        instanceName: inst.instanceName || inst.instance?.instanceName,
        instanceId: inst.instanceId || inst.instance?.instanceId,
        status: inst.status || inst.instance?.status || 'close',
        serverUrl: this.evolutionUrl,
      }));
    } catch (error) {
      log.error('Failed to list instances', error);
      throw error;
    }
  }

  /**
   * Health check Evolution API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/');
      return response.status === 200;
    } catch (error) {
      log.error('Evolution API health check failed', error);
      return false;
    }
  }

  /**
   * Установить webhook для конкретного instance
   */
  async setWebhook(sessionId: string, webhookUrl: string): Promise<void> {
    const instanceName = this.sanitizeInstanceName(sessionId);

    try {
      await this.client.post(`/webhook/set/${instanceName}`, {
        enabled: true,
        url: webhookUrl,
        webhook_by_events: false,
        webhook_base64: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
          'SEND_MESSAGE',
        ],
      });
      log.info('Webhook set for instance', { instanceName, webhookUrl });
    } catch (error) {
      log.error('Failed to set webhook', error, { sessionId });
      throw error;
    }
  }

  /**
   * Перезапустить instance
   */
  async restartSession(sessionId: string): Promise<void> {
    const instanceName = this.sanitizeInstanceName(sessionId);

    try {
      await this.client.post(`/instance/restart/${instanceName}`);
      log.info('WhatsApp instance restarted', { instanceName });
    } catch (error) {
      log.error('Failed to restart instance', error, { sessionId });
      throw error;
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
