/**
 * Сервис для отправки уведомлений (Email и Push)
 */

import { prisma } from '../db/prisma';
import { NotificationType } from '@prisma/client';
import { log } from '../utils/logger';

// Интерфейсы
interface NotificationData {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Email сервис можно настроить через Resend, SendGrid и т.д.
// Для этого добавьте соответствующие переменные окружения
const emailServiceConfigured = !!process.env.EMAIL_API_KEY;

/**
 * Создание уведомления в базе данных
 */
export async function createNotification(data: NotificationData) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data || {},
      },
    });

    // Отправляем email и push уведомления асинхронно
    sendEmailNotification(notification).catch(err => {
      console.error(`[notification.service] Ошибка отправки email для уведомления ${notification.id}:`, err);
    });

    sendPushNotification(notification).catch(err => {
      console.error(`[notification.service] Ошибка отправки push для уведомления ${notification.id}:`, err);
    });

    return notification;
  } catch (error: any) {
    console.error('[notification.service] Ошибка создания уведомления:', error);
    throw error;
  }
}

/**
 * Отправка email уведомления
 */
async function sendEmailNotification(notification: any) {
  try {
    // Получаем пользователя для email
    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { email: true, name: true },
    });

    if (!user || !user.email) {
      console.warn(`[notification.service] Пользователь ${notification.userId} не найден или email отсутствует`);
      return;
    }

    // Проверяем настройки уведомлений пользователя (можно добавить в будущем)
    // Пока отправляем все уведомления

    const emailOptions = getEmailTemplate(notification, user.name || user.email);

    // Отправка email через внешний сервис (Resend, SendGrid и т.д.)
    if (emailServiceConfigured) {
      // TODO: Интегрировать с сервисом отправки email
      // Пример с Resend:
      // await resend.emails.send({
      //   from: 'noreply@diarai.com',
      //   to: user.email,
      //   subject: emailOptions.subject,
      //   html: emailOptions.html,
      // });
      log.info('Email notification queued', { email: user.email, subject: emailOptions.subject });
    } else {
      log.debug('Email service not configured, notification logged only', {
        email: user.email,
        subject: emailOptions.subject
      });
    }

    // Обновляем статус отправки email
    await prisma.notification.update({
      where: { id: notification.id },
      data: { emailSent: true },
    });
  } catch (error: any) {
    console.error('[notification.service] Ошибка отправки email:', error);
    // Не пробрасываем ошибку, чтобы не блокировать создание уведомления
  }
}

/**
 * Отправка push уведомления
 */
async function sendPushNotification(notification: any) {
  try {
    // TODO: Реализовать отправку push уведомлений через Web Push API
    // Для этого нужно:
    // 1. Сохранять subscription пользователя в БД
    // 2. Использовать web-push библиотеку для отправки
    // 3. Обрабатывать VAPID keys

    console.log(`[notification.service] Push уведомление для пользователя ${notification.userId}:`, notification.title);
    
    // Обновляем статус отправки push
    await prisma.notification.update({
      where: { id: notification.id },
      data: { pushSent: true },
    });
  } catch (error: any) {
    console.error('[notification.service] Ошибка отправки push:', error);
  }
}

/**
 * Получение шаблона email для типа уведомления
 */
