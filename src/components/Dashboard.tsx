import { Brain, Feather, Rocket, Users, TrendingUp, DollarSign, Target, Sparkles, Menu, Settings, LogOut, Plus, FileText, Image as ImageIcon, Loader2, MessageSquare, Shield, X } from 'lucide-react';
import { Screen } from '../App';
import { useState, memo, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmDialog } from './ConfirmDialog';
import { Wallet } from './Wallet';

interface DashboardProps {
  user: { name: string; plan: 'Free' | 'Pro' | 'Business'; role?: 'user' | 'admin' } | null;
  onNavigate: (screen: Screen) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const Dashboard = memo(function Dashboard({ user, onNavigate, showToast }: DashboardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const { signOut } = useAuth();

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
        showToast('Вы успешно вышли из системы', 'success');
      }, 100);
    } catch (error) {
      console.error('Ошибка при выходе:', error);
      showToast('Ошибка при выходе из системы', 'error');
      setIsSigningOut(false);
    }
  }, [signOut, onNavigate, showToast]);

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
      title: 'AI Реклама',
      icon: <Rocket className="w-8 h-8" />,
      gradient: 'from-pink-500 to-purple-500',
      description: 'Запуск кампаний',
      onClick: handleNavigateToAIAdvertising,
    },
    {
      title: 'CRM',
      icon: <Users className="w-8 h-8" />,
      gradient: 'from-yellow-400 to-amber-500',
      description: 'Управление клиентами',
      onClick: handleNavigateToCRM,
    },
  ], [handleNavigateToAIAdvertising, handleNavigateToCRM]);

  const kpis = useMemo(() => [
    { label: 'Лиды', value: '127', change: '+12%', icon: <Target className="w-5 h-5" /> },
    { label: 'Продажи', value: '₸1.2M', change: '+23%', icon: <DollarSign className="w-5 h-5" /> },
    { label: 'Конверсия', value: '34.5%', change: '+5%', icon: <TrendingUp className="w-5 h-5" /> },
  ], []);

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
                  <span>Админ-панель</span>
                </button>
              )}
              <button
                onClick={() => onNavigate('support')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Техподдержка</span>
              </button>

              <button
                onClick={handleNavigateToSubscription}
                className={`px-4 py-2 rounded-lg flex-shrink-0 ${
                  user?.plan === 'Free'
                    ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black'
                    : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
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
                    <button
                      onClick={handleNavigateToIntegrations}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3"
                    >
                      <Settings className="w-4 h-4" />
                      Интеграции
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onNavigate('support');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Техподдержка
                    </button>
                    <button 
                      onClick={handleSignOutClick}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 text-red-400"
                    >
                      <LogOut className="w-4 h-4" />
                      Выйти
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
                        <span>Админ-панель</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onNavigate('support');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>Техподдержка</span>
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleNavigateToSubscription();
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 ${
                        user?.plan === 'Free'
                          ? 'text-yellow-400'
                          : 'text-purple-400'
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
                      <span>Интеграции</span>
                    </button>
                    <div className="border-t border-slate-700">
                      <button 
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleSignOutClick();
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 text-red-400"
                      >
                        <LogOut className="w-5 h-5" />
                        <span>Выйти</span>
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
            {user?.name ? `Добро пожаловать, ${user.name}!` : 'Добро пожаловать!'}
          </h1>
          <p className="text-gray-400">Управляйте вашим бизнесом с помощью AI</p>
        </div>

        {/* Main Blocks */}
        <div className="mb-8">
          <h2 className="text-white mb-6">Основные инструменты</h2>
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
              <div className="text-white mb-1">{kpi.value}</div>
              <div className="text-green-400">{kpi.change} за неделю</div>
            </div>
          ))}
        </div>

        {/* AI Insights */}
        <div className="mb-8 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-white mb-2">AI Insights</h3>
              <p className="text-gray-300 mb-3">
                Ваша конверсия выросла на 23% за последнюю неделю! Рекомендуем увеличить бюджет на рекламу в Instagram на 15% для максимизации результатов.
              </p>
              <button className="text-purple-400 hover:text-purple-300">
                Подробнее →
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white mb-4">Активность за 7 дней</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Создано компаний</span>
                <span className="text-white">24</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Новых клиентов</span>
                <span className="text-white">18</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Активных кампаний</span>
                <span className="text-white">5</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white mb-4">Последние действия</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-gray-400">Новый лид от Instagram</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                <span className="text-gray-400">Опубликован пост</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                <span className="text-gray-400">Запущена рекламная кампания</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Sign Out Confirmation Dialog */}
      <ConfirmDialog
        open={signOutConfirmOpen}
        onOpenChange={setSignOutConfirmOpen}
        onConfirm={handleSignOut}
        title="Выйти из системы?"
        description="Вы уверены, что хотите выйти? Вам потребуется войти снова для доступа к системе."
        confirmText="Выйти"
        cancelText="Отмена"
        variant="default"
        isLoading={isSigningOut}
      />
    </div>
  );
});