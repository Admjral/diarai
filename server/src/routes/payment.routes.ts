import { Router } from 'express';
import {
  subscribe,
  createKaspiOrder,
  handleKaspiWebhook,
  getPaymentHistoryHandler,
  getPayment,
} from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { webhookLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// Все маршруты требуют аутентификации, кроме webhook
// POST /api/payments/subscribe - создать платеж за подписку
router.post('/subscribe', authMiddleware, subscribe);

// POST /api/payments/kaspi/create-order - создать заказ в Kaspi
router.post('/kaspi/create-order', authMiddleware, createKaspiOrder);

// POST /api/payments/kaspi/webhook - обработка webhook от Kaspi (без аутентификации, проверка подписи внутри)
router.post('/kaspi/webhook', webhookLimiter, handleKaspiWebhook);

// GET /api/payments/history - получить историю платежей
router.get('/history', authMiddleware, getPaymentHistoryHandler);

// GET /api/payments/:id - получить информацию о платеже
router.get('/:id', authMiddleware, getPayment);

export default router;

