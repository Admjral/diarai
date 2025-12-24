import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Типы ошибок API
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isNetworkError: boolean = false,
    public isServerError: boolean = false
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Конфигурация retry
interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // в миллисекундах
  retryableStatusCodes: number[];
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1 секунда
  retryableStatusCodes: [408, 429, 500, 502, 503, 504], // Таймаут, слишком много запросов, ошибки сервера
};

// Функция задержки с экспоненциальным backoff
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Проверка, является ли ошибка сетевой
function isNetworkError(error: any): boolean {
  return (
    error.message === 'Failed to fetch' ||
    error.name === 'TypeError' ||
    error.name === 'NetworkError' ||
    (error instanceof TypeError && error.message.includes('fetch'))
  );
}

// Проверка, можно ли повторить запрос
function isRetryable(error: APIError, attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) return false;
  if (error.isNetworkError) return true;
  if (error.statusCode && defaultRetryConfig.retryableStatusCodes.includes(error.statusCode)) {
    return true;
  }
  return false;
}

// Получить заголовки для запросов с JWT токеном из Supabase
export async function getHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  try {
    // Получаем access_token из Supabase сессии
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('[getHeaders] Ошибка получения сессии Supabase:', error);
      throw new Error('Не удалось получить сессию Supabase');
    }
    
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    } else {
      console.warn('[getHeaders] Supabase сессия не найдена или токен отсутствует');
      throw new Error('Токен доступа не найден в сессии Supabase');
    }
  } catch (error) {
    console.error('[getHeaders] Ошибка при получении заголовков аутентификации:', error);
    // Пробрасываем ошибку дальше, чтобы обработчик запроса мог её обработать
    throw error;
  }

  return headers;
}

// Базовый метод для запросов с retry логикой
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  retryConfig: RetryConfig = defaultRetryConfig
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  let lastError: APIError | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // Если это не первая попытка, ждем перед повтором
      if (attempt > 0) {
        const delayMs = retryConfig.retryDelay * Math.pow(2, attempt - 1); // Экспоненциальная задержка
        await delay(delayMs);
      }

      // Получаем заголовки с JWT токеном
      let authHeaders: HeadersInit;
      try {
        authHeaders = await getHeaders();
      } catch (authError: any) {
        // Если не удалось получить токен, это ошибка аутентификации
        // Не повторяем запрос при ошибке аутентификации
        const authErrorObj = new APIError(
          authError?.message || 'Токен доступа не найден. Пожалуйста, войдите в систему.',
          401,
          false,
          false
        );
        throw authErrorObj;
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...authHeaders,
          ...options.headers,
        },
        signal: AbortSignal.timeout(30000), // Таймаут 30 секунд
      });

      if (!response.ok) {
        let errorMessage = 'Ошибка сервера';
        let errorData: any = null;

        try {
          errorData = await response.json();
          errorMessage = errorData.error || errorData.message || `HTTP error! status: ${response.status}`;
          
          // Логирование ответа сервера для отладки
          console.error('[api.ts] Ошибка от сервера:', {
            status: response.status,
            error: errorData.error,
            message: errorData.message,
            details: errorData.details,
            hasDetails: !!errorData.details,
            detailsType: typeof errorData.details,
            fullData: errorData,
            fullDataKeys: Object.keys(errorData),
            fullDataStringified: JSON.stringify(errorData, null, 2),
          });
          
          // Сохраняем детали ошибки валидации
          if (errorData.details) {
            (errorData as any).details = errorData.details;
          }
        } catch {
          // Если не удалось распарсить JSON, используем статус
          errorMessage = `HTTP error! status: ${response.status}`;
          console.error('[api.ts] Не удалось распарсить ответ сервера, статус:', response.status);
        }

        const apiError = new APIError(
          errorMessage,
          response.status,
          false,
          response.status >= 500
        );
        
        // Добавляем детали ошибки к объекту ошибки
        if (errorData) {
          // Сохраняем все детали ошибки
          if (errorData.details) {
            (apiError as any).details = errorData.details;
            (apiError as any).errorDetails = errorData.details;
          }
          // Сохраняем полный объект errorData для отладки
          (apiError as any).serverErrorData = errorData;
          // Если details есть, но не был сохранен выше, сохраняем его
          if (!(apiError as any).errorDetails && errorData.details) {
            (apiError as any).errorDetails = errorData.details;
          }
        }

        // Не повторяем запрос при ошибках клиента (4xx), кроме 408 и 429
        if (response.status >= 400 && response.status < 500 && 
            !defaultRetryConfig.retryableStatusCodes.includes(response.status)) {
          throw apiError;
        }

        // Проверяем, можно ли повторить запрос
        if (isRetryable(apiError, attempt, retryConfig.maxRetries)) {
          lastError = apiError;
          continue; // Пытаемся снова
        }

        throw apiError;
      }

      // Успешный ответ
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        // Если ответ не JSON, возвращаем текст
        const text = await response.text();
        return (text ? JSON.parse(text) : {}) as T;
      } catch (parseError) {
        // Если не удалось распарсить, возвращаем пустой объект для не-JSON ответов
        return {} as T;
      }
    } catch (error: any) {
      // Обработка сетевых ошибок и таймаутов
      if (isNetworkError(error) || error.name === 'AbortError') {
        const networkError = new APIError(
          `Не удалось подключиться к серверу. Убедитесь, что бэкенд запущен на ${API_BASE_URL}. ` +
          `Запустите сервер командой: cd server && npm run dev`,
          undefined,
          true,
          false
        );

        // Проверяем, можно ли повторить запрос
        if (isRetryable(networkError, attempt, retryConfig.maxRetries)) {
          lastError = networkError;
          continue; // Пытаемся снова
        }

        throw networkError;
      }

      // Если это уже APIError, пробрасываем дальше
      if (error instanceof APIError) {
        if (isRetryable(error, attempt, retryConfig.maxRetries)) {
          lastError = error;
          continue;
        }
        throw error;
      }

      // Неизвестная ошибка
      throw new APIError(
        error.message || 'Произошла неизвестная ошибка',
        undefined,
        false,
        false
      );
    }
  }

  // Если все попытки исчерпаны, выбрасываем последнюю ошибку
  throw lastError || new APIError('Не удалось выполнить запрос после всех попыток');
}

