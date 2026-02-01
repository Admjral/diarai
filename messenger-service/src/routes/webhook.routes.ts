import { Router, Request, Response } from 'express';
import { webhookLimiter } from '../middleware/rateLimit.js';
import { log } from '../utils/logger.js';
import { getWhatsAppService } from '../channels/whatsapp/whatsapp.service.js';
import { getInstagramService } from '../channels/instagram/instagram.service.js';
import { getMessageService } from '../services/message.service.js';
import { getSessionService } from '../services/session.service.js';

const router = Router();

// Простая дедупликация webhook'ов по messageId (TTL 60 секунд)
const processedMessages = new Map<string, number>();
const DEDUP_TTL = 60_000;

function isDuplicate(messageId: string): boolean {
  const now = Date.now();
  // Очистка старых записей
  if (processedMessages.size > 1000) {
    for (const [key, ts] of processedMessages) {
      if (now - ts > DEDUP_TTL) processedMessages.delete(key);
    }
  }
  if (processedMessages.has(messageId)) return true;
  processedMessages.set(messageId, now);
  return false;
}

/**
 * POST /webhook/whatsapp
 * Webhook от WAHA для входящих WhatsApp сообщений
 */
router.post('/whatsapp', webhookLimiter, async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    log.debug('WhatsApp webhook received', {
      event: payload.event,
      session: payload.session,
    });

    // Сразу отвечаем 200 чтобы не было retry
    res.status(200).json({ success: true });

    // Обрабатываем асинхронно
    if (payload.event === 'message' && payload.payload) {
      // Дедупликация: пропускаем повторные webhook'и для того же сообщения
      const messageId = payload.payload.id || payload.payload._data?.id?._serialized;
      if (messageId && isDuplicate(messageId)) {
        log.debug('Duplicate webhook skipped', { messageId });
        return;
      }

      const whatsapp = getWhatsAppService();
      const messageService = getMessageService();
      const sessionService = getSessionService();

      // Получаем sessionId из payload
      const sessionId = payload.session || payload.payload?.session;

      if (!sessionId) {
        log.warn('WhatsApp webhook without sessionId', { event: payload.event });
        return;
      }

      // Получаем данные пользователя по sessionId
      const sessionData = await sessionService.getUserByWhatsAppSession(sessionId);

      if (!sessionData) {
        log.warn('Unknown WhatsApp session, skipping message', { sessionId });
        return;
      }

      // Пропускаем статусы (WhatsApp Stories) — это не реальные сообщения
      const from = payload.payload.from || '';
      if (from.includes('status@broadcast')) {
        return;
      }

      const unifiedMessage = whatsapp.parseWebhookMessage(payload.payload, sessionData.userId);

      // Пропускаем исходящие сообщения
      if (unifiedMessage.direction === 'outbound') {
        return;
      }

      await messageService.processIncomingMessage({
        message: unifiedMessage,
        aiEnabled: sessionData.aiEnabled,
        aiSystemPrompt: sessionData.aiSystemPrompt,
        escalationKeywords: sessionData.escalationKeywords,
      });
    }
  } catch (error) {
    log.error('WhatsApp webhook error', error);
    // Не возвращаем ошибку - уже отправили 200
  }
});

/**
 * GET /webhook/instagram
 * Верификация Instagram webhook
 */
router.get('/instagram', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  const instagram = getInstagramService();
  const result = instagram.verifyWebhook(mode, token, challenge);

  if (result) {
    res.status(200).send(result);
  } else {
    res.status(403).send('Verification failed');
  }
});

/**
 * POST /webhook/instagram
 * Webhook от Instagram для входящих сообщений
 */
router.post('/instagram', webhookLimiter, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const payload = req.body;

    // Верифицируем подпись
    const instagram = getInstagramService();
    if (signature && !instagram.verifyWebhookSignature(signature, JSON.stringify(payload))) {
      log.warn('Invalid Instagram webhook signature');
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }

    log.debug('Instagram webhook received', { object: payload.object });

    // Сразу отвечаем 200
    res.status(200).json({ success: true });

    const sessionService = getSessionService();
    const messageService = getMessageService();

    // Получаем Instagram account ID из payload
    // Facebook Graph API отправляет recipient.id как ID Instagram аккаунта
    let instagramAccountId: string | null = null;

    if (payload.entry?.[0]?.messaging?.[0]?.recipient?.id) {
      instagramAccountId = payload.entry[0].messaging[0].recipient.id;
    }

    if (!instagramAccountId) {
      log.warn('Instagram webhook without account ID');
      return;
    }

    // Получаем данные пользователя по Instagram account ID
    const sessionData = await sessionService.getUserByInstagramAccount(instagramAccountId);

    if (!sessionData) {
      log.warn('Unknown Instagram account, skipping messages', { instagramAccountId });
      return;
    }

    const messages = instagram.parseWebhookPayload(payload, sessionData.userId);

    for (const message of messages) {
      await messageService.processIncomingMessage({
        message,
        aiEnabled: sessionData.aiEnabled,
        aiSystemPrompt: sessionData.aiSystemPrompt,
        escalationKeywords: sessionData.escalationKeywords,
      });
    }
  } catch (error) {
    log.error('Instagram webhook error', error);
  }
});

/**
 * POST /webhook/telegram
 * Webhook от Telegram (если используется webhook режим вместо polling)
 */
router.post('/telegram', webhookLimiter, async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    log.debug('Telegram webhook received', {
      updateId: payload.update_id,
    });

    // Сразу отвечаем 200
    res.status(200).json({ success: true });

    // Telegram обрабатывается через Telegraf middleware
    // Этот endpoint нужен если используется webhook mode

    // TODO: Implement if needed
  } catch (error) {
    log.error('Telegram webhook error', error);
  }
});

export default router;
