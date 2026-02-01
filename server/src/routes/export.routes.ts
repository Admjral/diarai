import { Router } from 'express';
import {
  exportLeadsHandler,
  exportDealsHandler,
  exportTasksHandler,
  exportCampaignsHandler,
} from '../controllers/export.controller';

const router = Router();

// Экспорт лидов
router.get('/leads', exportLeadsHandler);

// Экспорт сделок
router.get('/deals', exportDealsHandler);

// Экспорт задач
router.get('/tasks', exportTasksHandler);

// Экспорт кампаний
router.get('/campaigns', exportCampaignsHandler);

export default router;