// Экспортируем функцию для проверки доступности сервера
export async function checkServerHealth(): Promise<boolean> {
  try {
    await request<{ status: string }>('/health', { method: 'GET' }, { maxRetries: 1, retryDelay: 500, retryableStatusCodes: [] });
    return true;
  } catch {
    return false;
  }
}

// API для лидов
export const leadsAPI = {
  getAll: () => request<any[]>('/api/leads'),
  getById: (id: string) => request<any>(`/api/leads/${id}`),
  create: (data: any) => request<any>('/api/leads', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/api/leads/${id}`, { method: 'DELETE' }),
};

// API для сделок
export const dealsAPI = {
  getAll: () => request<any[]>('/api/deals'),
  getById: (id: string) => request<any>(`/api/deals/${id}`),
  create: (data: any) => request<any>('/api/deals', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/api/deals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/api/deals/${id}`, { method: 'DELETE' }),
};

// API для задач
export const tasksAPI = {
  getAll: () => request<any[]>('/api/tasks'),
  getById: (id: string) => request<any>(`/api/tasks/${id}`),
  create: (data: any) => request<any>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/api/tasks/${id}`, { method: 'DELETE' }),
};

// API для CRM статистики
export const crmAPI = {
  getStats: () => request<any>('/api/crm/stats'),
  getAll: () => request<any>('/api/crm/all'),
};

// API для кампаний
export const campaignsAPI = {
  getAll: () => request<any[]>('/api/campaigns'),
  getById: (id: number) => request<any>(`/api/campaigns/${id}`),
  create: (data: any) => request<any>('/api/campaigns', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  update: (id: number, data: any) => request<any>(`/api/campaigns/${id}`, { 
    method: 'PUT', 
    body: JSON.stringify(data) 
  }),
  delete: (id: number) => request<{ message: string }>(`/api/campaigns/${id}`, { 
    method: 'DELETE' 
  }),
};

// API для пользователя
export interface UserProfile {
  id: number;
  email: string;
  name: string;
  plan: 'Free' | 'Pro' | 'Business';
  role?: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export const userAPI = {
  getProfile: () => 
    request<UserProfile>('/api/user/profile'),
  updatePlan: (plan: 'Free' | 'Pro' | 'Business') => 
    request<UserProfile & { message: string }>('/api/user/plan', {
      method: 'PUT',
      body: JSON.stringify({ plan }),
    }),
};

// AI API для подбора аудитории и генерации контента
export interface AIAudienceRequest {
  campaignName: string;
  platforms: string[];
  budget: number;
  phone?: string;
  location?: string;
  description?: string;
}

export interface AIAudienceResponse {
  interests: string[];
  ageRange: string;
  platforms: string[];
  optimizedBid?: number;
  adText?: string;
  recommendations?: string[];
  aiPowered?: boolean;
}

export const aiAPI = {
  getAudience: (data: AIAudienceRequest) => 
    request<AIAudienceResponse>('/api/ai/audience', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  generateImage: (data: { campaignName: string; category?: string; description?: string }) =>
    request<{ imageUrl: string }>('/api/ai/generate-image', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// API для кошелька
export interface Wallet {
  id: number;
  userId: number;
  balance: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletResponse extends Wallet {
  message?: string;
}

export const walletAPI = {
  getWallet: () => request<Wallet>('/api/wallet'),
  addFunds: (amount: number) => 
    request<WalletResponse>('/api/wallet/add', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  withdrawFunds: (amount: number) => 
    request<WalletResponse>('/api/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  updateCurrency: (currency: string) => 
    request<WalletResponse>('/api/wallet/currency', {
      method: 'PUT',
      body: JSON.stringify({ currency }),
    }),
};

// API для техподдержки
export interface SupportTicket {
  id: number;
  userId: number;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  response?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportTicketRequest {
  subject: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export const supportAPI = {
  getAll: () => request<SupportTicket[]>('/api/support'),
  getById: (id: number) => request<SupportTicket>(`/api/support/${id}`),
  create: (data: CreateSupportTicketRequest) =>
    request<SupportTicket>('/api/support', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: number, data: { status?: string; response?: string | null }) =>
    request<SupportTicket>(`/api/support/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    request<{ message: string }>(`/api/support/${id}`, {
      method: 'DELETE',
    }),
};

