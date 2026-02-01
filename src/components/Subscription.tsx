import { useState, useEffect } from 'react';
import { ArrowLeft, Check, Sparkles, Zap, Crown, MessageCircle, Menu, X, Wallet, CreditCard, Loader2, Clock, ExternalLink } from 'lucide-react';
import type { Screen } from '../types';
import { userAPI, paymentAPI, walletAPI, paymentRequestAPI, PaymentRequest } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';

const KASPI_LINK = 'https://pay.kaspi.kz/pay/7wfg2vrb';

interface SubscriptionProps {
  user: { name: string; plan: 'Start' | 'Pro' | 'Business' } | null;
  onNavigate: (screen: Screen) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onPlanUpdate?: (plan: 'Start' | 'Pro' | 'Business') => void;
}

export function Subscription({ user, onNavigate, showToast, onPlanUpdate }: SubscriptionProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [showPaymentMethod, setShowPaymentMethod] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PaymentRequest | null>(null);
  const [showKaspiConfirm, setShowKaspiConfirm] = useState<string | null>(null); // plan name

  // Загружаем баланс кошелька и pending запросы при монтировании
  useEffect(() => {
    const loadData = async () => {
      try {
        const [wallet, myRequests] = await Promise.all([
          walletAPI.getWallet(),
          paymentRequestAPI.getMy()
        ]);
        setWalletBalance(parseFloat(wallet.balance));

        // Ищем pending запрос
        const pending = myRequests.find(r => r.status === 'pending');
        if (pending) {
          setPendingRequest(pending);
        }
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        setWalletBalance(0);
      }
    };
    loadData();
  }, []);

  // Обработка возврата с Kaspi
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const orderId = urlParams.get('orderId');

    if (status === 'success' && orderId) {
      showToast(t.subscription.paymentSuccess, 'success');
      // Очищаем URL параметры
      window.history.replaceState({}, '', window.location.pathname);
      // Обновляем профиль пользователя
      if (onPlanUpdate) {
        // План будет обновлен автоматически через webhook
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } else if (status === 'cancelled') {
      showToast(t.subscription.paymentCancelled, 'info');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [showToast, onPlanUpdate]);

  const handlePlanSelect = async (planName: string) => {
    // Преобразуем название плана в формат enum
    const planMap: Record<string, 'Start' | 'Pro' | 'Business'> = {
      'START': 'Start',
      'PRO': 'Pro',
      'BUSINESS': 'Business',
    };

    const plan = planMap[planName];
    if (!plan) {
      showToast(t.subscription.invalidPlan, 'error');
      return;
    }

    // Если это текущий план, ничего не делаем
    if (user?.plan === plan) {
      return;
    }

    // Все планы платные - показываем выбор способа оплаты
    setSelectedPlan(planName);
    setShowPaymentMethod(planName);
  };

  const handlePaymentMethod = async (paymentMethod: 'wallet' | 'kaspi') => {
    if (!selectedPlan) return;

    const planMap: Record<string, 'Start' | 'Pro' | 'Business'> = {
      'START': 'Start',
      'PRO': 'Pro',
      'BUSINESS': 'Business',
    };

    const plan = planMap[selectedPlan] as 'Start' | 'Pro' | 'Business';
    if (!plan) {
      showToast(t.subscription.invalidPlan, 'error');
      return;
    }

    if (paymentMethod === 'kaspi') {
      // Показываем Kaspi flow
      setShowPaymentMethod(null);
      setShowKaspiConfirm(selectedPlan);
      // Открываем Kaspi ссылку в новой вкладке
      window.open(KASPI_LINK, '_blank');
      return;
    }

    setLoading(selectedPlan);
    setShowPaymentMethod(null);

    try {
      // Оплата через кошелек
      const result = await paymentAPI.subscribe({
        plan,
        paymentMethod: 'wallet',
      });

      if (result.success) {
        // Обновляем баланс
        if (result.newBalance !== undefined) {
          setWalletBalance(result.newBalance);
        }
        // Обновляем план
        if (onPlanUpdate) {
          onPlanUpdate(plan);
        }
        showToast(t.subscription.subscriptionActivated, 'success');
      }
    } catch (error: any) {
      console.error('Ошибка при оплате:', error);

      if (error.message?.includes('Недостаточно средств')) {
        showToast(t.subscription.insufficientFunds, 'error');
        setShowPaymentMethod(selectedPlan);
      } else {
        showToast(error.message || t.subscription.paymentError, 'error');
      }
    } finally {
      setLoading(null);
    }
  };

  // Обработка подтверждения оплаты Kaspi
  const handleKaspiConfirm = async () => {
    if (!showKaspiConfirm) return;

    const planMap: Record<string, 'Start' | 'Pro' | 'Business'> = {
      'START': 'Start',
      'PRO': 'Pro',
      'BUSINESS': 'Business',
    };

    const plan = planMap[showKaspiConfirm];
    if (!plan) return;

    setLoading(showKaspiConfirm);

    try {
      const request = await paymentRequestAPI.create(plan);
      setPendingRequest(request);
      setShowKaspiConfirm(null);
      setSelectedPlan(null);
      showToast('Запрос на активацию отправлен! Ожидайте подтверждения.', 'success');
    } catch (error: any) {
      showToast(error.message || 'Ошибка создания запроса', 'error');
    } finally {
      setLoading(null);
    }
  };
  // Цены планов
  const PLAN_PRICES = {
    START: 50000,
    PRO: 120000,
    BUSINESS: 250000,
  };

  const plans = [
    {
      name: 'START',
      price: '₸50,000',
      period: t.subscription.perMonth,
      description: 'Для запуска одной рекламной кампании',
      icon: <Sparkles className="w-8 h-8" />,
      gradient: 'from-gray-600 to-gray-800',
      features: [
        { text: '1 рекламная кампания', included: true },
        { text: 'Неограниченное количество клиентов в CRM', included: true },
        { text: 'Базовая аналитика', included: true },
        { text: '1 интеграция', included: true },
        { text: 'AI-оптимизация рекламы (базовая)', included: true },
        { text: 'Email-поддержка', included: true },
        { text: 'Брендированные отчёты', included: true },
      ],
      current: user?.plan === 'Start',
    },
    {
      name: 'PRO',
      price: '₸120,000',
      period: t.subscription.perMonth,
      description: 'Для активного привлечения клиентов и масштабирования',
      icon: <Zap className="w-8 h-8" />,
      gradient: 'from-blue-500 to-purple-600',
      popular: true,
      features: [
        { text: 'До 5 рекламных кампаний', included: true },
        { text: 'Неограниченное количество клиентов в CRM', included: true },
        { text: 'Расширенная аналитика', included: true },
        { text: 'До 5 интеграций', included: true },
        { text: 'Полная AI-оптимизация рекламы', included: true },
        { text: 'Чат-боты для Instagram и Telegram', included: true },
        { text: 'Приоритетная поддержка', included: true },
        { text: 'Брендированные отчёты', included: true },
      ],
      current: user?.plan === 'Pro',
    },
    {
      name: 'BUSINESS',
      price: '₸250,000',
      period: t.subscription.perMonth,
      description: 'Для агентств и компаний с большим объёмом рекламы',
      icon: <Crown className="w-8 h-8" />,
      gradient: 'from-yellow-400 to-amber-600',
      features: [
        { text: 'Неограниченное количество рекламных кампаний', included: true },
        { text: 'Неограниченное количество клиентов в CRM', included: true },
        { text: 'Полная аналитика + BI', included: true },
        { text: 'Все интеграции', included: true },
        { text: 'Продвинутая AI-оптимизация рекламы', included: true },
        { text: 'Мультиканальные чат-боты (Instagram, Telegram, WhatsApp и др.)', included: true },
        { text: 'VIP-поддержка 24/7', included: true },
        { text: 'Полностью брендированные отчёты', included: true },
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
            <h1 className="text-white">{t.subscription.title}</h1>
            {/* Desktop menu */}
            <div className="hidden sm:flex items-center gap-4 ml-auto">
              <button
                onClick={() => onNavigate('support')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{t.subscription.supportType}</span>
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
                      <span>{t.subscription.supportType}</span>
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
          <h1 className="text-white mb-4">{t.subscription.selectPlan}</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {t.subscription.selectPlanDescription}
          </p>
        </div>

        {/* Pending Payment Request Banner */}
        {pendingRequest && (
          <div className="mb-8 p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-white mb-1">Ваш запрос на рассмотрении</h3>
                <p className="text-gray-400 mb-2">
                  План: <span className="text-white font-medium">{pendingRequest.plan}</span> •
                  Сумма: <span className="text-white font-medium">₸{pendingRequest.amount.toLocaleString()}</span>
                </p>
                <p className="text-sm text-gray-500">
                  Мы проверяем вашу оплату. Обычно это занимает несколько часов в рабочее время.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Kaspi Confirmation Dialog */}
        {showKaspiConfirm && (
          <div className="mb-8 p-6 bg-blue-500/10 border border-blue-500/30 rounded-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-6 h-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-white mb-2">Оплата через Kaspi</h3>
                <p className="text-gray-400 mb-4">
                  Переведите <span className="text-white font-medium">
                    ₸{showKaspiConfirm === 'START' ? '50,000' : showKaspiConfirm === 'PRO' ? '120,000' : '250,000'}
                  </span> по ссылке Kaspi и нажмите "Я оплатил" для активации подписки.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={KASPI_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Открыть Kaspi
                  </a>
                  <button
                    onClick={handleKaspiConfirm}
                    disabled={loading === showKaspiConfirm}
                    className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading === showKaspiConfirm ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Я оплатил
                  </button>
                  <button
                    onClick={() => {
                      setShowKaspiConfirm(null);
                      setSelectedPlan(null);
                    }}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
                  {t.subscription.popular}
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
              ) : showPaymentMethod === plan.name ? (
                <div className="space-y-2">
                  <div className="text-xs text-gray-400 mb-2 text-center">
                    {walletBalance !== null && plan.name !== 'FREE' && (
                      <span>
                        {t.subscription.balance} {walletBalance.toLocaleString('ru-RU')} ₸
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handlePaymentMethod('wallet')}
                    disabled={loading === plan.name || (walletBalance !== null && plan.name === 'START' && walletBalance < PLAN_PRICES.START) || (walletBalance !== null && plan.name === 'PRO' && walletBalance < PLAN_PRICES.PRO) || (walletBalance !== null && plan.name === 'BUSINESS' && walletBalance < PLAN_PRICES.BUSINESS)}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading === plan.name ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Wallet className="w-4 h-4" />
                        {t.subscription.payWithWallet}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handlePaymentMethod('kaspi')}
                    disabled={loading === plan.name}
                    className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading === plan.name ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        {t.subscription.payWithKaspi}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowPaymentMethod(null);
                      setSelectedPlan(null);
                    }}
                    className="w-full py-2 text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    {t.common.cancel}
                  </button>
                </div>
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
                    ? t.subscription.updating
                    : t.subscription.subscribe}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-white">{t.subscription.comparisonTitle}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left p-3 sm:p-4 text-gray-400 text-sm sm:text-base">{t.subscription.feature}</th>
                  <th className="text-center p-3 sm:p-4 text-gray-400 text-sm sm:text-base">START</th>
                  <th className="text-center p-3 sm:p-4 text-gray-400 text-sm sm:text-base">PRO</th>
                  <th className="text-center p-3 sm:p-4 text-gray-400 text-sm sm:text-base">BUSINESS</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-700">
                  <td className="p-3 sm:p-4 text-gray-300 text-sm sm:text-base">Рекламные кампании</td>
                  <td className="p-3 sm:p-4 text-center text-gray-400 text-sm sm:text-base">1</td>
                  <td className="p-3 sm:p-4 text-center text-gray-400 text-sm sm:text-base">До 5</td>
                  <td className="p-3 sm:p-4 text-center text-green-400 text-sm sm:text-base">{t.subscription.unlimited}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="p-3 sm:p-4 text-gray-300 text-sm sm:text-base">{t.subscription.clientsInCRM}</td>
                  <td className="p-3 sm:p-4 text-center text-green-400 text-sm sm:text-base">{t.subscription.unlimited}</td>
                  <td className="p-3 sm:p-4 text-center text-green-400 text-sm sm:text-base">{t.subscription.unlimited}</td>
                  <td className="p-3 sm:p-4 text-center text-green-400 text-sm sm:text-base">{t.subscription.unlimited}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="p-3 sm:p-4 text-gray-300 text-sm sm:text-base">{t.subscription.integrations}</td>
                  <td className="p-3 sm:p-4 text-center text-gray-400 text-sm sm:text-base">1</td>
                  <td className="p-3 sm:p-4 text-center text-gray-400 text-sm sm:text-base">До 5</td>
                  <td className="p-3 sm:p-4 text-center text-green-400 text-sm sm:text-base">{t.subscription.all}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="p-3 sm:p-4 text-gray-300 text-sm sm:text-base">{t.subscription.aiOptimization}</td>
                  <td className="p-3 sm:p-4 text-center text-gray-400 text-sm sm:text-base">Базовая</td>
                  <td className="p-3 sm:p-4 text-center text-green-400 text-sm sm:text-base">Полная</td>
                  <td className="p-3 sm:p-4 text-center text-green-400 text-sm sm:text-base">Продвинутая</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <td className="p-3 sm:p-4 text-gray-300 text-sm sm:text-base">Чат-боты</td>
                  <td className="p-3 sm:p-4 text-center text-gray-600 text-sm sm:text-base">—</td>
                  <td className="p-3 sm:p-4 text-center text-gray-400 text-sm sm:text-base">Instagram, Telegram</td>
                  <td className="p-3 sm:p-4 text-center text-green-400 text-sm sm:text-base">Все каналы</td>
                </tr>
                <tr>
                  <td className="p-3 sm:p-4 text-gray-300 text-sm sm:text-base">{t.subscription.supportType}</td>
                  <td className="p-3 sm:p-4 text-center text-gray-400 text-sm sm:text-base">{t.subscription.email}</td>
                  <td className="p-3 sm:p-4 text-center text-gray-400 text-sm sm:text-base">{t.subscription.priority}</td>
                  <td className="p-3 sm:p-4 text-center text-green-400 text-sm sm:text-base">{t.subscription.vip247}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-12 text-center">
          <p className="text-gray-400">
            {t.subscription.needHelp}{' '}
            <a href="#" className="text-yellow-500 hover:text-yellow-400">
              {t.subscription.contactUs}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}