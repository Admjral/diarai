// Типы для навигации и общего использования
export type Screen = 'onboarding' | 'login' | 'dashboard' | 'crm' | 'ai-advertising' | 'integrations' | 'subscription' | 'support' | 'admin' | 'notifications' | 'inbox';

export type ToastType = {
  message: string;
  type: 'success' | 'error' | 'info';
} | null;

