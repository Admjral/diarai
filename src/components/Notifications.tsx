import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Bell, Check, CheckCheck, Trash2, X, Loader2, Filter } from 'lucide-react';
import type { Screen } from '../types';
import { notificationsAPI, type Notification } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';

interface NotificationsProps {
  onNavigate: (screen: Screen) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type FilterType = 'all' | 'unread' | 'read';

export function Notifications({ onNavigate, showToast }: NotificationsProps) {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<FilterType>('all');
  const [markingAsRead, setMarkingAsRead] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const [notificationsData, countData] = await Promise.all([
        notificationsAPI.getAll({ limit: 100 }),
        notificationsAPI.getUnreadCount(),
      ]);
      setNotifications(notificationsData.notifications);
      setUnreadCount(countData.count);
    } catch (error: any) {
      console.error('Ошибка при загрузке уведомлений:', error);
      showToast(t.notifications.loadError, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    loadNotifications();
    
    // Автообновление каждые 30 секунд
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkAsRead = async (id: number) => {
    try {
      setMarkingAsRead(id);
      await notificationsAPI.markAsRead(id);
      await loadNotifications();
      showToast(t.notifications.markReadSuccess, 'success');
    } catch (error: any) {
      console.error('Ошибка при отметке уведомления:', error);
      showToast(t.notifications.markReadError, 'error');
    } finally {
      setMarkingAsRead(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAllAsRead(true);
      await notificationsAPI.markAllAsRead();
      await loadNotifications();
      showToast(t.notifications.markAllReadSuccess, 'success');
    } catch (error: any) {
      console.error('Ошибка при отметке всех уведомлений:', error);
      showToast(t.notifications.markAllReadError, 'error');
    } finally {
      setMarkingAllAsRead(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setDeleting(id);
      await notificationsAPI.delete(id);
      await loadNotifications();
      showToast(t.notifications.deleteSuccess, 'success');
    } catch (error: any) {
      console.error('Ошибка при удалении уведомления:', error);
      showToast(t.notifications.deleteError, 'error');
    } finally {
      setDeleting(null);
    }
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'unread') return !notification.read;
    if (filter === 'read') return notification.read;
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'subscription_expiring':
      case 'subscription_expired':
      case 'subscription_renewed':
        return '💳';
      case 'wallet_low_balance':
      case 'wallet_deposit':
        return '💰';
      case 'new_lead':
        return '👤';
      case 'deal_closed':
        return '🤝';
      case 'task_overdue':
        return '⏰';
      case 'campaign_completed':
        return '📊';
      case 'payment_success':
        return '✅';
      case 'payment_failed':
        return '❌';
      case 'support_response':
        return '💬';
      case 'system_announcement':
        return '📢';
      default:
        return '🔔';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'subscription_expiring':
      case 'task_overdue':
        return 'from-orange-500 to-red-500';
      case 'subscription_expired':
      case 'payment_failed':
        return 'from-red-500 to-pink-500';
      case 'subscription_renewed':
      case 'payment_success':
      case 'deal_closed':
        return 'from-green-500 to-emerald-500';
      case 'new_lead':
        return 'from-blue-500 to-cyan-500';
      case 'wallet_low_balance':
        return 'from-yellow-500 to-orange-500';
      case 'wallet_deposit':
        return 'from-green-500 to-teal-500';
      default:
        return 'from-purple-500 to-blue-500';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t.notifications.timeAgo.justNow;
    if (minutes < 60) {
      const minutesText = minutes === 1 
        ? t.notifications.timeAgo.minute 
        : (minutes < 5 ? t.notifications.timeAgo.minutes2to4 : t.notifications.timeAgo.minutes);
      return `${minutes} ${minutesText}`;
    }
    if (hours < 24) {
      const hoursText = hours === 1 
        ? t.notifications.timeAgo.hour 
        : (hours < 5 ? t.notifications.timeAgo.hours2to4 : t.notifications.timeAgo.hours);
      return `${hours} ${hoursText}`;
    }
    if (days < 7) {
      const daysText = days === 1 
        ? t.notifications.timeAgo.day 
        : (days < 5 ? t.notifications.timeAgo.days2to4 : t.notifications.timeAgo.days);
      return `${days} ${daysText}`;
    }
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black">
      {/* Header */}
      <header className="border-b border-slate-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-yellow-400" />
              <h1 className="text-white text-xl font-semibold">{t.notifications.title}</h1>
              {unreadCount > 0 && (
                <span className="px-2 py-1 rounded-full bg-red-500 text-white text-xs font-semibold">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={markingAllAsRead}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {markingAllAsRead ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCheck className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{t.notifications.markAll}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Фильтры */}
        <div className="mb-6 flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-yellow-400 text-black'
                : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
            }`}
          >
            {t.notifications.filters.all} ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'unread'
                ? 'bg-yellow-400 text-black'
                : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
            }`}
          >
            {t.notifications.filters.unread} ({unreadCount})
          </button>
          <button
            onClick={() => setFilter('read')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'read'
                ? 'bg-yellow-400 text-black'
                : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
            }`}
          >
            {t.notifications.filters.read} ({notifications.length - unreadCount})
          </button>
        </div>

        {/* Список уведомлений */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">
              {filter === 'unread' 
                ? t.notifications.noUnread 
                : filter === 'read'
                ? t.notifications.noRead
                : t.notifications.noNotifications}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-slate-800/50 border rounded-2xl p-6 transition-all ${
                  notification.read
                    ? 'border-slate-700 opacity-75'
                    : 'border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Иконка */}
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-r ${getNotificationColor(
                      notification.type
                    )} flex items-center justify-center text-2xl flex-shrink-0`}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Контент */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <h3 className={`text-white font-semibold mb-1 ${notification.read ? '' : 'font-bold'}`}>
                          {notification.title}
                        </h3>
                        <p className="text-gray-400 text-sm">{notification.message}</p>
                      </div>
                      {!notification.read && (
                        <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0 mt-2" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-gray-500 text-xs">
                        {formatDate(notification.createdAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        {!notification.read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            disabled={markingAsRead === notification.id}
                            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                            title={t.notifications.markAsRead}
                          >
                            {markingAsRead === notification.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          disabled={deleting === notification.id}
                          className="p-2 rounded-lg bg-slate-700 hover:bg-red-600 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                          title={t.notifications.delete}
                        >
                          {deleting === notification.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

