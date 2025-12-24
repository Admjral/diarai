import { Router } from 'express';
import multer from 'multer';
import {
  getAllUsers,
  updateUserPlan,
  updateUserRole,
  getAllCampaigns,
  toggleCampaign,
  getAdminStats,
  exportLeads,
  exportClients,
  exportCampaignsStats,
  importLeads,
  importClients,
  importCampaignsStats,
  getAllWallets,
  adminAddFunds,
  adminWithdrawFunds,
  adminSetBalance,
} from '../controllers/admin.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Статистика
router.get('/stats', getAdminStats);

// Пользователи
router.get('/users', getAllUsers);
router.put('/users/:userId/plan', updateUserPlan);
router.put('/users/:userId/role', updateUserRole);

// Кампании
router.get('/campaigns', getAllCampaigns);
router.put('/campaigns/:campaignId/toggle', toggleCampaign);

// Кошельки
router.get('/wallets', getAllWallets);
router.post('/wallets/:userId/add', adminAddFunds);
router.post('/wallets/:userId/withdraw', adminWithdrawFunds);
router.put('/wallets/:userId/balance', adminSetBalance);

// Экспорт данных
router.get('/export/leads', exportLeads);
router.get('/export/clients', exportClients);
router.get('/export/campaigns', exportCampaignsStats);

// Импорт данных
router.post('/import/leads/:userId', upload.single('file'), importLeads);
router.post('/import/clients/:userId', upload.single('file'), importClients);
router.post('/import/campaigns/:userId', upload.single('file'), importCampaignsStats);

export default router;

