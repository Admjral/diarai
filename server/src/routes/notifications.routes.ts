import { Router } from 'express';
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationHandler,
} from '../controllers/notifications.controller';

const router = Router();

router.get('/', getNotifications);
router.get('/unread/count', getUnreadNotificationsCount);
router.put('/:id/read', markNotificationAsRead);
router.put('/read-all', markAllNotificationsAsRead);
router.delete('/:id', deleteNotificationHandler);

export default router;

