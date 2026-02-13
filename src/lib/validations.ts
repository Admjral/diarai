import { z } from 'zod';

// Схема валидации для кампании
export const campaignSchema = z.object({
  name: z
    .string()
    .min(3, 'Название кампании должно содержать минимум 3 символа')
    .max(100, 'Название кампании не должно превышать 100 символов')
    .trim(),
  platforms: z
    .array(z.string())
    .min(1, 'Выберите хотя бы одну платформу'),
  budget: z
    .string()
    .min(1, 'Бюджет обязателен')
    .refine(
      (val) => {
        const num = parseFloat(val.replace(/[^\d.]/g, ''));
        return !isNaN(num) && num > 0;
      },
      { message: 'Бюджет должен быть положительным числом' }
    )
    .refine(
      (val) => {
        const num = parseFloat(val.replace(/[^\d.]/g, ''));
        return num >= 10000;
      },
      { message: 'Минимальный бюджет: ₸10,000' }
    ),
  phone: z
    .string()
    .min(1, 'Номер телефона обязателен')
    .regex(/^[\d\s()+-]+$/, 'Неверный формат номера телефона')
    .min(10, 'Номер телефона должен содержать минимум 10 цифр'),
  location: z
    .string()
    .max(200, 'Локация не должна превышать 200 символов')
    .optional()
    .or(z.literal('')),
});

export type CampaignFormData = z.infer<typeof campaignSchema>;

// Схема валидации для лида
export const leadSchema = z.object({
  name: z
    .string()
    .min(2, 'Имя должно содержать минимум 2 символа')
    .max(100, 'Имя не должно превышать 100 символов')
    .trim(),
  email: z
    .string()
    .min(1, 'Email обязателен')
    .email('Неверный формат email')
    .toLowerCase()
    .trim(),
  phone: z
    .string()
    .min(1, 'Номер телефона обязателен')
    .regex(/^[\d\s()+-]+$/, 'Неверный формат номера телефона')
    .min(10, 'Номер телефона должен содержать минимум 10 цифр'),
  company: z
    .string()
    .max(200, 'Название компании не должно превышать 200 символов')
    .optional()
    .or(z.literal('')),
  status: z.enum(['new', 'contacted', 'qualified', 'lost']),
  source: z
    .string()
    .max(100, 'Источник не должен превышать 100 символов')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(1000, 'Заметки не должны превышать 1000 символов')
    .optional()
    .or(z.literal('')),
});

export type LeadFormData = z.infer<typeof leadSchema>;

// Схема валидации для сделки
export const dealSchema = z.object({
  title: z
    .string()
    .min(3, 'Название сделки должно содержать минимум 3 символа')
    .max(200, 'Название сделки не должно превышать 200 символов')
    .trim(),
  amount: z
    .string()
    .min(1, 'Сумма обязательна')
    .refine(
      (val) => {
        const num = parseFloat(val.replace(/[^\d.]/g, ''));
        return !isNaN(num) && num > 0;
      },
      { message: 'Сумма должна быть положительным числом' }
    ),
  stage: z.enum(['lead', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
  probability: z
    .number()
    .min(0, 'Вероятность не может быть отрицательной')
    .max(100, 'Вероятность не может превышать 100%')
    .optional()
    .default(0),
  expectedCloseDate: z
    .string()
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(1000, 'Заметки не должны превышать 1000 символов')
    .optional()
    .or(z.literal('')),
  leadId: z
    .string()
    .optional()
    .or(z.literal('')),
});

export type DealFormData = z.infer<typeof dealSchema>;

// Схема валидации для задачи
export const taskSchema = z.object({
  title: z
    .string()
    .min(3, 'Название задачи должно содержать минимум 3 символа')
    .max(200, 'Название задачи не должно превышать 200 символов')
    .trim(),
  description: z
    .string()
    .max(1000, 'Описание не должно превышать 1000 символов')
    .optional()
    .or(z.literal('')),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z
    .string()
    .optional()
    .or(z.literal('')),
  leadId: z
    .string()
    .optional()
    .or(z.literal('')),
});

export type TaskFormData = z.infer<typeof taskSchema>;

// Схема валидации для логина/регистрации
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email обязателен')
    .email('Неверный формат email')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(6, 'Пароль должен содержать минимум 6 символов')
    .max(100, 'Пароль не должен превышать 100 символов'),
  agreed: z
    .boolean()
    .refine((val) => val === true, {
      message: 'Необходимо согласие с политикой конфиденциальности',
    }),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Схема валидации для восстановления пароля
export const resetPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email обязателен')
    .email('Неверный формат email')
    .toLowerCase()
    .trim(),
});

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

