/**
 * Контроллер для обработки платежей за подписки
 */

import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { Plan, TransactionType } from '@prisma/client';
import {
  processWalletPayment,
  processKaspiPayment,
  processKaspiWebhook,
  getPaymentHistory,
  getPaymentById,
} from '../services/payment.service';
import { verifyKaspiWebhook, isKaspiPaymentSuccess, isKaspiPaymentFailed } from '../services/kaspi.service';

/**
 * Создание платежа за подписку
 * POST /api/payments/subscribe
 */
export async function subscribe(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;
    const { plan, paymentMethod } = req.body;

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    if (!plan || !['Pro', 'Business'].includes(plan)) {
      return res.status(400).json({ 
        error: 'Неверный план подписки. Допустимые значения: Pro, Business' 
      });
    }

    if (!paymentMethod || !['wallet', 'kaspi'].includes(paymentMethod)) {
      return res.status(400).json({ 
        error: 'Неверный способ оплаты. Допустимые значения: wallet, kaspi' 
      });
    }

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Определяем цену плана
    const planPrice = plan === 'Pro' ? 9900 : 24900;
    const planEnum = plan === 'Pro' ? Plan.Pro : Plan.Business;

    // Получаем URL фронтенда из переменных окружения
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const cancelUrl = `${frontendUrl}/subscription?status=cancelled`;

    if (paymentMethod === 'wallet') {
      // Оплата через кошелек
      const result = await processWalletPayment({
        userId: user.id,
        plan: planEnum,
        amount: planPrice,
      });

      return res.json({
        success: true,
        payment: result.payment,
        walletTransaction: result.walletTransaction,
        newBalance: result.newBalance,
        message: 'Подписка успешно активирована',
      });
    } else {
      // Оплата через Kaspi
      const returnUrl = `${frontendUrl}/subscription?status=success`;
      const result = await processKaspiPayment({
        userId: user.id,
        plan: planEnum,
        amount: planPrice,
        returnUrl,
        cancelUrl,
      });

      return res.json({
        success: true,
        payment: result.payment,
        paymentUrl: result.paymentUrl,
        orderId: result.orderId,
        message: 'Заказ создан. Перенаправление на оплату...',
      });
    }
  } catch (error: any) {
    console.error('[payment.controller] Ошибка при создании платежа:', error);
    
    if (error.message?.includes('Недостаточно средств')) {
      return res.status(400).json({ 
        error: error.message,
        code: 'INSUFFICIENT_FUNDS',
      });
    }

    return res.status(500).json({ 
      error: 'Ошибка при создании платежа',
      message: error.message || 'Неизвестная ошибка',
    });
  }
}

/**
 * Создание заказа в Kaspi.kz
 * POST /api/payments/kaspi/create-order
 */
export async function createKaspiOrder(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;
    const { plan, amount } = req.body;

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    if (!plan || !['Pro', 'Business'].includes(plan)) {
      return res.status(400).json({ 
        error: 'Неверный план подписки' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const planPrice = amount || (plan === 'Pro' ? 9900 : 24900);
    const planEnum = plan === 'Pro' ? Plan.Pro : Plan.Business;
    const planName = plan;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const returnUrl = `${frontendUrl}/subscription?status=success`;
    const cancelUrl = `${frontendUrl}/subscription?status=cancelled`;

    const result = await processKaspiPayment({
      userId: user.id,
      plan: planEnum,
      amount: planPrice,
      returnUrl,
      cancelUrl,
    });

    return res.json({
      success: true,
      paymentUrl: result.paymentUrl,
      orderId: result.orderId,
      payment: result.payment,
    });
  } catch (error: any) {
    console.error('[payment.controller] Ошибка при создании заказа Kaspi:', error);
    return res.status(500).json({ 
      error: 'Ошибка при создании заказа',
      message: error.message || 'Неизвестная ошибка',
    });
  }
}

/**
 * Обработка webhook от Kaspi.kz
 * POST /api/payments/kaspi/webhook
 */
export async function handleKaspiWebhook(req: Request, res: Response) {
  try {
    const { orderId, status, paymentId, signature } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ 
        error: 'Отсутствуют обязательные поля: orderId, status' 
      });
    }

    // Проверяем подпись webhook (если настроена)
    if (signature) {
      const isValid = verifyKaspiWebhook(req.body, signature);
      if (!isValid) {
        console.warn('[payment.controller] Неверная подпись webhook от Kaspi');
        return res.status(401).json({ error: 'Неверная подпись webhook' });
      }
    }

    // Проверяем тип заказа: если orderId начинается с "wallet_", это пополнение кошелька
    if (orderId.startsWith('wallet_')) {
      // Обрабатываем пополнение кошелька
      const result = await processKaspiWalletDepositWebhook(orderId, status, paymentId);
      return res.json({
        success: true,
        message: 'Webhook пополнения кошелька обработан успешно',
        transactionId: result.transactionId,
      });
    } else {
      // Обрабатываем платеж за подписку
      const payment = await processKaspiWebhook(orderId, status, paymentId);
      return res.json({
        success: true,
        message: 'Webhook обработан успешно',
        paymentId: payment.id,
      });
    }
  } catch (error: any) {
    console.error('[payment.controller] Ошибка при обработке webhook Kaspi:', error);
    
    // Все равно отправляем 200, чтобы Kaspi не повторял запрос
    return res.status(200).json({
      success: false,
      error: error.message || 'Ошибка обработки webhook',
    });
  }
}

