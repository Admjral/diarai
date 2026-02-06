import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { serviceAuthMiddleware } from '../middleware/auth.js';
import { log } from '../utils/logger.js';
import { getWhatsAppService } from '../channels/whatsapp/whatsapp.service.js';
import { getTelegramService } from '../channels/telegram/telegram.service.js';
import { getInstagramService } from '../channels/instagram/instagram.service.js';

const router = Router();

// Применяем auth ко всем роутам
router.use(serviceAuthMiddleware);

/**
 * POST /session/whatsapp
 * Создать WhatsApp сессию
 */
router.post('/whatsapp', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ success: false, error: 'sessionId required' });
      return;
    }

    const whatsapp = getWhatsAppService();
    const session = await whatsapp.createSession(sessionId);

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    log.error('Create WhatsApp session error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session',
    });
  }
});

/**
 * GET /session/whatsapp/:sessionId/qr
 * Получить QR код для WhatsApp авторизации
 */
router.get('/whatsapp/:sessionId/qr', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const whatsapp = getWhatsAppService();
    const qr = await whatsapp.getQRCode(sessionId);

    res.json({
      success: true,
      data: qr,
    });
  } catch (error) {
    log.error('Get QR code error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get QR code',
    });
  }
});

/**
 * GET /session/whatsapp/:sessionId/status
 * Получить статус WhatsApp сессии
 * Возвращает WAHA-совместимые статусы для frontend
 */
router.get('/whatsapp/:sessionId/status', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const whatsapp = getWhatsAppService();
    const instance = await whatsapp.getSessionStatus(sessionId);

    // Маппим Evolution статус в WAHA-совместимый формат
    const wahaStatus = whatsapp.mapConnectionStatus(instance.status);
    const isConnected = whatsapp.isConnected(instance.status);

    res.json({
      success: true,
      data: {
        ...instance,
        status: wahaStatus, // WORKING, STOPPED, SCAN_QR_CODE, etc.
        evolutionStatus: instance.status, // Оригинальный статус Evolution API
        isConnected,
      },
    });
  } catch (error) {
    log.error('Get session status error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session status',
    });
  }
});

/**
 * DELETE /session/whatsapp/:sessionId
 * Удалить WhatsApp сессию
 */
router.delete('/whatsapp/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const whatsapp = getWhatsAppService();
    await whatsapp.deleteSession(sessionId);

    res.json({
      success: true,
      message: 'Session deleted',
    });
  } catch (error) {
    log.error('Delete session error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session',
    });
  }
});

/**
 * GET /session/telegram/info
 * Получить информацию о Telegram боте
 */
router.get('/telegram/info', async (req: Request, res: Response) => {
  try {
    const telegram = getTelegramService();
    const info = await telegram.getBotInfo();

    if (!info) {
      res.status(404).json({
        success: false,
        error: 'Telegram bot not configured',
      });
      return;
    }

    res.json({
      success: true,
      data: info,
    });
  } catch (error) {
    log.error('Get Telegram info error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bot info',
    });
  }
});

/**
 * GET /session/instagram/info
 * Получить информацию об Instagram аккаунте
 */
router.get('/instagram/info', async (req: Request, res: Response) => {
  try {
    const instagram = getInstagramService();
    const info = await instagram.getAccountInfo();

    if (!info) {
      res.status(404).json({
        success: false,
        error: 'Instagram not configured',
      });
      return;
    }

    res.json({
      success: true,
      data: info,
    });
  } catch (error) {
    log.error('Get Instagram info error', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get account info',
    });
  }
});

export default router;
