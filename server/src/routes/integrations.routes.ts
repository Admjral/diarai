import { Router } from 'express';
import { 
  getIntegrations, 
  connectIntegration, 
  disconnectIntegration,
  getIntegrationStats 
} from '../controllers/integrations.controller';
import { validateBody } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Схема валидации для подключения интеграции
const connectIntegrationSchema = z.object({
  type: z.string().min(1, 'Тип интеграции обязателен'),
  config: z.record(z.any()).optional().default({}),
});

// Схема валидации для отключения интеграции
const disconnectIntegrationSchema = z.object({
  type: z.string().min(1, 'Тип интеграции обязателен'),
});

// GET /api/integrations - получить все интеграции пользователя
router.get('/', getIntegrations);

// GET /api/integrations/stats - получить статистику интеграции
router.get('/stats', getIntegrationStats);

// POST /api/integrations/connect - подключить интеграцию
router.post('/connect', validateBody(connectIntegrationSchema), connectIntegration);

// POST /api/integrations/disconnect - отключить интеграцию
router.post('/disconnect', validateBody(disconnectIntegrationSchema), disconnectIntegration);

export default router;

