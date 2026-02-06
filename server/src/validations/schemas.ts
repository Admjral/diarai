import { z } from 'zod';

// Схема валидации для создания лида
export const createLeadSchema = z.object({
  name: z
    .string()
    .min(2, 'Имя должно содержать минимум 2 символа')
    .max(100, 'Имя не должно превышать 100 символов')
    .trim(),
  phone: z
    .string()
    .min(1, 'Номер телефона обязателен')
    .regex(/^[\d\s()+-]+$/, 'Неверный формат номера телефона')
    .min(10, 'Номер телефона должен содержать минимум 10 цифр'),
  email: z
    .string()
    .min(1, 'Email обязателен')
    .email('Неверный формат email')
    .toLowerCase()
    .trim(),
  source: z
    .string()
    .max(100, 'Источник не должен превышать 100 символов')
    .optional()
    .default('Другое'),
  status: z
    .enum(['new', 'contacted', 'qualified', 'converted', 'lost'])
    .optional()
    .default('new'),
  stage: z
    .string()
    .max(100, 'Этап не должен превышать 100 символов')
    .optional()
    .default('Первый контакт'),
  notes: z
    .string()
    .max(1000, 'Заметки не должны превышать 1000 символов')
    .optional()
    .nullable(),
  campaignId: z
    .number()
    .int()
    .positive('ID кампании должен быть положительным числом')
    .optional()
    .nullable(),
});

// Схема валидации для обновления лида
export const updateLeadSchema = createLeadSchema.partial();

// Схема валидации для параметров ID
export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID должен быть числом').transform(Number),
});

// Схема валидации для создания сделки
export const createDealSchema = z.object({
  name: z
    .string()
    .min(3, 'Название сделки должно содержать минимум 3 символа')
    .max(200, 'Название сделки не должно превышать 200 символов')
    .trim(),
  clientId: z.number().int().positive().optional().nullable(),
  clientName: z
    .string()
    .min(2, 'Имя клиента должно содержать минимум 2 символа')
    .max(200, 'Имя клиента не должно превышать 200 символов')
    .trim()
    .optional(),
  amount: z
    .number()
    .positive('Сумма должна быть положительным числом')
    .or(z.string().transform((val) => {
      const num = parseFloat(val.replace(/[^\d.]/g, ''));
      if (isNaN(num) || num <= 0) {
        throw new Error('Сумма должна быть положительным числом');
      }
      return num;
    })),
  currency: z.string().max(10).optional().default('₸'),
  stage: z
    .enum(['lead', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'])
    .optional()
    .default('lead'),
  probability: z
    .number()
    .int()
    .min(0, 'Вероятность не может быть отрицательной')
    .max(100, 'Вероятность не может превышать 100%')
    .optional()
    .default(0),
  expectedCloseDate: z.union([z.string().datetime(), z.null()]).optional(),
  notes: z
    .string()
    .max(1000, 'Заметки не должны превышать 1000 символов')
    .optional()
    .nullable(),
});

// Схема валидации для обновления сделки
export const updateDealSchema = createDealSchema.partial();

// Схема валидации для создания задачи
export const createTaskSchema = z.object({
  title: z
    .string()
    .min(3, 'Название задачи должно содержать минимум 3 символа')
    .max(200, 'Название задачи не должно превышать 200 символов')
    .trim(),
  description: z
    .string()
    .max(1000, 'Описание не должно превышать 1000 символов')
    .optional()
    .nullable(),
  status: z
    .enum(['todo', 'in_progress', 'done', 'cancelled'])
    .optional()
    .default('todo'),
  priority: z
    .enum(['low', 'medium', 'high', 'urgent'])
    .optional()
    .default('medium'),
  dueDate: z.union([z.string().datetime(), z.null()]).optional(),
  clientId: z.number().int().positive().optional().nullable(),
  dealId: z.number().int().positive().optional().nullable(),
  assignedTo: z.string().max(200).optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
});

// Схема валидации для обновления задачи
export const updateTaskSchema = createTaskSchema.partial();

// Схема валидации для создания кампании
export const createCampaignSchema = z.object({
  name: z
    .string()
    .min(3, 'Название кампании должно содержать минимум 3 символа')
    .max(200, 'Название кампании не должно превышать 200 символов')
    .trim(),
  platforms: z
    .array(z.string())
    .min(1, 'Выберите хотя бы одну платформу'),
  status: z.enum(['Активна', 'На паузе', 'На проверке']).optional().default('На проверке'),
  budget: z
    .union([
      z.number().positive('Бюджет должен быть положительным числом'),
      z.string().transform((val) => {
        if (!val || val.trim() === '') {
          throw new Error('Бюджет обязателен');
        }
        const num = parseFloat(val.replace(/[^\d.]/g, ''));
        if (isNaN(num) || num <= 0) {
          throw new Error('Бюджет должен быть положительным числом');
        }
        if (num < 1000) {
          throw new Error('Минимальный бюджет: 1000');
        }
        return num;
      }),
    ]),
  spent: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return 0;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const cleaned = val.replace(/[^\d.]/g, '');
        const num = parseFloat(cleaned) || 0;
        return num;
      }
      return 0;
    },
    z.number().nonnegative()
  ).optional().default(0),
  conversions: z.number().int().nonnegative().optional().default(0),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => val && val.trim() !== '' ? val.trim() : null),
  location: z
    .string()
    .max(200)
    .optional()
    .nullable()
    .transform((val) => val && val.trim() !== '' ? val.trim() : null),
  budgetPeriodDays: z
    .number()
    .int()
    .min(1, 'Период должен быть минимум 1 день')
    .max(365, 'Период не может превышать 365 дней')
    .optional()
    .default(7),
  audience: z
    .object({
      interests: z.array(z.string()).optional(),
      ageRange: z.string().optional(),
      platforms: z.array(z.string()).optional(),
      adText: z.string().optional().nullable(),
      optimizedBid: z.number().optional(),
      recommendations: z.array(z.string()).optional(),
    })
    .optional()
    .nullable()
    .transform((val) => val && Object.keys(val).length > 0 ? val : null),
}).passthrough(); // Разрешаем дополнительные поля

