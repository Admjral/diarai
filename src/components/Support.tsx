import { ArrowLeft, MessageSquare, Send, Clock, CheckCircle, XCircle, AlertCircle, Loader2, Phone, Menu, X } from 'lucide-react';
import { Screen } from '../App';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supportAPI } from '../lib/api';

interface SupportProps {
  onNavigate: (screen: Screen) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface SupportTicket {
  id: number;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  updatedAt: string;
  response?: string;
}

export function Support({ onNavigate, showToast }: SupportProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
  });

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await supportAPI.getAll();
      setTickets(data || []);
    } catch (error: any) {
      console.error('Ошибка при загрузке тикетов:', error);
      
      // Проверяем тип ошибки для более понятного сообщения
      const errorMessage = error?.message || 'Не удалось загрузить обращения';
      const isTableNotFound = errorMessage.includes('не найдена') || 
                             errorMessage.includes('does not exist') ||
                             errorMessage.includes('PRISMA_MODEL_NOT_FOUND');
      
      if (isTableNotFound) {
        showToast('Таблица техподдержки не создана. Обратитесь к администратору.', 'error');
      } else {
        showToast(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.phone.trim()) {
      showToast('Введите номер телефона', 'error');
      return;
    }

    // Простая валидация номера телефона
    const phoneRegex = /^[\d\s()+-]+$/;
    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      showToast('Введите корректный номер телефона', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await supportAPI.create({
        subject: 'Запрос на звонок',
        message: `Номер телефона для связи: ${formData.phone}`,
        priority: formData.priority,
      });
      
      showToast('Запрос отправлен! Мы перезвоним вам в течение 5 минут.', 'success');
      setFormData({ phone: '', priority: 'medium' });
      setShowForm(false);
      await loadTickets();
    } catch (error: any) {
      console.error('Ошибка при создании обращения:', error);
      showToast(error.message || 'Не удалось отправить запрос', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [formData, showToast, loadTickets]);

  const getStatusIcon = useCallback((status: SupportTicket['status']) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="w-4 h-4 text-blue-400" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'closed':
        return <XCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  }, []);

  const getStatusLabel = useCallback((status: SupportTicket['status']) => {
    const labels = {
      open: 'Открыто',
      in_progress: 'В работе',
      resolved: 'Решено',
      closed: 'Закрыто',
    };
    return labels[status] || status;
  }, []);

  const getPriorityColor = useCallback((priority: SupportTicket['priority']) => {
    const colors = {
      low: 'bg-blue-500/20 text-blue-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      high: 'bg-orange-500/20 text-orange-400',
      urgent: 'bg-red-500/20 text-red-400',
    };
    return colors[priority] || colors.medium;
  }, []);

  const getPriorityLabel = useCallback((priority: SupportTicket['priority']) => {
    const labels = {
      low: 'Низкий',
      medium: 'Средний',
      high: 'Высокий',
      urgent: 'Срочный',
    };
    return labels[priority] || priority;
  }, []);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }, []);

  const sortedTickets = useMemo(() => {
    return [...tickets].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [tickets]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black">
      {/* Header */}
      <header className="border-b border-slate-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => onNavigate('dashboard')}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-white">Техподдержка</h1>
            </div>
            {/* Mobile burger menu (empty for now, can add actions later) */}
            <div className="sm:hidden relative">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5 text-white" />
                ) : (
                  <Menu className="w-5 h-5 text-white" />
                )}
              </button>

              {mobileMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={() => setMobileMenuOpen(false)}
                  />
                  {/* Menu */}
                  <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden z-50">
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onNavigate('dashboard');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      <span>Вернуться на дашборд</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Buttons */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="tel:+77001234567"
            className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all flex items-center gap-4 group"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Phone className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold mb-1">Позвонить</h3>
              <p className="text-gray-400 text-sm">Свяжитесь с нами прямо сейчас</p>
            </div>
          </a>
          
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all flex items-center gap-4 group text-left"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <MessageSquare className="w-8 h-8 text-black" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold mb-1">
                {showForm ? 'Отменить запрос' : 'Запросить звонок'}
              </h3>
              <p className="text-gray-400 text-sm">
                {showForm ? 'Закрыть форму' : 'Мы перезвоним вам в течение 5 минут'}
              </p>
            </div>
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="mb-8 bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-white mb-4 text-xl">Запрос на звонок</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Номер телефона</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-12 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-yellow-500"
                    placeholder="+7 (___) ___-__-__"
                    disabled={submitting}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Мы перезвоним вам в течение 5 минут
                </p>
              </div>
              
              <div>
                <label className="block text-gray-300 mb-2">Приоритет</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-yellow-500"
                  disabled={submitting}
                >
                  <option value="low">Низкий</option>
                  <option value="medium">Средний</option>
                  <option value="high">Высокий</option>
                  <option value="urgent">Срочный</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4" />
                    Запросить звонок
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Tickets List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
          </div>
        ) : sortedTickets.length > 0 ? (
          <div>
            <h2 className="text-white mb-4 text-xl">Мои обращения</h2>
            
            <div className="space-y-4">
              {sortedTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-white text-lg">{ticket.subject}</h3>
                        <span className={`px-2 py-1 rounded-lg text-xs ${getPriorityColor(ticket.priority)}`}>
                          {getPriorityLabel(ticket.priority)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        {getStatusIcon(ticket.status)}
                        <span>{getStatusLabel(ticket.status)}</span>
                        <span className="text-gray-600">•</span>
                        <span>{formatDate(ticket.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-gray-300 whitespace-pre-wrap">{ticket.message}</p>
                  </div>

                  {ticket.response && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-4 h-4 text-black" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-gray-400 mb-1">Ответ поддержки</div>
                          <p className="text-gray-300 whitespace-pre-wrap">{ticket.response}</p>
                          {ticket.updatedAt !== ticket.createdAt && (
                            <div className="text-xs text-gray-500 mt-2">
                              Обновлено: {formatDate(ticket.updatedAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

