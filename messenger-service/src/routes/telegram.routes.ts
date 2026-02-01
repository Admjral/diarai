import { Router, Request, Response } from 'express';
import { log } from '../utils/logger.js';
import { getTelegramService } from '../channels/telegram/telegram.service.js';

const router = Router();

/**
 * POST /telegram/register
 * Зарегистрировать пользователя для получения сообщений от бота
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { userId, botToken, chatId } = req.body;
    const userIdHeader = req.headers['x-user-id'] as string;

    const effectiveUserId = userId || (userIdHeader ? parseInt(userIdHeader, 10) : null);

    if (!effectiveUserId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const telegram = getTelegramService();

    // Если передан chatId - регистрируем конкретный маппинг
    if (chatId) {
      telegram.registerChatUser(chatId, effectiveUserId);
    }

    // Устанавливаем default user для бота
    telegram.setDefaultUser(effectiveUserId);

    log.info('Telegram user registered', { userId: effectiveUserId, chatId });

    res.json({
      success: true,
      message: 'User registered for Telegram messages',
      userId: effectiveUserId,
    });
  } catch (error) {
    log.error('Failed to register Telegram user', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

/**
 * POST /telegram/unregister
 * Отменить регистрацию пользователя
 */
router.post('/unregister', async (req: Request, res: Response) => {
  try {
    const { userId, chatId } = req.body;

    if (chatId) {
      const telegram = getTelegramService();
      telegram.unregisterChatUser(chatId);
    }

    log.info('Telegram user unregistered', { userId, chatId });

    res.json({
      success: true,
      message: 'User unregistered from Telegram messages',
    });
  } catch (error) {
    log.error('Failed to unregister Telegram user', error);
    res.status(500).json({ error: 'Failed to unregister user' });
  }
});

/**
 * GET /telegram/status
 * Получить статус Telegram бота
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const telegram = getTelegramService();
    const botInfo = await telegram.getBotInfo();
    const isHealthy = await telegram.healthCheck();

    res.json({
      connected: isHealthy,
      bot: botInfo,
    });
  } catch (error) {
    log.error('Failed to get Telegram status', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

export default router;
