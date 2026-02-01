import { Router, Request, Response } from 'express';
import { getWhatsAppService } from '../channels/whatsapp/whatsapp.service.js';
import { getTelegramService } from '../channels/telegram/telegram.service.js';
import { getInstagramService } from '../channels/instagram/instagram.service.js';
import { getRedis } from '../utils/redis.js';
import { getAIResponderService } from '../services/ai-responder.service.js';

const router = Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  const checks: Record<string, { status: string; message?: string }> = {};

  // Check Redis
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = { status: 'ok' };
  } catch (error) {
    checks.redis = { status: 'error', message: 'Redis connection failed' };
  }

  // Check WAHA
  try {
    const whatsapp = getWhatsAppService();
    const wahaOk = await whatsapp.healthCheck();
    checks.waha = wahaOk
      ? { status: 'ok' }
      : { status: 'error', message: 'WAHA not responding' };
  } catch (error) {
    checks.waha = { status: 'error', message: 'WAHA check failed' };
  }

  // Check Telegram
  try {
    const telegram = getTelegramService();
    const telegramOk = await telegram.healthCheck();
    checks.telegram = telegramOk
      ? { status: 'ok' }
      : { status: 'unavailable', message: 'Bot token not configured' };
  } catch (error) {
    checks.telegram = { status: 'error', message: 'Telegram check failed' };
  }

  // Check Instagram
  try {
    const instagram = getInstagramService();
    const instagramOk = await instagram.healthCheck();
    checks.instagram = instagramOk
      ? { status: 'ok' }
      : { status: 'unavailable', message: 'Instagram not configured' };
  } catch (error) {
    checks.instagram = { status: 'error', message: 'Instagram check failed' };
  }

  // Check AI
  const aiService = getAIResponderService();
  checks.ai = aiService.isAIAvailable()
    ? { status: 'ok' }
    : { status: 'unavailable', message: 'OpenAI not configured' };

  // Determine overall status
  const hasErrors = Object.values(checks).some((c) => c.status === 'error');
  const overallStatus = hasErrors ? 'degraded' : 'healthy';

  res.status(hasErrors ? 503 : 200).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * GET /health/ready
 * Readiness probe (for Kubernetes)
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Проверяем критические зависимости
    const redis = getRedis();
    await redis.ping();

    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready' });
  }
});

/**
 * GET /health/live
 * Liveness probe (for Kubernetes)
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

export default router;
