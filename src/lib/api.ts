import { getAuthToken } from '../contexts/AuthContext';

// Убираем завершающий слэш из URL, если он есть
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '');

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

// Конфигурация retry для операций аутентификации (увеличенные таймауты и больше попыток)
const authRetryConfig: RetryConfig = {
  maxRetries: 5,
  retryDelay: 2000, // 2 секунды
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
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

// Получить заголовки для запросов с JWT токеном
export async function getHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Получаем токен из localStorage
  const token = getAuthToken();

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

// Базовый метод для запросов с retry логикой
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  retryConfig: RetryConfig = defaultRetryConfig,
  timeout: number = 30000 // Таймаут по умолчанию 30 секунд
): Promise<T> {
  // Убираем начальный слэш из endpoint, если он есть, и добавляем один слэш
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;
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
        signal: AbortSignal.timeout(timeout),
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

// Специальная функция для запросов, связанных с аутентификацией (с увеличенным таймаутом)
async function requestWithAuthTimeout<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  return request<T>(endpoint, options, authRetryConfig, 60000); // Таймаут 60 секунд для auth-операций
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

// API для Dashboard
export interface DashboardKPIs {
  leads: {
    value: number;
    change: number;
    changeLabel: string;
  };
  sales: {
    value: number;
    formattedValue: string;
    change: number;
    changeLabel: string;
  };
  conversion: {
    value: number;
    change: number;
    changeLabel: string;
  };
}

export interface DashboardAIInsights {
  message: string;
  recommendation: string;
}

export interface DashboardActivity {
  campaignsCreated: number;
  newClients: number;
  activeCampaigns: number;
}

export interface DashboardRecentAction {
  type: 'lead' | 'campaign';
  description: string;
  timestamp: string;
  source?: string;
}

export interface DashboardStats {
  kpis: DashboardKPIs;
  aiInsights: DashboardAIInsights;
  activity: DashboardActivity;
  recentActions: DashboardRecentAction[];
}

export const dashboardAPI = {
  getStats: () => request<DashboardStats>('/api/dashboard/stats'),
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
  plan: 'Start' | 'Pro' | 'Business';
  role?: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export const userAPI = {
  getProfile: () => 
    requestWithAuthTimeout<UserProfile>('/api/user/profile'),
  updatePlan: (plan: 'Start' | 'Pro' | 'Business') => 
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

export interface WalletTransaction {
  id: number;
  userId: number;
  walletId: number;
  type: 'deposit' | 'withdrawal' | 'subscription' | 'refund';
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  description?: string | null;
  paymentId?: number | null;
  createdAt: string;
}

export interface CreateKaspiWalletOrderResponse {
  success: boolean;
  orderId: string;
  paymentUrl: string;
  transactionId: number;
  message: string;
}

export const walletAPI = {
  getWallet: () => request<Wallet>('/api/wallet'),
  addFunds: (amount: number) => 
    request<WalletResponse>('/api/wallet/add', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  createKaspiDepositOrder: async (amount: number) => {
    // Используем существующий маршрут /api/wallet/add с параметром paymentMethod
    return await request<CreateKaspiWalletOrderResponse>('/api/wallet/add', {
      method: 'POST',
      body: JSON.stringify({ amount, paymentMethod: 'kaspi' }),
    });
  },
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
  getTransactions: () => 
    request<{ transactions: WalletTransaction[]; total: number }>('/api/wallet/transactions'),
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
  plan: 'Start' | 'Pro' | 'Business';
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
  phone: string | null;
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

// API для платежей
export interface Payment {
  id: number;
  userId: number;
  plan: 'Start' | 'Pro' | 'Business';
  amount: string;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  paymentMethod: string;
  kaspiOrderId?: string | null;
  kaspiPaymentId?: string | null;
  walletTransactionId?: number | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
}

export interface SubscribeRequest {
  plan: 'Pro' | 'Business';
  paymentMethod: 'wallet' | 'kaspi';
}

export interface SubscribeResponse {
  success: boolean;
  payment: Payment;
  paymentUrl?: string;
  orderId?: string;
  walletTransaction?: WalletTransaction;
  newBalance?: number;
  message: string;
}

export interface CreateKaspiOrderRequest {
  plan: 'Pro' | 'Business';
  amount?: number;
}

export interface CreateKaspiOrderResponse {
  success: boolean;
  paymentUrl: string;
  orderId: string;
  payment: Payment;
}

export const paymentAPI = {
  subscribe: (data: SubscribeRequest) =>
    request<SubscribeResponse>('/api/payments/subscribe', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createKaspiOrder: (data: CreateKaspiOrderRequest) =>
    request<CreateKaspiOrderResponse>('/api/payments/kaspi/create-order', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getHistory: () =>
    request<{ payments: Payment[]; total: number }>('/api/payments/history'),
  getById: (id: number) =>
    request<Payment>(`/api/payments/${id}`),
};

export const adminAPI = {
  getStats: () => request<AdminStats>('/api/admin/stats'),
  getAllUsers: () => request<AdminUser[]>('/api/admin/users'),
  updateUserPlan: (userId: number, plan: 'Start' | 'Pro' | 'Business') =>
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
  exportLeads: async (userId?: number) => {
    const url = new URL(`${API_BASE_URL}/api/admin/export/leads`.replace(/([^:]\/)\/+/g, '$1'));
    if (userId) {
      url.searchParams.append('userId', userId.toString());
    }
    const headers = await getHeaders();
    const response = await fetch(url.toString(), { method: 'GET', headers });
    if (!response.ok) throw new APIError('Ошибка экспорта лидов', response.status);
    return await response.blob();
  },
  exportClients: async (userId?: number) => {
    const url = new URL(`${API_BASE_URL}/api/admin/export/clients`.replace(/([^:]\/)\/+/g, '$1'));
    if (userId) {
      url.searchParams.append('userId', userId.toString());
    }
    const headers = await getHeaders();
    const response = await fetch(url.toString(), { method: 'GET', headers });
    if (!response.ok) throw new APIError('Ошибка экспорта клиентов', response.status);
    return await response.blob();
  },
  exportCampaignsStats: async (userId?: number) => {
    const url = new URL(`${API_BASE_URL}/api/admin/export/campaigns`.replace(/([^:]\/)\/+/g, '$1'));
    if (userId) {
      url.searchParams.append('userId', userId.toString());
    }
    const headers = await getHeaders();
    const response = await fetch(url.toString(), { method: 'GET', headers });
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
    const url = `${API_BASE_URL}/api/admin/import/leads/${userId}`.replace(/([^:]\/)\/+/g, '$1');
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
    const url = `${API_BASE_URL}/api/admin/import/clients/${userId}`.replace(/([^:]\/)\/+/g, '$1');
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
    const url = `${API_BASE_URL}/api/admin/import/campaigns/${userId}`.replace(/([^:]\/)\/+/g, '$1');
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
  updateCampaignStats: async (campaignId: number, stats: {
    spent?: string | number;
    conversions?: number;
    budget?: string | number;
  }) => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/api/admin/campaigns/${campaignId}/stats`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(stats),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new APIError(error.error || 'Ошибка обновления статистики', response.status);
    }

    return await response.json();
  },
  bulkUpdateCampaignsStats: async (updates: Array<{
    campaignId: number;
    spent?: string | number;
    conversions?: number;
    budget?: string | number;
  }>) => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/api/admin/campaigns/stats/bulk`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ updates }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new APIError(error.error || 'Ошибка массового обновления', response.status);
    }

    return await response.json();
  },

  // Campaign management
  editCampaign: (campaignId: number, data: {
    name?: string;
    adText?: string;
    audience?: any;
    budget?: number;
    platform?: string;
  }) =>
    request<{ success: boolean; campaign: any; changes: number; message: string }>(`/api/admin/campaigns/${campaignId}/edit`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  approveCampaign: (campaignId: number) =>
    request<{ success: boolean; message: string }>(`/api/admin/campaigns/${campaignId}/approve`, {
      method: 'POST',
    }),

  rejectCampaign: (campaignId: number, reason: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/campaigns/${campaignId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getCampaignHistory: (campaignId: number) =>
    request<Array<{
      id: number;
      campaignId: number;
      adminId: number;
      action: string;
      fieldName: string | null;
      oldValue: any;
      newValue: any;
      comment: string | null;
      createdAt: string;
      admin: { id: number; email: string; name: string };
    }>>(`/api/admin/campaigns/${campaignId}/history`),
};

// API для интеграций
export interface Integration {
  id: number;
  userId: number;
  type: string;
  status: 'connected' | 'disconnected';
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationStats {
  type: string;
  connected: boolean;
  connectedClients: number;
}

export const integrationsAPI = {
  getAll: () => request<Integration[]>('/api/integrations'),
  getStats: (type: string) => 
    request<IntegrationStats>(`/api/integrations/stats?type=${encodeURIComponent(type)}`),
  connect: (type: string, config?: Record<string, any>) =>
    request<{ message: string; integration: Integration }>('/api/integrations/connect', {
      method: 'POST',
      body: JSON.stringify({ type, config }),
    }),
  disconnect: (type: string) =>
    request<{ message: string }>('/api/integrations/disconnect', {
      method: 'POST',
      body: JSON.stringify({ type }),
    }),
};

// API для уведомлений
export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  emailSent: boolean;
  pushSent: boolean;
  createdAt: string;
  readAt?: string;
}

export const notificationsAPI = {
  getAll: (params?: { read?: boolean; limit?: number; offset?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.read !== undefined) queryParams.append('read', String(params.read));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.offset) queryParams.append('offset', String(params.offset));
    const query = queryParams.toString();
    return request<{ notifications: Notification[] }>(`/api/notifications${query ? `?${query}` : ''}`);
  },
  getUnreadCount: () => request<{ count: number }>('/api/notifications/unread/count'),
  markAsRead: (id: number) => request<{ notification: Notification }>(`/api/notifications/${id}/read`, { method: 'PUT' }),
  markAllAsRead: () => request<{ updated: number }>('/api/notifications/read-all', { method: 'PUT' }),
  delete: (id: number) => request<{ success: boolean }>(`/api/notifications/${id}`, { method: 'DELETE' }),
};

export type ExportFormat = 'csv' | 'xlsx' | 'json';

export interface ExportFilters {
  status?: string;
  stage?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Функция для скачивания файла
 */
async function downloadFile(url: string, filename: string): Promise<void> {
  const headers = await getHeaders();
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.json();
    throw new APIError(error.error || 'Ошибка экспорта', response.status);
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

export const exportAPI = {
  exportLeads: async (format: ExportFormat = 'csv', filters?: ExportFilters) => {
    const queryParams = new URLSearchParams();
    queryParams.append('format', format);
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) queryParams.append('dateTo', filters.dateTo);
    
    const url = `${API_BASE_URL}/api/export/leads?${queryParams.toString()}`;
    const filename = `leads_${new Date().toISOString().split('T')[0]}.${format}`;
    await downloadFile(url, filename);
  },

  exportDeals: async (format: ExportFormat = 'csv', filters?: ExportFilters) => {
    const queryParams = new URLSearchParams();
    queryParams.append('format', format);
    if (filters?.stage) queryParams.append('stage', filters.stage);
    if (filters?.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) queryParams.append('dateTo', filters.dateTo);
    
    const url = `${API_BASE_URL}/api/export/deals?${queryParams.toString()}`;
    const filename = `deals_${new Date().toISOString().split('T')[0]}.${format}`;
    await downloadFile(url, filename);
  },

  exportTasks: async (format: ExportFormat = 'csv', filters?: ExportFilters) => {
    const queryParams = new URLSearchParams();
    queryParams.append('format', format);
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.priority) queryParams.append('priority', filters.priority);
    if (filters?.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) queryParams.append('dateTo', filters.dateTo);
    
    const url = `${API_BASE_URL}/api/export/tasks?${queryParams.toString()}`;
    const filename = `tasks_${new Date().toISOString().split('T')[0]}.${format}`;
    await downloadFile(url, filename);
  },

  exportCampaigns: async (format: ExportFormat = 'csv', filters?: ExportFilters) => {
    const queryParams = new URLSearchParams();
    queryParams.append('format', format);
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) queryParams.append('dateTo', filters.dateTo);

    const url = `${API_BASE_URL}/api/export/campaigns?${queryParams.toString()}`;
    const filename = `campaigns_${new Date().toISOString().split('T')[0]}.${format}`;
    await downloadFile(url, filename);
  },
};

// =====================
// MESSENGER API
// =====================

export interface MessengerConfig {
  id: number;
  type: 'whatsapp' | 'telegram' | 'instagram';
  aiEnabled: boolean;
  aiSystemPrompt?: string;
  escalationEnabled: boolean;
  escalationKeywords: string[];
  isConnected: boolean;
  sessionId?: string; // Для проверки статуса WhatsApp сессии
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessengerConversation {
  id: string;
  messengerId: string;
  messengerType: 'whatsapp' | 'telegram' | 'instagram';
  contactName: string;
  contactAvatar?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  status: 'active' | 'archived' | 'closed';
  assignedToId?: number;
  createdAt: string;
}

export interface MessengerMessage {
  id: string;
  conversationId: string;
  text: string;
  mediaUrls: string[];
  sender: 'customer' | 'operator' | 'ai';
  senderName?: string;
  isAIGenerated: boolean;
  aiConfidence?: number;
  aiIntent?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  isEscalated: boolean;
  escalatedAt?: string;
  createdAt: string;
}

export interface InboxResponse {
  conversations: MessengerConversation[];
  total: number;
  unreadTotal: number;
}

export interface ConversationResponse {
  conversation: MessengerConversation;
  messages: MessengerMessage[];
}

export const messengerAPI = {
  // Config
  getConfigs: () =>
    request<{ configs: MessengerConfig[] }>('/api/messenger/config'),

  saveConfig: (config: Partial<MessengerConfig> & { type: string }) =>
    request<{ success: boolean; config: MessengerConfig }>('/api/messenger/config', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  deleteConfig: (type: string) =>
    request<{ success: boolean }>(`/api/messenger/config/${type}`, {
      method: 'DELETE',
    }),

  // WhatsApp Session
  createWhatsAppSession: () =>
    request<{ success: boolean; sessionId: string }>('/api/messenger/whatsapp/session', {
      method: 'POST',
    }),

  getWhatsAppQR: () =>
    request<{ success: boolean; data: { value: string; status: string } }>('/api/messenger/whatsapp/qr'),

  getWhatsAppStatus: () =>
    request<{ success: boolean; data: { status: string; isConnected: boolean; sessionId?: string } }>('/api/messenger/whatsapp/status'),

  // Telegram
  connectTelegram: (botToken: string) =>
    request<{ success: boolean; config: MessengerConfig }>('/api/messenger/telegram/connect', {
      method: 'POST',
      body: JSON.stringify({ botToken }),
    }),

  // Inbox
  getInbox: (params?: {
    status?: string;
    messengerType?: string;
    limit?: number;
    offset?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.messengerType) queryParams.append('messengerType', params.messengerType);
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.offset) queryParams.append('offset', String(params.offset));

    const query = queryParams.toString();
    return request<InboxResponse>(`/api/messenger/inbox${query ? `?${query}` : ''}`);
  },

  getConversation: (id: string, params?: { limit?: number; offset?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.offset) queryParams.append('offset', String(params.offset));

    const query = queryParams.toString();
    return request<ConversationResponse>(`/api/messenger/inbox/${id}${query ? `?${query}` : ''}`);
  },

  sendMessage: (conversationId: string, text: string, mediaUrls?: string[]) =>
    request<{ success: boolean; message: MessengerMessage }>(`/api/messenger/inbox/${conversationId}/send`, {
      method: 'POST',
      body: JSON.stringify({ text, mediaUrls }),
    }),

  closeConversation: (id: string) =>
    request<{ success: boolean }>(`/api/messenger/inbox/${id}/close`, {
      method: 'PUT',
    }),

  archiveConversation: (id: string) =>
    request<{ success: boolean }>(`/api/messenger/inbox/${id}/archive`, {
      method: 'PUT',
    }),

  // Lead integration
  createLeadFromConversation: (conversationId: string) =>
    request<{ success: boolean; lead: any }>(`/api/messenger/inbox/${conversationId}/create-lead`, {
      method: 'POST',
    }),

  getConversationLead: (conversationId: string) =>
    request<{ lead: any | null }>(`/api/messenger/inbox/${conversationId}/lead`),
};

// =====================
// PAYMENT REQUEST API (Kaspi manual payment)
// =====================

export interface PaymentRequest {
  id: number;
  userId: number;
  plan: 'Start' | 'Pro' | 'Business';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  note?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  processedBy?: number;
  user?: {
    id: number;
    email: string;
    name: string;
  };
}

export const paymentRequestAPI = {
  // Клиентские методы
  create: (plan: 'Start' | 'Pro' | 'Business', note?: string) =>
    request<PaymentRequest>('/api/payment-requests', {
      method: 'POST',
      body: JSON.stringify({ plan, note }),
    }),

  getMy: () =>
    request<PaymentRequest[]>('/api/payment-requests/my'),

  // Админские методы
  getPending: async (): Promise<PaymentRequest[]> => {
    const result = await request<{ requests: PaymentRequest[]; pendingCount: number }>('/api/payment-requests/admin');
    return result.requests;
  },

  getPendingCount: () =>
    request<{ count: number }>('/api/payment-requests/admin/count'),

  approve: (id: number, adminNote?: string) =>
    request<{ success: boolean; message: string }>(`/api/payment-requests/admin/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ adminNote }),
    }),

  reject: (id: number, adminNote?: string) =>
    request<{ success: boolean; message: string }>(`/api/payment-requests/admin/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ adminNote }),
    }),
};

// =====================
// WALLET TOP-UP API (QR-code payment)
// =====================

export interface WalletTopUpRequest {
  id: number;
  userId: number;
  amount: string;
  status: 'pending_payment' | 'paid' | 'approved' | 'rejected';
  note?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  processedAt?: string;
  processedBy?: number;
  user?: {
    id: number;
    email: string;
    name: string;
  };
}

export const walletTopUpAPI = {
  // Клиентские методы
  create: (amount: number, note?: string) =>
    request<{ message: string; request: WalletTopUpRequest }>('/api/wallet-topup', {
      method: 'POST',
      body: JSON.stringify({ amount, note }),
    }),

  getMy: () =>
    request<WalletTopUpRequest[]>('/api/wallet-topup/my'),

  getMyActive: () =>
    request<WalletTopUpRequest | null>('/api/wallet-topup/my/active'),

  markAsPaid: (id: number) =>
    request<{ success: boolean; message: string; request: WalletTopUpRequest }>(`/api/wallet-topup/${id}/paid`, {
      method: 'PUT',
    }),

  // Админские методы
  getAll: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return request<{ requests: WalletTopUpRequest[]; counts: { pending_payment: number; paid: number } }>(`/api/wallet-topup/admin${query}`);
  },

  getPendingCount: () =>
    request<{ count: number }>('/api/wallet-topup/admin/count'),

  approve: (id: number, adminNote?: string) =>
    request<{ success: boolean; message: string; request: WalletTopUpRequest; newBalance: string }>(`/api/wallet-topup/admin/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ adminNote }),
    }),

  reject: (id: number, adminNote?: string) =>
    request<{ success: boolean; message: string; request: WalletTopUpRequest }>(`/api/wallet-topup/admin/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ adminNote }),
    }),
};