/**
 * Получение истории платежей пользователя
 * GET /api/payments/history
 */
export async function getPaymentHistoryHandler(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const payments = await getPaymentHistory(user.id);

    return res.json({
      payments,
      total: payments.length,
    });
  } catch (error: any) {
    console.error('[payment.controller] Ошибка при получении истории платежей:', error);
    return res.status(500).json({ 
      error: 'Ошибка при получении истории платежей',
      message: error.message || 'Неизвестная ошибка',
    });
  }
}

/**
 * Получение информации о конкретном платеже
 * GET /api/payments/:id
 */
export async function getPayment(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;
    const paymentId = parseInt(req.params.id);

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    if (isNaN(paymentId)) {
      return res.status(400).json({ error: 'Неверный ID платежа' });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const payment = await getPaymentById(paymentId, user.id);

    return res.json(payment);
  } catch (error: any) {
    console.error('[payment.controller] Ошибка при получении платежа:', error);
    
    if (error.message === 'Платеж не найден') {
      return res.status(404).json({ error: error.message });
    }

    return res.status(500).json({ 
      error: 'Ошибка при получении платежа',
      message: error.message || 'Неизвестная ошибка',
    });
  }
}

/**
 * Обработка webhook от Kaspi.kz для пополнения кошелька
 */
async function processKaspiWalletDepositWebhook(
  orderId: string,
  status: string,
  paymentId?: string
) {
  // Извлекаем userId из orderId (формат: wallet_userId_timestamp_random)
  const parts = orderId.split('_');
  if (parts.length < 2) {
    throw new Error(`Неверный формат orderId для пополнения кошелька: ${orderId}`);
  }

  // Находим транзакцию по описанию, которое содержит orderId
  const transaction = await prisma.walletTransaction.findFirst({
    where: {
      description: {
        contains: orderId,
      },
      type: TransactionType.deposit,
    },
  });

  if (!transaction) {
    throw new Error(`Транзакция с orderId ${orderId} не найдена`);
  }

  // Проверяем статус платежа
  if (isKaspiPaymentSuccess(status)) {
    // Платеж успешен - пополняем кошелек
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: transaction.walletId },
      });

      if (!wallet) {
        throw new Error('Кошелек не найден');
      }

      // Обновляем баланс
      const newBalance = Number(wallet.balance) + Number(transaction.amount);
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      // Обновляем транзакцию
      const updatedTransaction = await tx.walletTransaction.update({
        where: { id: transaction.id },
        data: {
          balanceAfter: newBalance,
          description: `Пополнение через Kaspi (заказ: ${orderId}, статус: успешно)`,
        },
      });

      return {
        transactionId: updatedTransaction.id,
        newBalance,
      };
    });
  } else if (isKaspiPaymentFailed(status)) {
    // Платеж неудачен - обновляем описание транзакции
    await prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        description: `Пополнение через Kaspi (заказ: ${orderId}, статус: неудачно)`,
      },
    });
  }

  return {
    transactionId: transaction.id,
  };
}

