import { Router, Request, Response } from 'express';
import { webhookLimiter } from '../middleware/rateLimit.js';
import { log } from '../utils/logger.js';
import { getWhatsAppService } from '../channels/whatsapp/whatsapp.service.js';
import { getInstagramService } from '../channels/instagram/instagram.service.js';
import { getMessageService } from '../services/message.service.js';
import { getSessionService } from '../services/session.service.js';
import {
  EvolutionWebhookPayload,
  EvolutionMessage,
  EvolutionConnectionUpdate,
  EvolutionQRCodeUpdate,
} from '../types/index.js';

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
 * Webhook от Evolution API для входящих WhatsApp событий
 *
 * События:
 * - MESSAGES_UPSERT: новое входящее сообщение
 * - MESSAGES_UPDATE: обновление статуса сообщения
 * - CONNECTION_UPDATE: изменение статуса подключения
 * - QRCODE_UPDATED: обновление QR кода
 * - SEND_MESSAGE: подтверждение отправки
 */
router.post('/whatsapp', webhookLimiter, async (req: Request, res: Response) => {
  try {
    const payload = req.body as EvolutionWebhookPayload;

    log.info('[Webhook:WA] Received', {
      event: payload.event,
      instance: payload.instance,
      dataKeys: Object.keys(payload.data || {}).join(','),
    });

    // Сразу отвечаем 200 чтобы не было retry
    res.status(200).json({ success: true });

    // Обрабатываем асинхронно в зависимости от типа события
    switch (payload.event) {
      case 'MESSAGES_UPSERT':
        await handleMessagesUpsert(payload);
        break;
      case 'MESSAGES_UPDATE':
        await handleMessagesUpdate(payload);
        break;
      case 'CONNECTION_UPDATE':
        await handleConnectionUpdate(payload);
        break;
      case 'QRCODE_UPDATED':
        await handleQRCodeUpdate(payload);
        break;
      case 'SEND_MESSAGE':
        log.info('[Webhook:WA] Send message confirmed', { instance: payload.instance });
        break;
      default:
        log.info('[Webhook:WA] Unhandled event', { event: payload.event, instance: payload.instance });
    }
  } catch (error) {
    log.error('[Webhook:WA] Error processing webhook', error);
    // Не возвращаем ошибку - уже отправили 200
  }
});

/**
 * Обработка входящих сообщений (MESSAGES_UPSERT)
 */
async function handleMessagesUpsert(payload: EvolutionWebhookPayload): Promise<void> {
  const whatsapp = getWhatsAppService();
  const messageService = getMessageService();
  const sessionService = getSessionService();

  const instanceName = payload.instance;
  const messageData = payload.data as EvolutionMessage;

  // Проверяем наличие данных сообщения
  if (!messageData?.key?.remoteJid) {
    log.debug('No message data in MESSAGES_UPSERT', { instance: instanceName });
    return;
  }

  // Пропускаем статусы (WhatsApp Stories)
  if (messageData.key.remoteJid.includes('status@broadcast')) {
    return;
  }

  // Пропускаем групповые сообщения (опционально)
  if (messageData.key.remoteJid.includes('@g.us')) {
    log.debug('Skipping group message', { remoteJid: messageData.key.remoteJid });
    return;
  }

  // Дедупликация
  const messageId = messageData.key.id;
  if (messageId && isDuplicate(messageId)) {
    log.debug('Duplicate webhook skipped', { messageId });
    return;
  }

  // Получаем данные пользователя по instance name (sessionId)
  const sessionData = await sessionService.getUserByWhatsAppSession(instanceName);

  if (!sessionData) {
    log.warn('Unknown WhatsApp instance, skipping message', { instanceName });
    return;
  }

  const unifiedMessage = whatsapp.parseWebhookMessage(
    messageData,
    instanceName,
    sessionData.userId
  );

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

/**
 * Обработка обновления статуса сообщения (MESSAGES_UPDATE)
 */
async function handleMessagesUpdate(payload: EvolutionWebhookPayload): Promise<void> {
  const data = payload.data as EvolutionMessage;

  log.debug('Message status update', {
    instance: payload.instance,
    messageId: data?.key?.id,
    status: data?.status,
  });

  // Можно обновить статус сообщения в базе данных
  // TODO: Реализовать если нужно отслеживать delivered/read статусы
}

/**
 * Обработка изменения статуса подключения (CONNECTION_UPDATE)
 */
async function handleConnectionUpdate(payload: EvolutionWebhookPayload): Promise<void> {
  const data = payload.data as EvolutionConnectionUpdate;

  log.info('[Webhook:WA:CONNECTION_UPDATE] Connection changed', {
    instance: payload.instance,
    state: data?.state,
    statusReason: data?.statusReason,
    fullData: JSON.stringify(data || {}).substring(0, 500),
  });
}

/**
 * Обработка обновления QR кода (QRCODE_UPDATED)
 */
async function handleQRCodeUpdate(payload: EvolutionWebhookPayload): Promise<void> {
  const data = payload.data as EvolutionQRCodeUpdate;

  log.info('[Webhook:WA:QRCODE_UPDATED] QR code updated', {
    instance: payload.instance,
    count: data?.qrcode?.count,
    hasBase64: !!(data?.qrcode?.base64),
    base64Length: data?.qrcode?.base64?.length || 0,
  });
}

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
