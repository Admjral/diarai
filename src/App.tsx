// Импорты React должны быть первыми
import { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
// Типы импортируем до компонентов
import type { Screen, ToastType } from './types';
// API
import { userAPI, APIError } from './lib/api';
// Контексты и хуки
import { useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useServerConnection } from './hooks/useServerConnection';
// Компоненты импортируем последними
import { Onboarding } from './components/Onboarding';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Toast } from './components/Toast';
import { ServerErrorFallback } from './components/ServerErrorFallback';
import { LoadingSpinner } from './components/LoadingSpinner';

// Auto-reload on chunk load failure (after deploys)
function lazyWithRetry<T extends { [key: string]: any }>(
  factory: () => Promise<T>,
  pick: keyof T
) {
  return lazy(() =>
    factory()
      .then(m => ({ default: m[pick] as React.ComponentType<any> }))
      .catch(() => {
        window.location.reload();
        return new Promise(() => {}); // never resolves, page is reloading
      })
  );
}

// Lazy loading для тяжелых компонентов
const CRM = lazyWithRetry(() => import('./components/CRM'), 'CRM');
const AIAdvertising = lazyWithRetry(() => import('./components/AIAdvertising'), 'AIAdvertising');
const Integrations = lazyWithRetry(() => import('./components/Integrations'), 'Integrations');
const Subscription = lazyWithRetry(() => import('./components/Subscription'), 'Subscription');
const Support = lazyWithRetry(() => import('./components/Support'), 'Support');
const AdminPanel = lazyWithRetry(() => import('./components/AdminPanel'), 'AdminPanel');
const Notifications = lazyWithRetry(() => import('./components/Notifications'), 'Notifications');
const MessengerInbox = lazyWithRetry(() => import('./components/MessengerInbox'), 'MessengerInbox');

function AppContent() {
  const { user: authUser, loading } = useAuth();
  const { isConnected, isChecking, error: connectionError, checkConnection } = useServerConnection();
  const { t } = useLanguage();
  const [currentScreen, setCurrentScreenState] = useState<Screen>(() => {
    const saved = localStorage.getItem('diar_current_screen') as Screen | null;
    return saved || 'onboarding';
  });

  const setCurrentScreen = useCallback((screen: Screen) => {
    setCurrentScreenState(screen);
    localStorage.setItem('diar_current_screen', screen);
  }, []);
  const [user, setUser] = useState<{ name: string; plan: 'Start' | 'Pro' | 'Business'; role?: 'user' | 'admin' } | null>(null);
  const [toast, setToast] = useState<ToastType>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Определяем showToast ДО useEffect, где он используется
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!loading) {
      if (authUser) {
        const loadUserProfile = async () => {
          setIsLoadingProfile(true);
          try {
            const profile = await userAPI.getProfile();
            setUser({
              name: profile.name,
              plan: profile.plan,
              role: profile.role,
            });
            const userName = profile.name || authUser.name || t.dashboard.user;
            showToast(t.dashboard.welcomeUser.replace('{name}', userName), 'success');
          } catch (error) {
            console.error('Ошибка при загрузке профиля пользователя:', error);
            const fallbackName = authUser.name || t.dashboard.user;
            setUser({
              name: fallbackName,
              plan: (authUser.plan as 'Start' | 'Pro' | 'Business') || 'Start',
              role: authUser.role as 'user' | 'admin',
            });
            if (!(error instanceof APIError && error.isNetworkError)) {
              showToast(t.dashboard.welcomeUser.replace('{name}', fallbackName), 'info');
            }
          } finally {
            setIsLoadingProfile(false);
          }
        };

        // Если сохранён экран, не требующий авторизации — перенаправляем на dashboard
        const saved = currentScreen;
        if (saved === 'onboarding' || saved === 'login') {
          setCurrentScreen('dashboard');
        }
        // Иначе — остаёмся на сохранённом экране
        loadUserProfile();
      } else {
        setUser(null);
        setIsLoadingProfile(false);
        setCurrentScreen('onboarding');
        localStorage.removeItem('diar_current_screen');
      }
    }
  }, [authUser, loading, showToast, t]);

  const handleLogin = useCallback(async (name: string) => {
    // После логина профиль загрузится автоматически через useEffect
    setCurrentScreen('dashboard');
  }, []);

  const handleNavigate = useCallback((screen: Screen) => {
    setCurrentScreen(screen);
  }, []);

  const handlePlanUpdate = useCallback((plan: 'Start' | 'Pro' | 'Business') => {
    if (user) {
      setUser({ ...user, plan });
    }
  }, [user]);

  const handleOnboardingComplete = useCallback(() => {
    setCurrentScreen('login');
  }, []);

  const handleToastClose = useCallback(() => {
    setToast(null);
  }, []);

  const renderScreen = useMemo(() => {
    const LoadingFallback = () => (
      <LoadingSpinner size="lg" variant="branded" />
    );

    switch (currentScreen) {
      case 'onboarding':
        return <Onboarding onComplete={handleOnboardingComplete} />;
      case 'login':
        return <Login onLogin={handleLogin} />;
      case 'dashboard':
        return <Dashboard user={user} onNavigate={handleNavigate} showToast={showToast} />;
      case 'crm':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <CRM onNavigate={handleNavigate} showToast={showToast} />
          </Suspense>
        );
      case 'ai-advertising':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <AIAdvertising onNavigate={handleNavigate} showToast={showToast} />
          </Suspense>
        );
      case 'integrations':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Integrations onNavigate={handleNavigate} showToast={showToast} />
          </Suspense>
        );
      case 'subscription':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Subscription
              user={user}
              onNavigate={handleNavigate}
              showToast={showToast}
              onPlanUpdate={handlePlanUpdate}
            />
          </Suspense>
        );
      case 'support':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Support onNavigate={handleNavigate} showToast={showToast} />
          </Suspense>
        );
      case 'admin':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <AdminPanel onNavigate={handleNavigate} showToast={showToast} />
          </Suspense>
        );
      case 'notifications':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Notifications onNavigate={handleNavigate} showToast={showToast} />
          </Suspense>
        );
      case 'inbox':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <MessengerInbox showToast={showToast} onNavigate={handleNavigate} />
          </Suspense>
        );
      default:
        return <Dashboard user={user} onNavigate={handleNavigate} showToast={showToast} />;
    }
  }, [currentScreen, user, handleNavigate, showToast, handleLogin, handleOnboardingComplete, handlePlanUpdate, t]);

  // Показываем Fallback UI если сервер недоступен (кроме экранов логина и онбординга)
  const shouldShowFallback = !isConnected &&
    !isChecking &&
    currentScreen !== 'onboarding' &&
    currentScreen !== 'login' &&
    !loading;

  if (loading || isChecking) {
    return <LoadingSpinner size="xl" variant="branded" />;
  }

  // Показываем экран загрузки профиля во время загрузки профиля пользователя
  if (isLoadingProfile && authUser) {
    return <LoadingSpinner size="xl" variant="branded" text={t.dashboard.loadingProfile} />;
  }

  if (shouldShowFallback) {
    return (
      <ServerErrorFallback
        onRetry={checkConnection}
        isRetrying={isChecking}
        errorMessage={connectionError?.message}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden w-full max-w-full">
      {renderScreen}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={handleToastClose}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
