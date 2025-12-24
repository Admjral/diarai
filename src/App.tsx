import { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { Onboarding } from './components/Onboarding';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Toast } from './components/Toast';
import { ServerErrorFallback } from './components/ServerErrorFallback';
import { useAuth } from './contexts/AuthContext';
import { useServerConnection } from './hooks/useServerConnection';
import { userAPI, APIError } from './lib/api';
import { supabase } from './lib/supabase';

// Lazy loading для тяжелых компонентов
const CRM = lazy(() => 
  import('./components/CRM').then(module => ({ default: module.CRM }))
);
const AIAdvertising = lazy(() => 
  import('./components/AIAdvertising').then(module => ({ default: module.AIAdvertising }))
);
const Integrations = lazy(() => 
  import('./components/Integrations').then(module => ({ default: module.Integrations }))
);
const Subscription = lazy(() => 
  import('./components/Subscription').then(module => ({ default: module.Subscription }))
);
const Support = lazy(() => 
  import('./components/Support').then(module => ({ default: module.Support }))
);
const AdminPanel = lazy(() => 
  import('./components/AdminPanel').then(module => ({ default: module.AdminPanel }))
);

export type Screen = 'onboarding' | 'login' | 'dashboard' | 'crm' | 'ai-advertising' | 'integrations' | 'subscription' | 'support' | 'admin';

export type ToastType = {
  message: string;
  type: 'success' | 'error' | 'info';
} | null;

export default function App() {
  const { user: supabaseUser, loading } = useAuth();
  const { isConnected, isChecking, error: connectionError, checkConnection } = useServerConnection();
  const [currentScreen, setCurrentScreen] = useState<Screen>('onboarding');
  const [user, setUser] = useState<{ name: string; plan: 'Free' | 'Pro' | 'Business'; role?: 'user' | 'admin' } | null>(null);
  const [toast, setToast] = useState<ToastType>(null);

  useEffect(() => {
    if (!loading) {
      if (supabaseUser) {
        // Сохраняем email и userId в localStorage для API запросов
        const userEmail = supabaseUser.email;
        const userId = supabaseUser.id;
        
        if (userEmail) {
          localStorage.setItem('userEmail', userEmail);
          sessionStorage.setItem('userEmail', userEmail);
        }
        if (userId) {
          localStorage.setItem('userId', userId);
          sessionStorage.setItem('userId', userId);
        }
        
        // Загружаем профиль пользователя из БД
        const loadUserProfile = async () => {
          try {
            if (userEmail) {
              // Ждем, пока сессия Supabase будет полностью загружена
              // Проверяем сессию вместо фиксированной задержки
              let attempts = 0;
              const maxAttempts = 10;
              while (attempts < maxAttempts) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) {
                  break;
                }
                await new Promise(resolve => setTimeout(resolve, 50));
                attempts++;
              }
              
              const profile = await userAPI.getProfile();
              setUser({
                name: profile.name,
                plan: profile.plan,
                role: profile.role,
              });
            } else {
              // Fallback если email отсутствует
              setUser({
                name: 'Пользователь',
                plan: 'Free',
              });
            }
          } catch (error) {
            console.error('Ошибка при загрузке профиля пользователя:', error);
            // Если это ошибка подключения, не показываем fallback здесь (он покажется глобально)
            if (error instanceof APIError && error.isNetworkError) {
              // Просто используем fallback значения
            }
            // Fallback на дефолтные значения при ошибке
            setUser({
              name: supabaseUser.email?.split('@')[0] || 'Пользователь',
              plan: 'Free',
            });
          }
        };
        
        loadUserProfile();
        setCurrentScreen('dashboard');
      } else {
        // Очищаем сохраненные данные при выходе
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userId');
        sessionStorage.removeItem('userEmail');
        sessionStorage.removeItem('userId');
        setCurrentScreen('onboarding');
      }
    }
  }, [supabaseUser, loading]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  const handleLogin = useCallback(async (name: string) => {
    // После логина через Supabase, профиль загрузится автоматически через useEffect
    // Здесь просто переключаем экран
    setCurrentScreen('dashboard');
    showToast(`Добро пожаловать, ${name}!`, 'success');
  }, [showToast]);

  const handleNavigate = useCallback((screen: Screen) => {
    setCurrentScreen(screen);
  }, []);

  const handlePlanUpdate = useCallback((plan: 'Free' | 'Pro' | 'Business') => {
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
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Загрузка...</p>
        </div>
      </div>
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
      default:
        return <Dashboard user={user} onNavigate={handleNavigate} showToast={showToast} />;
    }
  }, [currentScreen, user, handleNavigate, showToast, handleLogin, handleOnboardingComplete, handlePlanUpdate]);

  // Показываем Fallback UI если сервер недоступен (кроме экранов логина и онбординга)
  const shouldShowFallback = !isConnected && 
    !isChecking && 
    currentScreen !== 'onboarding' && 
    currentScreen !== 'login' &&
    !loading;

  if (loading || isChecking) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
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