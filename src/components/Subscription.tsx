import { useState } from 'react';
import { ArrowLeft, Check, Sparkles, Zap, Crown, MessageCircle, Menu, X } from 'lucide-react';
import { Screen } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../lib/api';

interface SubscriptionProps {
  user: { name: string; plan: 'Free' | 'Pro' | 'Business' } | null;
  onNavigate: (screen: Screen) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onPlanUpdate?: (plan: 'Free' | 'Pro' | 'Business') => void;
}

export function Subscription({ user, onNavigate, showToast, onPlanUpdate }: SubscriptionProps) {
  const { user: supabaseUser } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handlePlanSelect = async (planName: string) => {
    // Преобразуем название плана в формат enum
    const planMap: Record<string, 'Free' | 'Pro' | 'Business'> = {
      'FREE': 'Free',
      'PRO': 'Pro',
      'BUSINESS': 'Business',
    };

    const plan = planMap[planName];
    if (!plan) {
      showToast('Неверный план подписки', 'error');
      return;
    }

    // Если это текущий план, ничего не делаем
    if (user?.plan === plan) {
      return;
    }

    setLoading(planName);

    try {
      const userEmail = supabaseUser?.email;
      const userId = supabaseUser?.id;

      if (!userEmail || !userId) {
        showToast('Ошибка: пользователь не авторизован', 'error');
        setLoading(null);
        return;
      }

      // Обновляем план в БД
      const updatedProfile = await userAPI.updatePlan(plan, userId, userEmail);

      // Обновляем локальное состояние через callback
      if (onPlanUpdate) {
        onPlanUpdate(updatedProfile.plan);
      }

      showToast(
        plan === 'Free'
          ? `План успешно изменен на ${planName}`
          : `План ${planName} выбран. Перенаправляем на оплату...`,
        'success'
      );
    } catch (error: any) {
      console.error('Ошибка при обновлении плана:', error);
      showToast(
        error.message || 'Ошибка при обновлении плана подписки',
        'error'
      );
    } finally {
      setLoading(null);
    }
  };
  const plans = [
    {
      name: 'FREE',
      price: '₸0',
      period: 'навсегда',
      icon: <Sparkles className="w-8 h-8" />,
      gradient: 'from-gray-600 to-gray-800',
      features: [
        { text: 'До 10 клиентов в CRM', included: true },
        { text: 'Базовая аналитика', included: true },
        { text: '1 интеграция', included: true },
        { text: 'Email поддержка', included: true },
        { text: 'AI оптимизация рекламы', included: false },
        { text: 'Приоритетная поддержка', included: false },
        { text: 'Брендированные отчеты', included: false },
      ],
      current: user?.plan === 'Free',
    },
    {
      name: 'PRO',
      price: '₸9,900',
      period: 'в месяц',
      icon: <Zap className="w-8 h-8" />,
      gradient: 'from-blue-500 to-purple-600',
      popular: true,
      features: [
        { text: 'До 100 клиентов в CRM', included: true },
        { text: 'Расширенная аналитика', included: true },
        { text: '5 интеграций', included: true },
        { text: 'AI оптимизация рекламы', included: true },
        { text: 'Чат-боты для Instagram/Telegram', included: true },
        { text: 'Приоритетная поддержка', included: true },
        { text: 'Брендированные отчеты', included: false },
      ],
      current: user?.plan === 'Pro',
    },
    {
      name: 'BUSINESS',
      price: '₸24,900',
      period: 'в месяц',
      icon: <Crown className="w-8 h-8" />,
      gradient: 'from-yellow-400 to-amber-600',
      features: [
        { text: 'Неограниченное количество клиентов', included: true },
        { text: 'Полная аналитика + BI', included: true },
        { text: 'Все интеграции', included: true },
        { text: 'AI оптимизация рекламы', included: true },
        { text: 'Мультиканальные чат-боты', included: true },
        { text: 'VIP поддержка 24/7', included: true },
        { text: 'Брендированные отчеты', included: true },
      ],
      current: user?.plan === 'Business',
    },
  ];

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
            <h1 className="text-white">Подписка</h1>
            {/* Desktop menu */}
            <div className="hidden sm:flex items-center gap-4 ml-auto">
              <button
                onClick={() => onNavigate('support')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Техподдержка</span>
              </button>
            </div>
            {/* Mobile burger menu */}
            <div className="sm:hidden relative ml-auto">
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
                        onNavigate('support');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>Техподдержка</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-white mb-4">Выберите тариф</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Начните с бесплатного плана или выберите Pro/Business для полного доступа к AI-инструментам
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-slate-800/50 border rounded-2xl p-8 transition-all ${
                plan.popular
                  ? 'border-yellow-500 scale-105'
                  : plan.current
                  ? 'border-green-500'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-full">
                  Популярный
                </div>
              )}

              {/* Current Plan Badge */}
              {plan.current && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-full flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Текущий план
                </div>
              )}

              {/* Icon */}
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${plan.gradient} flex items-center justify-center mb-6`}>
                {plan.icon}
              </div>

              {/* Plan Name */}
              <h2 className="text-white mb-2">{plan.name}</h2>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-white">{plan.price}</span>
                  <span className="text-gray-400">{plan.period}</span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li
                    key={featureIndex}
                    className={`flex items-start gap-3 ${
                      feature.included ? 'text-gray-300' : 'text-gray-600'
                    }`}
                  >
                    <div className="flex-shrink-0 mt-1">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-green-400" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-600"></div>
                      )}
                    </div>
                    <span>{feature.text}</span>
                  </li>
                ))}
              </ul>

              {/* Кнопка призыва к действию */}
              {plan.current ? (
                <button
                  disabled
                  className="w-full py-4 bg-slate-700 text-gray-400 rounded-xl cursor-not-allowed"
                >
                  Текущий план
                </button>
              ) : (
                <button
                  onClick={() => handlePlanSelect(plan.name)}
                  disabled={loading === plan.name}
                  className={`w-full py-4 rounded-xl transition-all ${
                    loading === plan.name
                      ? 'opacity-50 cursor-not-allowed'
                      : plan.popular
                      ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black hover:shadow-lg hover:shadow-yellow-500/50'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  {loading === plan.name
                    ? 'Обновление...'
                    : plan.name === 'FREE'
                    ? 'Начать бесплатно'
                    : 'Оформить подписку'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-white">Сравнение возможностей</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left p-3 sm:p-4 text-gray-400 text-sm sm:text-base">Функция</th>
                  <th className="text-center p-3 sm:p-4 text-gray-400 text-sm sm:text-base">FREE</th>
                  <th className="text-center p-3 sm:p-4 text-gray-400 text-sm sm:text-base">PRO</th>
                  <th className="text-center p-3 sm:p-4 text-gray-400 text-sm sm:text-base">BUSINESS</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-700">
                  <td className="p-3 sm:p-4 text-gray-300 text-sm sm:text-base">Клиенты в CRM</td>
                  <td className="p-3 sm:p-4 text-center text-gray-400 text-sm sm:text-base">10</td>
                  <td className="p-3 sm:p-4 text-center text-gray-400 text-sm sm:text-base">100</td>
                  <td className="p-3 sm:p-4 text-center text-green-400 text-sm sm:text-base">Неограниченно</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="p-3 sm:p-4 text-gray-300 text-sm sm:text-base">Интеграции</td>
                  <td className="p-3 sm:p-4 text-center text-gray-400 text-sm sm:text-base">1</td>
                  <td className="p-3 sm:p-4 text-center text-gray-400 text-sm sm:text-base">5</td>
                  <td className="p-3 sm:p-4 text-center text-green-400 text-sm sm:text-base">Все</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="p-3 sm:p-4 text-gray-300 text-sm sm:text-base">AI оптимизация рекламы</td>
                  <td className="p-3 sm:p-4 text-center text-gray-600 text-sm sm:text-base">—</td>
                  <td className="p-3 sm:p-4 text-center text-green-400">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />
                  </td>
                  <td className="p-3 sm:p-4 text-center text-green-400">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 mx-auto" />
                  </td>
                </tr>
                <tr>
                  <td className="p-3 sm:p-4 text-gray-300 text-sm sm:text-base">Поддержка</td>
                  <td className="p-3 sm:p-4 text-center text-gray-400 text-sm sm:text-base">Email</td>
                  <td className="p-3 sm:p-4 text-center text-gray-400 text-sm sm:text-base">Приоритет</td>
                  <td className="p-3 sm:p-4 text-center text-green-400 text-sm sm:text-base">VIP 24/7</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-12 text-center">
          <p className="text-gray-400">
            Нужна помощь с выбором тарифа?{' '}
            <a href="#" className="text-yellow-500 hover:text-yellow-400">
              Свяжитесь с нами
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}