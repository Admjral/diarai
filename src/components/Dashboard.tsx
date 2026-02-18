import { Brain, Feather, Rocket, Users, TrendingUp, DollarSign, Target, Sparkles, Menu, Settings, LogOut, Plus, FileText, Image as ImageIcon, Loader2, MessageSquare, Shield, X, Bell, Globe, Inbox, HelpCircle, WalletIcon, BarChart3 } from 'lucide-react';
import type { Screen } from '../types';
import { useState, memo, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ConfirmDialog } from './ConfirmDialog';
import { Wallet } from './Wallet';
import { dashboardAPI, type DashboardStats, notificationsAPI } from '../lib/api';

interface DashboardProps {
  user: { name: string; plan: 'Start' | 'Pro' | 'Business'; role?: 'user' | 'admin' } | null;
  onNavigate: (screen: Screen) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const Dashboard = memo(function Dashboard({ user, onNavigate, showToast }: DashboardProps) {
  const { t, language, setLanguage } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => localStorage.getItem('diar_welcome_dismissed') === 'true');
  const { signOut } = useAuth();

  // Загрузка данных дашборда и уведомлений параллельно
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [data, { count }] = await Promise.all([
          dashboardAPI.getStats(),
          notificationsAPI.getUnreadCount(),
        ]);
        setDashboardData(data);
        setUnreadNotificationsCount(count);
      } catch (err: any) {
        console.error('Ошибка при загрузке данных дашборда:', err);
        setError(err?.message || t.dashboard.loadingError);
        showToast(t.dashboard.loadingDashboardError, 'error');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Автообновление уведомлений каждые 30 секунд
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { count } = await notificationsAPI.getUnreadCount();
        setUnreadNotificationsCount(count);
      } catch {
        // Не показываем ошибку пользователю, так как это не критично
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOutClick = useCallback(() => {
    setMenuOpen(false);
    setSignOutConfirmOpen(true);
  }, []);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      setSignOutConfirmOpen(false);
      // Небольшая задержка перед навигацией, чтобы диалог успел закрыться
      setTimeout(() => {
        onNavigate('login');
        showToast(t.dashboard.signOutSuccess, 'success');
      }, 100);
    } catch (error) {
      console.error('Ошибка при выходе:', error);
      showToast(t.dashboard.signOutError, 'error');
      setIsSigningOut(false);
    }
  }, [signOut, onNavigate, showToast]);

  const handleDismissWelcome = useCallback(() => {
    setWelcomeDismissed(true);
    localStorage.setItem('diar_welcome_dismissed', 'true');
  }, []);

  const handleShowWelcome = useCallback(() => {
    setWelcomeDismissed(false);
    localStorage.removeItem('diar_welcome_dismissed');
  }, []);

  const handleNavigateToSubscription = useCallback(() => {
    onNavigate('subscription');
  }, [onNavigate]);

  const handleNavigateToIntegrations = useCallback(() => {
    onNavigate('integrations');
  }, [onNavigate]);

  const handleNavigateToAIAdvertising = useCallback(() => {
    onNavigate('ai-advertising');
  }, [onNavigate]);

  const handleNavigateToCRM = useCallback(() => {
    onNavigate('crm');
  }, [onNavigate]);

  const mainBlocks = useMemo(() => [
    {
      title: t.dashboard.aiAdvertising,
      icon: <Rocket className="w-8 h-8" />,
      gradient: 'from-pink-500 to-purple-500',
      description: t.dashboard.aiAdvertisingDescription,
      onClick: handleNavigateToAIAdvertising,
    },
    {
      title: t.dashboard.crm,
      icon: <Users className="w-8 h-8" />,
      gradient: 'from-yellow-400 to-amber-500',
      description: t.dashboard.description,
      onClick: handleNavigateToCRM,
    },
  ], [handleNavigateToAIAdvertising, handleNavigateToCRM, t]);

  const kpis = useMemo(() => {
    if (!dashboardData || !dashboardData.kpis) {
      // Fallback значения при загрузке
      return [
        { label: t.dashboard.leads, value: '0', change: '0%', icon: <Target className="w-5 h-5" /> },
        { label: t.dashboard.sales, value: '₸0', change: '0%', icon: <DollarSign className="w-5 h-5" /> },
        { label: t.dashboard.conversion, value: '0%', change: '0%', icon: <TrendingUp className="w-5 h-5" /> },
      ];
    }

    return [
      { 
        label: t.dashboard.leads, 
        value: dashboardData.kpis.leads?.value?.toString() || '0', 
        change: dashboardData.kpis.leads?.changeLabel || '0%', 
        icon: <Target className="w-5 h-5" /> 
      },
      { 
        label: t.dashboard.sales, 
        value: dashboardData.kpis.sales?.formattedValue || '₸0', 
        change: dashboardData.kpis.sales?.changeLabel || '0%', 
        icon: <DollarSign className="w-5 h-5" /> 
      },
      { 
        label: t.dashboard.conversion, 
        value: `${(dashboardData.kpis.conversion?.value || 0).toFixed(1)}%`, 
        change: dashboardData.kpis.conversion?.changeLabel || '0%', 
        icon: <TrendingUp className="w-5 h-5" /> 
      },
    ];
  }, [dashboardData, t]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black">
      {/* Header */}
      <header className="border-b border-slate-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-shrink-0">
              <h2 className="bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 bg-clip-text text-transparent text-lg sm:text-xl whitespace-nowrap">
                DIAR
              </h2>
              <span className="hidden sm:block text-gray-500 flex-shrink-0">|</span>
              <span className="hidden sm:block text-gray-400 text-sm sm:text-base whitespace-nowrap">AI Marketing CRM</span>
            </div>

            {/* Desktop menu */}
            <div className="hidden sm:flex items-center gap-2 sm:gap-4">
              {user?.role === 'admin' && (
                <button
                  onClick={() => onNavigate('admin')}
                  className="px-4 py-2 rounded-lg bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 flex items-center gap-2 transition-colors border border-yellow-400/30"
                >
                  <Shield className="w-4 h-4" />
                  <span>{t.dashboard.adminPanel}</span>
                </button>
              )}
              <button
                onClick={() => onNavigate('notifications')}
                className="relative px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span>{t.dashboard.notifications}</span>
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => onNavigate('inbox')}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white flex items-center gap-2 transition-colors"
              >
                <Inbox className="w-4 h-4" />
                <span>Чаты</span>
              </button>
              <button
                onClick={() => onNavigate('support')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{t.dashboard.support}</span>
              </button>
              <button
                onClick={handleShowWelcome}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-colors"
                title={t.dashboard.howToStart}
              >
                <HelpCircle className="w-4 h-4" />
                <span>{t.dashboard.howToStart}</span>
              </button>

              <button
                onClick={handleNavigateToSubscription}
                className={`px-4 py-2 rounded-lg flex-shrink-0 ${
                  user?.plan === 'Start'
                    ? 'bg-gradient-to-r from-gray-600 to-gray-800 text-white'
                    : user?.plan === 'Pro'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                    : 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black'
                }`}
              >
                {user?.plan}
              </button>

              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 flex items-center justify-center text-black"
                >
                  {user?.name?.charAt(0).toUpperCase()}
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden z-50">
                    <div className="px-4 py-2 border-b border-slate-700">
                      <div className="text-xs text-gray-500 mb-2">{t.dashboard.selectLanguage}</div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => {
                            setLanguage('🇷🇺 RU');
                            setMenuOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                            language === '🇷🇺 RU'
                              ? 'bg-yellow-400/20 text-yellow-400'
                              : 'hover:bg-slate-700 text-gray-300'
                          }`}
                        >
                          🇷🇺 Русский
                        </button>
                        <button
                          onClick={() => {
                            setLanguage('🇰🇿 KZ');
                            setMenuOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                            language === '🇰🇿 KZ'
                              ? 'bg-yellow-400/20 text-yellow-400'
                              : 'hover:bg-slate-700 text-gray-300'
                          }`}
                        >
                          🇰🇿 Қазақша
                        </button>
                        <button
                          onClick={() => {
                            setLanguage('🇺🇸 EN');
                            setMenuOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                            language === '🇺🇸 EN'
                              ? 'bg-yellow-400/20 text-yellow-400'
                              : 'hover:bg-slate-700 text-gray-300'
                          }`}
                        >
                          🇺🇸 English
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={handleNavigateToIntegrations}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3"
                    >
                      <Settings className="w-4 h-4" />
                      {t.dashboard.integrations}
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onNavigate('support');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {t.dashboard.support}
                    </button>
                    <button 
                      onClick={handleSignOutClick}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 text-red-400"
                    >
                      <LogOut className="w-4 h-4" />
                      {t.dashboard.signOut}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile burger menu */}
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
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          onNavigate('admin');
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 text-yellow-400"
                      >
                        <Shield className="w-5 h-5" />
                        <span>{t.dashboard.adminPanel}</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onNavigate('notifications');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 relative"
                    >
                      <Bell className="w-5 h-5" />
                      <span>{t.dashboard.notifications}</span>
                      {unreadNotificationsCount > 0 && (
                        <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center">
                          {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onNavigate('inbox');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 text-green-400"
                    >
                      <Inbox className="w-5 h-5" />
                      <span>Чаты</span>
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onNavigate('support');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>{t.dashboard.support}</span>
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleShowWelcome();
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 text-blue-400"
                    >
                      <HelpCircle className="w-5 h-5" />
                      <span>{t.dashboard.howToStart}</span>
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleNavigateToSubscription();
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 ${
                        user?.plan === 'Start'
                          ? 'text-gray-400'
                          : user?.plan === 'Pro'
                          ? 'text-purple-400'
                          : 'text-yellow-400'
                      }`}
                    >
                      <span className="font-semibold">{user?.plan}</span>
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleNavigateToIntegrations();
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3"
                    >
                      <Settings className="w-5 h-5" />
                      <span>{t.dashboard.integrations}</span>
                    </button>
                    <div className="border-t border-slate-700 px-4 py-3">
                      <div className="text-xs text-gray-500 mb-2">{t.dashboard.selectLanguage}</div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => {
                            setLanguage('🇷🇺 RU');
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                            language === '🇷🇺 RU'
                              ? 'bg-yellow-400/20 text-yellow-400'
                              : 'hover:bg-slate-700 text-gray-300'
                          }`}
                        >
                          🇷🇺 Русский
                        </button>
                        <button
                          onClick={() => {
                            setLanguage('🇰🇿 KZ');
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                            language === '🇰🇿 KZ'
                              ? 'bg-yellow-400/20 text-yellow-400'
                              : 'hover:bg-slate-700 text-gray-300'
                          }`}
                        >
                          🇰🇿 Қазақша
                        </button>
                        <button
                          onClick={() => {
                            setLanguage('🇺🇸 EN');
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                            language === '🇺🇸 EN'
                              ? 'bg-yellow-400/20 text-yellow-400'
                              : 'hover:bg-slate-700 text-gray-300'
                          }`}
                        >
                          🇺🇸 English
                        </button>
                      </div>
                    </div>
                    <div className="border-t border-slate-700">
                      <button 
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleSignOutClick();
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 text-red-400"
                      >
                        <LogOut className="w-5 h-5" />
                        <span>{t.dashboard.signOut}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome section */}
        <div className="mb-8">
          <h1 className="text-white mb-2">
            {user?.name ? t.dashboard.welcomeUser.replace('{name}', user.name) : t.dashboard.welcome}
          </h1>
          <p className="text-gray-400">{t.dashboard.manageBusiness}</p>
        </div>

        {/* Welcome Banner for new/returning users */}
        {!welcomeDismissed && (
          <div className="mb-8 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-white text-lg font-semibold mb-2">{t.dashboard.welcomeBanner.title}</h3>
                <p className="text-gray-400 mb-4">{t.dashboard.welcomeBanner.subtitle}</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-sm font-bold">1</span>
                    <span className="text-gray-300">{t.dashboard.welcomeBanner.step1}</span>
                    <button
                      onClick={() => { handleDismissWelcome(); /* Wallet is on same page, scroll to it */ }}
                      className="ml-auto px-3 py-1.5 text-xs bg-gradient-to-r from-yellow-400 to-amber-500 text-black rounded-lg hover:from-yellow-500 hover:to-amber-600 transition-all font-medium"
                    >
                      {t.dashboard.welcomeBanner.topUp}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-bold">2</span>
                    <span className="text-gray-300">{t.dashboard.welcomeBanner.step2}</span>
                    <button
                      onClick={() => { handleDismissWelcome(); onNavigate('ai-advertising'); }}
                      className="ml-auto px-3 py-1.5 text-xs bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600 transition-all font-medium"
                    >
                      {t.dashboard.welcomeBanner.createCampaign}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-sm font-bold">3</span>
                    <span className="text-gray-300">{t.dashboard.welcomeBanner.step3}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleDismissWelcome}
                className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Blocks */}
        <div className="mb-8">
          <h2 className="text-white mb-6">{t.dashboard.mainTools}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mainBlocks.map((block) => (
              <button
                key={block.title}
                onClick={block.onClick}
                className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all duration-300 hover:scale-105 text-left group"
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${block.gradient} flex items-center justify-center mb-4 group-hover:shadow-lg transition-shadow`}>
                  {block.icon}
                </div>
                <h3 className="text-white mb-2">{block.title}</h3>
                <p className="text-gray-400">{block.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Wallet */}
        <div className="mb-8">
          <Wallet showToast={showToast} />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-yellow-500/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-gray-400">{kpi.label}</div>
                <div className="text-yellow-500">{kpi.icon}</div>
              </div>
              <div className="text-white mb-1">{loading ? '...' : kpi.value}</div>
              <div className={loading ? 'text-gray-500' : (kpi.change?.startsWith('+') ? 'text-green-400' : 'text-red-400')}>
                {loading ? t.common.loading : (kpi.change || '0%')}
              </div>
            </div>
          ))}
        </div>

        {/* Empty KPI hint for new users */}
        {!loading && dashboardData && kpis.every(k => k.value === '0' || k.value === '₸0' || k.value === '0.0%') && (
          <div className="mb-4 px-4 py-3 bg-slate-800/30 border border-slate-700/50 rounded-xl">
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 flex-shrink-0" />
              {t.dashboard.emptyKpi}
            </p>
          </div>
        )}

        {/* AI Insights */}
        {loading ? (
          <div className="mb-8 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              <span className="text-gray-400">{t.common.loading}</span>
            </div>
          </div>
        ) : dashboardData?.aiInsights ? (
          <div className="mb-8 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white mb-2">{t.dashboard.aiInsights}</h3>
                <p className="text-gray-300 mb-3">
                  {dashboardData.aiInsights.message} {dashboardData.aiInsights.recommendation}
                </p>
                <button className="text-purple-400 hover:text-purple-300">
                  {t.dashboard.moreDetails}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white mb-4">{t.dashboard.activity7Days}</h3>
            {loading ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.common.loading}</span>
              </div>
            ) : dashboardData?.activity ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">{t.dashboard.campaignsCreated}</span>
                  <span className="text-white">{dashboardData.activity.campaignsCreated || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">{t.dashboard.newClients}</span>
                  <span className="text-white">{dashboardData.activity.newClients || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">{t.dashboard.activeCampaigns}</span>
                  <span className="text-white">{dashboardData.activity.activeCampaigns || 0}</span>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">{t.dashboard.noData}</div>
            )}
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white mb-4">{t.dashboard.recentActions}</h3>
            {loading ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.common.loading}</span>
              </div>
            ) : dashboardData?.recentActions && dashboardData.recentActions.length > 0 ? (
              <div className="space-y-3">
                {dashboardData.recentActions.map((action, index) => {
                  const getColor = () => {
                    if (action.type === 'lead') return 'bg-green-400';
                    if (action.type === 'campaign') return 'bg-purple-400';
                    return 'bg-blue-400';
                  };
                  
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${getColor()}`}></div>
                      <span className="text-gray-400">{action.description}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-gray-500">{t.dashboard.noRecentActivity}</div>
            )}
          </div>
        </div>
      </main>

      {/* Sign Out Confirmation Dialog */}
      <ConfirmDialog
        open={signOutConfirmOpen}
        onOpenChange={setSignOutConfirmOpen}
        onConfirm={handleSignOut}
        title={t.dashboard.signOutConfirm}
        description={t.dashboard.signOutConfirm}
        confirmText={t.dashboard.signOut}
        cancelText={t.common.cancel}
        variant="default"
        isLoading={isSigningOut}
      />
    </div>
  );
});