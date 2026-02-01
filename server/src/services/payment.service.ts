/**
 * Сервис для обработки платежей за подписки
 */

import { prisma } from '../db/prisma';
import { Plan, PaymentStatus, TransactionType } from '@prisma/client';
import { createKaspiOrder, isKaspiPaymentSuccess, isKaspiPaymentFailed } from './kaspi.service';

interface ProcessWalletPaymentParams {
  userId: number;
  plan: Plan;
  amount: number;
}

interface ProcessKaspiPaymentParams {
  userId: number;
  plan: Plan;
  amount: number;
  returnUrl: string;
  cancelUrl: string;
}

/**
 * Обработка оплаты подписки через кошелек
 */
export async function processWalletPayment({
  userId,
  plan,
  amount,
}: ProcessWalletPaymentParams) {
  // Начинаем транзакцию
  return await prisma.$transaction(async (tx) => {
    // 1. Находим или создаем кошелек
    let wallet = await tx.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await tx.wallet.create({
        data: {
          userId,
          balance: 0,
          currency: '₸',
        },
      });
    }

    // 2. Проверяем достаточность средств
    const currentBalance = Number(wallet.balance);
    if (currentBalance < amount) {
      throw new Error(
        `Недостаточно средств на кошельке. Доступно: ${currentBalance} ₸, требуется: ${amount} ₸`
      );
    }

    // 3. Создаем запись о платеже
    const payment = await tx.payment.create({
      data: {
        userId,
        plan,
        amount,
        currency: '₸',
        status: PaymentStatus.processing,
        paymentMethod: 'wallet',
      },
    });

    // 4. Списываем средства с кошелька
    const newBalance = currentBalance - amount;
    wallet = await tx.wallet.update({
      where: { userId },
      data: { balance: newBalance },
    });

    // 5. Создаем транзакцию кошелька
    const walletTransaction = await tx.walletTransaction.create({
      data: {
        userId,
        walletId: wallet.id,
        type: TransactionType.subscription,
        amount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        description: `Оплата подписки ${plan}`,
        paymentId: payment.id,
      },
    });

    // 6. Обновляем платеж с ID транзакции
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        walletTransactionId: walletTransaction.id,
        status: PaymentStatus.completed,
        paidAt: new Date(),
      },
    });

    // 7. Активируем подписку
    await activateSubscription(userId, plan, tx);

    return {
      payment,
      walletTransaction,
      newBalance,
    };
  });
}

/**
 * Обработка оплаты подписки через Kaspi.kz
 */
export async function processKaspiPayment({
  userId,
  plan,
  amount,
  returnUrl,
  cancelUrl,
}: ProcessKaspiPaymentParams) {
  // 1. Создаем запись о платеже со статусом pending
  const payment = await prisma.payment.create({
    data: {
      userId,
      plan,
      amount,
      currency: '₸',
      status: PaymentStatus.pending,
      paymentMethod: 'kaspi',
    },
  });

  // 2. Создаем заказ в Kaspi.kz
  const planName = plan === Plan.Pro ? 'Pro' : 'Business';
  const kaspiOrder = await createKaspiOrder(
    amount,
    planName,
    userId,
    returnUrl,
    cancelUrl
  );

  // 3. Обновляем платеж с orderId от Kaspi
  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      kaspiOrderId: kaspiOrder.orderId,
      status: PaymentStatus.processing,
    },
  });

  return {
    payment: updatedPayment,
    paymentUrl: kaspiOrder.paymentUrl,
    orderId: kaspiOrder.orderId,
  };
}

/**
 * Обработка webhook от Kaspi.kz
 */
export async function processKaspiWebhook(
  orderId: string,
  status: string,
  paymentId?: string
) {
  // 1. Находим платеж по orderId
  const payment = await prisma.payment.findFirst({
    where: { kaspiOrderId: orderId },
  });

  if (!payment) {
    throw new Error(`Платеж с orderId ${orderId} не найден`);
  }

  // 2. Проверяем статус платежа
  if (isKaspiPaymentSuccess(status)) {
    // Платеж успешен - активируем подписку
    return await prisma.$transaction(async (tx) => {
      // Обновляем статус платежа
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.completed,
          paidAt: new Date(),
          kaspiPaymentId: paymentId,
        },
      });

      // Активируем подписку
      await activateSubscription(payment.userId, payment.plan, tx);

      return updatedPayment;
    });
  } else if (isKaspiPaymentFailed(status)) {
    // Платеж неудачен
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.failed,
      },
    });
  }

  return payment;
}

/**
 * Активация подписки пользователя
 */
export async function activateSubscription(
  userId: number,
  plan: Plan,
  tx?: any
) {
  const prismaClient = tx || prisma;

  // Вычисляем дату истечения подписки (30 дней от текущей даты)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Обновляем план пользователя и дату истечения
  await prismaClient.user.update({
    where: { id: userId },
    data: {
      plan,
      subscriptionExpiresAt: expiresAt,
      subscriptionAutoRenew: true,
    },
  });
}

/**
 * Получение истории платежей пользователя
 */
export async function getPaymentHistory(userId: number) {
  return await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Получение информации о платеже
 */
export async function getPaymentById(paymentId: number, userId: number) {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      userId,
    },
  });

  if (!payment) {
    throw new Error('Платеж не найден');
  }

  return payment;
}