// API для админ-панели
export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalLeads: number;
  totalDeals: number;
  revenue: number;
  totalWallets: number;
  totalBalance: number;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  plan: 'Free' | 'Pro' | 'Business';
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface CampaignWithUser {
  id: number;
  name: string;
  platforms: string[];
  status: string;
  budget: string;
  spent: string;
  conversions: number;
  imageUrl: string | null;
  audience: any;
  user: {
    email: string;
    name: string;
  } | null;
}

export interface WalletWithUser {
  id: number;
  userId: number;
  balance: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  user: {
    email: string;
    name: string;
  } | null;
}

export const adminAPI = {
  getStats: () => request<AdminStats>('/api/admin/stats'),
  getAllUsers: () => request<AdminUser[]>('/api/admin/users'),
  updateUserPlan: (userId: number, plan: 'Free' | 'Pro' | 'Business') =>
    request<AdminUser & { message: string }>(`/api/admin/users/${userId}/plan`, {
      method: 'PUT',
      body: JSON.stringify({ plan }),
    }),
  updateUserRole: (userId: number, role: 'user' | 'admin') =>
    request<AdminUser & { message: string }>(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  getAllCampaigns: () => request<CampaignWithUser[]>('/api/admin/campaigns'),
  toggleCampaign: (campaignId: number, status: 'Активна' | 'На паузе' | 'На проверке') =>
    request<CampaignWithUser & { message: string }>(`/api/admin/campaigns/${campaignId}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  exportLeads: async () => {
    const url = `${API_BASE_URL}/api/admin/export/leads`;
    const headers = await getHeaders();
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) throw new APIError('Ошибка экспорта лидов', response.status);
    return await response.blob();
  },
  exportClients: async () => {
    const url = `${API_BASE_URL}/api/admin/export/clients`;
    const headers = await getHeaders();
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) throw new APIError('Ошибка экспорта клиентов', response.status);
    return await response.blob();
  },
  exportCampaignsStats: async () => {
    const url = `${API_BASE_URL}/api/admin/export/campaigns`;
    const headers = await getHeaders();
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) throw new APIError('Ошибка экспорта статистики кампаний', response.status);
    return await response.blob();
  },
  getAllWallets: () => request<WalletWithUser[]>('/api/admin/wallets'),
  addFunds: (userId: number, amount: number, note?: string) =>
    request<WalletWithUser & { message: string; note?: string }>(`/api/admin/wallets/${userId}/add`, {
      method: 'POST',
      body: JSON.stringify({ amount, note }),
    }),
  withdrawFunds: (userId: number, amount: number, note?: string) =>
    request<WalletWithUser & { message: string; note?: string }>(`/api/admin/wallets/${userId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ amount, note }),
    }),
  setBalance: (userId: number, balance: number, note?: string) =>
    request<WalletWithUser & { message: string; note?: string }>(`/api/admin/wallets/${userId}/balance`, {
      method: 'PUT',
      body: JSON.stringify({ balance, note }),
    }),
  importLeads: async (userId: number, file: File) => {
    const url = `${API_BASE_URL}/api/admin/import/leads/${userId}`;
    const headers = await getHeaders();
    const formData = new FormData();
    formData.append('file', file);
    
    // Удаляем Content-Type из headers, чтобы браузер установил его с boundary
    const { 'Content-Type': _, ...headersWithoutContentType } = headers as any;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headersWithoutContentType,
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new APIError(error.error || 'Ошибка импорта лидов', response.status);
    }
    
    return await response.json();
  },
  importClients: async (userId: number, file: File) => {
    const url = `${API_BASE_URL}/api/admin/import/clients/${userId}`;
    const headers = await getHeaders();
    const formData = new FormData();
    formData.append('file', file);
    
    const { 'Content-Type': _, ...headersWithoutContentType } = headers as any;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headersWithoutContentType,
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new APIError(error.error || 'Ошибка импорта клиентов', response.status);
    }
    
    return await response.json();
  },
  importCampaignsStats: async (userId: number, file: File) => {
    const url = `${API_BASE_URL}/api/admin/import/campaigns/${userId}`;
    const headers = await getHeaders();
    const formData = new FormData();
    formData.append('file', file);
    
    const { 'Content-Type': _, ...headersWithoutContentType } = headers as any;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headersWithoutContentType,
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new APIError(error.error || 'Ошибка импорта статистики кампаний', response.status);
    }
    
    return await response.json();
  },
};

