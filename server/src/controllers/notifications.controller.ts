import { Request, Response } from 'express';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
} from '../services/notification.service';

/**
 * Получить все уведомления пользователя
 */
export async function getNotifications(req: Request, res: Response) {
  try {
    const userId = parseInt(String(req.user!.userId));
    const read = req.query.read === 'true' ? true : req.query.read === 'false' ? false : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const notifications = await getUserNotifications(userId, {
      read,
      limit,
      offset,
    });

    res.json({ notifications });
  } catch (error: any) {
    console.error('[notifications.controller] Ошибка получения уведомлений:', error);
    res.status(500).json({ error: 'Ошибка получения уведомлений' });
  }
}

/**
 * Получить количество непрочитанных уведомлений
 */
export async function getUnreadNotificationsCount(req: Request, res: Response) {
  try {
    const userId = parseInt(String(req.user!.userId));
    const count = await getUnreadCount(userId);
    res.json({ count });
  } catch (error: any) {
    console.error('[notifications.controller] Ошибка получения количества уведомлений:', error);
    res.status(500).json({ error: 'Ошибка получения количества уведомлений' });
  }
}

/**
 * Отметить уведомление как прочитанное
 */
export async function markNotificationAsRead(req: Request, res: Response) {
  try {
    const userId = parseInt(String(req.user!.userId));
    const notificationId = parseInt(req.params.id);

    const notification = await markAsRead(notificationId, userId);
    res.json({ notification });
  } catch (error: any) {
    console.error('[notifications.controller] Ошибка отметки уведомления:', error);
    if (error.message === 'Уведомление не найдено') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Ошибка отметки уведомления' });
    }
  }
}

/**
 * Отметить все уведомления как прочитанные
 */
export async function markAllNotificationsAsRead(req: Request, res: Response) {
  try {
    const userId = parseInt(String(req.user!.userId));
    const result = await markAllAsRead(userId);
    res.json({ updated: result.count });
  } catch (error: any) {
    console.error('[notifications.controller] Ошибка отметки всех уведомлений:', error);
    res.status(500).json({ error: 'Ошибка отметки всех уведомлений' });
  }
}

/**
 * Удалить уведомление
 */
export async function deleteNotificationHandler(req: Request, res: Response) {
  try {
    const userId = parseInt(String(req.user!.userId));
    const notificationId = parseInt(req.params.id);

    await deleteNotification(notificationId, userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[notifications.controller] Ошибка удаления уведомления:', error);
    if (error.message === 'Уведомление не найдено') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Ошибка удаления уведомления' });
    }
  }
}

