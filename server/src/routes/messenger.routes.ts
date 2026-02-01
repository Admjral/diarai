import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getConfigs,
  upsertConfig,
  deleteConfig,
  createWhatsAppSession,
  getWhatsAppQR,
  getWhatsAppStatus,
  connectTelegram,
  getInbox,
  getConversation,
  sendMessage,
  closeConversation,
  archiveConversation,
  handleWebhook,
  getSessionByWhatsAppId,
  getSessionByInstagramAccount,
  getSessionByTelegramBot,
  createLeadFromConversation,
  getConversationLead,
} from '../controllers/messenger.controller';

const router = Router();

// =====================
// CONFIG ROUTES
// =====================

// GET /api/messenger/config - получить конфигурации
router.get('/config', authMiddleware, getConfigs);

// POST /api/messenger/config - создать/обновить конфигурацию
router.post('/config', authMiddleware, upsertConfig);

// DELETE /api/messenger/config/:type - удалить конфигурацию
router.delete('/config/:type', authMiddleware, deleteConfig);

// =====================
// WHATSAPP SESSION ROUTES
// =====================

// POST /api/messenger/whatsapp/session - создать сессию
router.post('/whatsapp/session', authMiddleware, createWhatsAppSession);

// GET /api/messenger/whatsapp/qr - получить QR код
router.get('/whatsapp/qr', authMiddleware, getWhatsAppQR);

// GET /api/messenger/whatsapp/status - статус сессии
router.get('/whatsapp/status', authMiddleware, getWhatsAppStatus);

// =====================
// TELEGRAM ROUTES
// =====================

// POST /api/messenger/telegram/connect - подключить Telegram бота
router.post('/telegram/connect', authMiddleware, connectTelegram);

// =====================
// INBOX ROUTES
// =====================

// GET /api/messenger/inbox - список разговоров
router.get('/inbox', authMiddleware, getInbox);

// GET /api/messenger/inbox/:id - разговор с сообщениями
router.get('/inbox/:id', authMiddleware, getConversation);

// POST /api/messenger/inbox/:id/send - отправить сообщение
router.post('/inbox/:id/send', authMiddleware, sendMessage);

// PUT /api/messenger/inbox/:id/close - закрыть разговор
router.put('/inbox/:id/close', authMiddleware, closeConversation);

// PUT /api/messenger/inbox/:id/archive - архивировать разговор
router.put('/inbox/:id/archive', authMiddleware, archiveConversation);

// =====================
// LEAD INTEGRATION ROUTES
// =====================

// POST /api/messenger/inbox/:id/create-lead - создать лид из разговора
router.post('/inbox/:id/create-lead', authMiddleware, createLeadFromConversation);

// GET /api/messenger/inbox/:id/lead - получить лид, связанный с разговором
router.get('/inbox/:id/lead', authMiddleware, getConversationLead);

// =====================
// WEBHOOK (internal, from messenger-service)
// =====================

// POST /api/messenger/webhook - webhook от messenger-service
// Без authMiddleware - проверяем API key внутри
router.post('/webhook', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.MESSENGER_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}, handleWebhook);

// =====================
// SESSION LOOKUP (internal, for messenger-service)
// =====================

// GET /api/messenger/session/whatsapp/:sessionId - получить userId по WhatsApp sessionId
router.get('/session/whatsapp/:sessionId', getSessionByWhatsAppId);

// GET /api/messenger/session/instagram/:accountId - получить userId по Instagram account ID
router.get('/session/instagram/:accountId', getSessionByInstagramAccount);

// GET /api/messenger/session/telegram/:botId - получить userId по Telegram bot ID
router.get('/session/telegram/:botId', getSessionByTelegramBot);

export default router;