function getEmailTemplate(notification: any, userName: string): EmailOptions {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  const templates: Record<NotificationType, EmailOptions> = {
    subscription_expiring: {
      to: '', // Будет установлен позже
      subject: 'Подписка истекает скоро',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Подписка истекает скоро</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
          <p><a href="${baseUrl}/subscription" style="background: #fbbf24; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Продлить подписку</a></p>
        </div>
      `,
    },
    subscription_expired: {
      to: '',
      subject: 'Подписка истекла',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Подписка истекла</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
          <p><a href="${baseUrl}/subscription" style="background: #fbbf24; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Продлить подписку</a></p>
        </div>
      `,
    },
    subscription_renewed: {
      to: '',
      subject: 'Подписка продлена',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Подписка успешно продлена</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
        </div>
      `,
    },
    wallet_low_balance: {
      to: '',
      subject: 'Низкий баланс кошелька',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Низкий баланс кошелька</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
          <p><a href="${baseUrl}/wallet" style="background: #fbbf24; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Пополнить кошелек</a></p>
        </div>
      `,
    },
    wallet_deposit: {
      to: '',
      subject: 'Кошелек пополнен',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Кошелек пополнен</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
        </div>
      `,
    },
    new_lead: {
      to: '',
      subject: 'Новый лид',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Новый лид</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
          <p><a href="${baseUrl}/crm" style="background: #fbbf24; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Открыть CRM</a></p>
        </div>
      `,
    },
    deal_closed: {
      to: '',
      subject: 'Сделка закрыта',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Сделка закрыта</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
          <p><a href="${baseUrl}/crm" style="background: #fbbf24; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Открыть CRM</a></p>
        </div>
      `,
    },
    task_overdue: {
      to: '',
      subject: 'Просроченная задача',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Просроченная задача</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
          <p><a href="${baseUrl}/crm" style="background: #fbbf24; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Открыть задачи</a></p>
        </div>
      `,
    },
    campaign_completed: {
      to: '',
      subject: 'Кампания завершена',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Кампания завершена</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
          <p><a href="${baseUrl}/ai-advertising" style="background: #fbbf24; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Открыть кампании</a></p>
        </div>
      `,
    },
    payment_success: {
      to: '',
      subject: 'Платеж успешно обработан',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Платеж успешно обработан</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
        </div>
      `,
    },
    payment_failed: {
      to: '',
      subject: 'Ошибка платежа',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Ошибка платежа</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
          <p><a href="${baseUrl}/wallet" style="background: #fbbf24; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Попробовать снова</a></p>
        </div>
      `,
    },
    support_response: {
      to: '',
      subject: 'Ответ на обращение в техподдержку',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Ответ на обращение</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
          <p><a href="${baseUrl}/support" style="background: #fbbf24; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Открыть обращение</a></p>
        </div>
      `,
    },
    system_announcement: {
      to: '',
      subject: notification.title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${notification.title}</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
        </div>
      `,
    },
    messenger_new_message: {
      to: '',
      subject: 'Новое сообщение от клиента',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Новое сообщение</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
          <p><a href="${baseUrl}/inbox" style="background: #fbbf24; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Открыть Inbox</a></p>
        </div>
      `,
    },
    messenger_escalation: {
      to: '',
      subject: 'Требуется внимание оператора',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Эскалация сообщения</h2>
          <p>Здравствуйте, ${userName}!</p>
          <p>${notification.message}</p>
          <p><a href="${baseUrl}/inbox" style="background: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Срочно открыть Inbox</a></p>
        </div>
      `,
    },
  };

  const notificationType = notification.type as NotificationType;
  const template = templates[notificationType] || templates.system_announcement;
  template.to = ''; // Будет установлен в sendEmailNotification
  return template;
}

/**
 * Получение всех уведомлений пользователя
 */
export async function getUserNotifications(userId: number, options?: {
  read?: boolean;
  limit?: number;
  offset?: number;
}) {
  const where: any = { userId };
  
  if (options?.read !== undefined) {
    where.read = options.read;
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  });

  return notifications;
}

/**
 * Отметить уведомление как прочитанное
 */
export async function markAsRead(notificationId: number, userId: number) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new Error('Уведомление не найдено');
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
}

/**
 * Отметить все уведомления как прочитанные
 */
export async function markAllAsRead(userId: number) {
  return await prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
}

/**
 * Получить количество непрочитанных уведомлений
 */
export async function getUnreadCount(userId: number) {
  return await prisma.notification.count({
    where: {
      userId,
      read: false,
    },
  });
}

/**
 * Удалить уведомление
 */
export async function deleteNotification(notificationId: number, userId: number) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new Error('Уведомление не найдено');
  }

  return await prisma.notification.delete({
    where: { id: notificationId },
  });
}

