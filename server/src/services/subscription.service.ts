/**
 * Сервис для управления подписками и автоматического списания
 */

import { prisma } from '../db/prisma';
import { Plan, PaymentStatus, TransactionType } from '@prisma/client';
import { processWalletPayment } from './payment.service';
import { createNotification } from './notification.service';
import { NotificationType } from '@prisma/client';

/**
 * Обработка ежемесячных подписок (автоматическое списание)
 * Вызывается по расписанию (например, через cron)
 */
export async function processMonthlySubscriptions() {
  const now = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  // Находим всех пользователей с активными платными подписками
  const activeSubscriptions = await prisma.user.findMany({
    where: {
      plan: {
        in: [Plan.Pro, Plan.Business],
      },
      subscriptionAutoRenew: true,
      OR: [
        // Подписка истекает в течение 3 дней
        {
          subscriptionExpiresAt: {
            lte: threeDaysFromNow,
            gte: now,
          },
        },
        // Подписка уже истекла
        {
          subscriptionExpiresAt: {
            lt: now,
          },
        },
      ],
    },
  });

  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    notifications: 0,
  };

  for (const user of activeSubscriptions) {
    results.processed++;

    try {
      const planPrice = user.plan === Plan.Pro ? 9900 : 24900;
      const expiresAt = user.subscriptionExpiresAt;

      // Проверяем, истекла ли подписка
      const isExpired = expiresAt && expiresAt < now;
      // Проверяем, истекает ли подписка в течение 3 дней
      const expiresSoon = expiresAt && expiresAt <= threeDaysFromNow && expiresAt > now;

      // Получаем кошелек пользователя
      let wallet = await prisma.wallet.findUnique({
        where: { userId: user.id },
      });

      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: {
            userId: user.id,
            balance: 0,
            currency: '₸',
          },
        });
      }

      const balance = Number(wallet.balance);

      if (balance >= planPrice) {
        // Достаточно средств - списываем автоматически
        if (isExpired || expiresSoon) {
          await processWalletPayment({
            userId: user.id,
            plan: user.plan,
            amount: planPrice,
          });
          
          // Отправляем уведомление об успешном продлении
          try {
            await createNotification({
              userId: user.id,
              type: NotificationType.subscription_renewed,
              title: 'Подписка продлена',
              message: `Ваша подписка ${user.plan} успешно продлена. Спасибо за использование DIAR AI!`,
              data: {
                plan: user.plan,
                amount: planPrice,
              },
            });
          } catch (error: any) {
            console.error(`[subscription.service] Ошибка отправки уведомления о продлении для пользователя ${user.id}:`, error);
          }
          
          results.successful++;
          console.log(`[subscription.service] Автоматическое списание для пользователя ${user.id}, план ${user.plan}`);
        }
      } else {
        // Недостаточно средств
        if (isExpired) {
          // Деактивируем план, если подписка истекла и нет средств
          await prisma.user.update({
            where: { id: user.id },
            data: {
              plan: Plan.Free,
              subscriptionExpiresAt: null,
            },
          });
          
          // Отправляем уведомление об истечении подписки
          try {
            await createNotification({
              userId: user.id,
              type: NotificationType.subscription_expired,
              title: 'Подписка истекла',
              message: `Ваша подписка ${user.plan} истекла из-за недостаточного баланса. Пополните кошелек и продлите подписку.`,
              data: {
                plan: user.plan,
                requiredAmount: planPrice,
              },
            });
          } catch (error: any) {
            console.error(`[subscription.service] Ошибка отправки уведомления об истечении для пользователя ${user.id}:`, error);
          }
          
          results.failed++;
          console.log(`[subscription.service] Подписка деактивирована для пользователя ${user.id} (недостаточно средств)`);
        } else if (expiresSoon) {
          // Отправляем уведомление о необходимости пополнения
          try {
            const daysRemaining = expiresAt
              ? Math.ceil((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            
            await createNotification({
              userId: user.id,
              type: NotificationType.subscription_expiring,
              title: 'Подписка истекает скоро',
              message: `Ваша подписка ${user.plan} истекает через ${daysRemaining} ${daysRemaining === 1 ? 'день' : 'дня'}. Пополните кошелек для автоматического продления.`,
              data: {
                plan: user.plan,
                expiresAt: expiresAt?.toISOString(),
                daysRemaining,
              },
            });
            results.notifications++;
            console.log(`[subscription.service] Уведомление отправлено для пользователя ${user.id}`);
          } catch (error: any) {
            console.error(`[subscription.service] Ошибка отправки уведомления для пользователя ${user.id}:`, error);
          }
        }
      }
    } catch (error: any) {
      console.error(`[subscription.service] Ошибка обработки подписки для пользователя ${user.id}:`, error);
      results.failed++;
    }
  }

  return results;
}

/**
 * Проверка истечения подписок
 * Деактивирует планы пользователей, у которых истекла подписка и нет автопродления
 */
export async function checkSubscriptionExpiry() {
  const now = new Date();

  const expiredSubscriptions = await prisma.user.findMany({
    where: {
      plan: {
        in: [Plan.Pro, Plan.Business],
      },
      subscriptionExpiresAt: {
        lt: now,
      },
      subscriptionAutoRenew: false,
    },
  });

  let deactivated = 0;

  for (const user of expiredSubscriptions) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: Plan.Free,
        subscriptionExpiresAt: null,
      },
    });
    deactivated++;
    console.log(`[subscription.service] Подписка деактивирована для пользователя ${user.id} (истек срок)`);
  }

  return { deactivated };
}

/**
 * Получение информации о подписке пользователя
 */
export async function getSubscriptionInfo(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      subscriptionExpiresAt: true,
      subscriptionAutoRenew: true,
    },
  });

  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const now = new Date();
  const expiresAt = user.subscriptionExpiresAt;
  const isActive = expiresAt ? expiresAt > now : false;
  const daysRemaining = expiresAt
    ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    plan: user.plan,
    isActive,
    expiresAt,
    daysRemaining,
    autoRenew: user.subscriptionAutoRenew,
  };
}

/**
 * Отключение автопродления подписки
 */
export async function disableAutoRenew(userId: number) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionAutoRenew: false,
    },
  });
}

/**
 * Включение автопродления подписки
 */
export async function enableAutoRenew(userId: number) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionAutoRenew: true,
    },
  });
}

