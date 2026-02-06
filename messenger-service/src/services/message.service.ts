import axios from 'axios';
import { log } from '../utils/logger.js';
import { publishEvent, REDIS_CHANNELS } from '../utils/redis.js';
import { UnifiedMessage, MessengerType, DiarWebhookPayload } from '../types/index.js';
import { getWhatsAppService } from '../channels/whatsapp/whatsapp.service.js';
import { getTelegramService } from '../channels/telegram/telegram.service.js';
import { getInstagramService } from '../channels/instagram/instagram.service.js';
import { getAIResponderService } from './ai-responder.service.js';

interface SendMessageParams {
  userId: number;
  messengerType: MessengerType;
  messengerId: string;
  text: string;
  mediaUrls?: string[];
  sessionId?: string; // для WhatsApp
}

interface ProcessMessageParams {
  message: UnifiedMessage;
  aiEnabled: boolean;
  aiSystemPrompt?: string;
  escalationKeywords?: string[];
}

export class MessageService {
  private diarBackendUrl: string;
  private diarApiKey: string;

  constructor() {
    this.diarBackendUrl = process.env.DIAR_BACKEND_URL || 'http://localhost:3001';
    this.diarApiKey = process.env.DIAR_API_KEY || '';

    log.info('Message service initialized');
  }

  /**
   * Отправить сообщение через соответствующий мессенджер
   */
  async sendMessage(params: SendMessageParams): Promise<{ id: string }> {
    const { userId, messengerType, messengerId, text, mediaUrls, sessionId } = params;

    log.info('Sending message', {
      userId,
      messengerType,
      messengerId,
      textLength: text.length,
    });

    try {
      let result: { id: string };

      switch (messengerType) {
        case 'whatsapp': {
          const whatsapp = getWhatsAppService();
          if (!sessionId) {
            throw new Error('WhatsApp session ID required');
          }
          if (mediaUrls?.length) {
            result = await whatsapp.sendMedia(sessionId, messengerId, mediaUrls[0], text);
          } else {
            result = await whatsapp.sendMessage(sessionId, messengerId, text);
          }
          break;
        }

        case 'telegram': {
          const telegram = getTelegramService();
          if (mediaUrls?.length) {
            result = await telegram.sendPhoto(messengerId, mediaUrls[0], text);
          } else {
            result = await telegram.sendMessage(messengerId, text);
          }
          break;
        }

        case 'instagram': {
          const instagram = getInstagramService();
          if (mediaUrls?.length) {
            result = await instagram.sendMedia(messengerId, mediaUrls[0]);
          } else {
            result = await instagram.sendMessage(messengerId, text);
          }
          break;
        }

        default:
          throw new Error(`Unknown messenger type: ${messengerType}`);
      }

      // Публикуем событие отправки
      await publishEvent(REDIS_CHANNELS.MESSAGE_SENT, {
        userId,
        messengerType,
        messengerId,
        messageId: result.id,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      log.error('Failed to send message', error, { userId, messengerType, messengerId });
      throw error;
    }
  }

  /**
   * Обработать входящее сообщение
   */
  async processIncomingMessage(params: ProcessMessageParams): Promise<void> {
    const { message, aiEnabled, aiSystemPrompt, escalationKeywords } = params;

    log.info('Processing incoming message', {
      messageId: message.id,
      messengerType: message.messengerType,
      userId: message.userId,
    });

    try {
      // Публикуем событие получения сообщения
      await publishEvent(REDIS_CHANNELS.MESSAGE_RECEIVED, {
        event: 'message.received',
        userId: message.userId,
        messengerType: message.messengerType,
        message,
        timestamp: new Date().toISOString(),
      });

      // Отправляем webhook в DIAR backend
      await this.sendWebhookToDiar({
        event: 'message.received',
        userId: message.userId,
        messengerType: message.messengerType,
        message,
        timestamp: new Date().toISOString(),
      });

      // Если AI включен - генерируем автоответ
      if (aiEnabled) {
        const aiService = getAIResponderService();

        if (aiService.isAIAvailable()) {
          const aiResponse = await aiService.processMessage(message, {
            systemPrompt: aiSystemPrompt,
            escalationKeywords,
          });

          if (aiResponse.shouldEscalate) {
            // Уведомляем об эскалации
            await this.sendWebhookToDiar({
              event: 'message.escalated',
              userId: message.userId,
              messengerType: message.messengerType,
              message: {
                ...message,
                status: 'pending' as const,
              },
              timestamp: new Date().toISOString(),
            });

            log.info('Message escalated', {
              messageId: message.id,
              reason: aiResponse.escalationReason,
            });
          } else if (aiResponse.text) {
            // Отправляем AI ответ
            await this.sendMessage({
              userId: message.userId,
              messengerType: message.messengerType,
              messengerId: message.messengerId,
              text: aiResponse.text,
              sessionId: this.extractSessionId(message),
            });

            // Уведомляем об AI ответе
            await this.sendWebhookToDiar({
              event: 'message.ai_responded',
              userId: message.userId,
              messengerType: message.messengerType,
              message: {
                ...message,
                text: aiResponse.text,
                isAIGenerated: true,
                aiConfidence: aiResponse.confidence,
                direction: 'outbound' as const,
                status: 'sent' as const,
              },
              timestamp: new Date().toISOString(),
            });

            log.info('AI response sent', {
              messageId: message.id,
              confidence: aiResponse.confidence,
            });
          }
        }
      }
    } catch (error) {
      log.error('Failed to process incoming message', error, {
        messageId: message.id,
      });
      throw error;
    }
  }

  /**
   * Отправить webhook в DIAR backend
   */
  private async sendWebhookToDiar(payload: DiarWebhookPayload): Promise<void> {
    try {
      await axios.post(`${this.diarBackendUrl}/api/messenger/webhook`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.diarApiKey,
        },
        timeout: 10000,
      });

      log.debug('Webhook sent to DIAR', { event: payload.event });
    } catch (error) {
      log.error('Failed to send webhook to DIAR', error, { event: payload.event });
      // Не бросаем ошибку - webhook не должен блокировать обработку
    }
  }

  /**
   * Извлечь sessionId из сообщения (для WhatsApp)
   */
  private extractSessionId(message: UnifiedMessage): string | undefined {
    if (message.messengerType !== 'whatsapp') return undefined;

    // WAHA Core поддерживает только сессию 'default'
    return 'default';
  }
}

// Singleton
let messageService: MessageService | null = null;

export function getMessageService(): MessageService {
  if (!messageService) {
    messageService = new MessageService();
  }
  return messageService;
}
