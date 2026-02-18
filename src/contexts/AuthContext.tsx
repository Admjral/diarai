import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Типы для нашей собственной аутентификации
interface User {
  id: number;
  phone: string;
  email?: string;
  name: string;
  plan: string;
  role: string;
}

interface AuthError {
  message: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (phone: string, password: string, name?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (phone: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'diar_auth_token';
const USER_KEY = 'diar_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Восстановление сессии из localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);

        // Проверяем валидность токена
        verifyToken(savedToken).catch(() => {
          // Токен невалидный - очищаем
          clearAuth();
        });
      } catch {
        clearAuth();
      }
    }

    setLoading(false);
  }, []);

  // Проверка токена на сервере
  const verifyToken = async (authToken: string): Promise<User> => {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Invalid token');
    }

    const data = await response.json();
    return data.user;
  };

  // Очистка авторизации
  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('diar_current_screen');
    sessionStorage.removeItem('userPhone');
    sessionStorage.removeItem('userId');
    setToken(null);
    setUser(null);
  };

  // Сохранение авторизации
  const saveAuth = (authToken: string, authUser: User) => {
    localStorage.setItem(TOKEN_KEY, authToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    sessionStorage.setItem('userPhone', authUser.phone);
    sessionStorage.setItem('userId', String(authUser.id));
    setToken(authToken);
    setUser(authUser);
  };

  // Вход
  const signIn = async (phone: string, password: string): Promise<{ error: AuthError | null }> => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: { message: data.error || 'Ошибка входа' } };
      }

      saveAuth(data.token, data.user);
      return { error: null };
    } catch (err) {
      console.error('[Auth] Ошибка входа:', err);
      return { error: { message: 'Ошибка соединения с сервером' } };
    }
  };

  // Регистрация
  const signUp = async (
    phone: string,
    password: string,
    name?: string
  ): Promise<{ error: AuthError | null }> => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: { message: data.error || 'Ошибка регистрации' } };
      }

      saveAuth(data.token, data.user);
      return { error: null };
    } catch (err) {
      console.error('[Auth] Ошибка регистрации:', err);
      return { error: { message: 'Ошибка соединения с сервером' } };
    }
  };

  // Выход
  const signOut = async () => {
    try {
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // Игнорируем ошибки при выходе
    } finally {
      clearAuth();
    }
  };

  // Сброс пароля (пока заглушка - можно реализовать через SMS)
  const resetPassword = async (phone: string): Promise<{ error: AuthError | null }> => {
    // TODO: Реализовать сброс пароля через SMS
    console.log('Reset password requested for:', phone);
    return { error: { message: 'Функция сброса пароля пока не реализована' } };
  };

  const value = {
    user,
    token,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Хелпер для получения токена (используется в api.ts)
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
