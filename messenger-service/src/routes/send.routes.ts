import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { serviceAuthMiddleware } from '../middleware/auth.js';
import { sendLimiter } from '../middleware/rateLimit.js';
import { log } from '../utils/logger.js';
import { getMessageService } from '../services/message.service.js';
import { MessengerType } from '../types/index.js';

const router = Router();

// Схема валидации
const sendMessageSchema = z.object({
  userId: z.number(),
  messengerType: z.enum(['whatsapp', 'telegram', 'instagram']),
  messengerId: z.string().min(1),
  text: z.string().min(1).max(4096),
  mediaUrls: z.array(z.string().url()).optional(),
  sessionId: z.string().optional(), // Для WhatsApp
});

/**
 * POST /send
 * Отправить сообщение через мессенджер
 * Вызывается из DIAR backend
 */
router.post(
  '/',
  serviceAuthMiddleware,
  sendLimiter,
  async (req: Request, res: Response) => {
    try {
      // Логируем входящий запрос для отладки
      log.info('Incoming send request', {
        body: JSON.stringify(req.body),
        headers: {
          contentType: req.headers['content-type'],
          apiKey: req.headers['x-api-key'] ? 'present' : 'missing',
        }
      });

      // Валидация
      const result = sendMessageSchema.safeParse(req.body);
      if (!result.success) {
        log.warn('Validation failed', { errors: result.error.errors });
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors,
        });
        return;
      }

      const { userId, messengerType, messengerId, text, mediaUrls, sessionId } = result.data;

      log.info('Send message request', {
        userId,
        messengerType,
        messengerId,
      });

      const messageService = getMessageService();
      const messageResult = await messageService.sendMessage({
        userId,
        messengerType: messengerType as MessengerType,
        messengerId,
        text,
        mediaUrls,
        sessionId,
      });

      res.json({
        success: true,
        data: {
          messageId: messageResult.id,
        },
      });
    } catch (error) {
      log.error('Send message error', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send message',
      });
    }
  }
);

export default router;