// Схема валидации для обновления кампании
export const updateCampaignSchema = createCampaignSchema.partial();

// Схема валидации для обновления плана пользователя
export const updatePlanSchema = z.object({
  plan: z.enum(['Start', 'Pro', 'Business']),
});

// Схема валидации для пополнения кошелька
export const addFundsSchema = z.object({
  amount: z
    .union([
      z.number().positive('Сумма должна быть положительным числом'),
      z.string().transform((val) => {
        if (!val || val.trim() === '') {
          throw new Error('Сумма обязательна');
        }
        const num = parseFloat(val.replace(/[^\d.]/g, ''));
        if (isNaN(num) || num <= 0) {
          throw new Error('Сумма должна быть положительным числом');
        }
        return num;
      }),
    ]),
  paymentMethod: z.string().optional().refine(
    (val) => !val || val === 'direct' || val === 'kaspi',
    { message: 'paymentMethod должен быть "direct" или "kaspi"' }
  ),
}).passthrough(); // Разрешаем дополнительные поля - важно для сохранения paymentMethod

// Схема валидации для снятия средств
export const withdrawFundsSchema = z.object({
  amount: z
    .union([
      z.number().positive('Сумма должна быть положительным числом'),
      z.string().transform((val) => {
        if (!val || val.trim() === '') {
          throw new Error('Сумма обязательна');
        }
        const num = parseFloat(val.replace(/[^\d.]/g, ''));
        if (isNaN(num) || num <= 0) {
          throw new Error('Сумма должна быть положительным числом');
        }
        return num;
      }),
    ]),
});

// Схема валидации для обновления валюты
export const updateCurrencySchema = z.object({
  currency: z
    .string()
    .min(1, 'Валюта обязательна')
    .max(10, 'Валюта не должна превышать 10 символов')
    .trim(),
});

// Схема валидации для создания обращения в техподдержку
export const createSupportTicketSchema = z.object({
  subject: z
    .string()
    .min(3, 'Тема должна содержать минимум 3 символа')
    .max(200, 'Тема не должна превышать 200 символов')
    .trim(),
  message: z
    .string()
    .min(10, 'Сообщение должно содержать минимум 10 символов')
    .max(5000, 'Сообщение не должно превышать 5000 символов')
    .trim(),
  priority: z
    .enum(['low', 'medium', 'high', 'urgent'])
    .optional()
    .default('medium'),
});

// Схема валидации для обновления обращения
export const updateSupportTicketSchema = z.object({
  status: z
    .enum(['open', 'in_progress', 'resolved', 'closed'])
    .optional(),
  response: z
    .string()
    .max(5000, 'Ответ не должен превышать 5000 символов')
    .optional()
    .nullable(),
});

