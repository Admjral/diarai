import { Router } from 'express';
import {
  createTopUpRequest,
  getMyTopUpRequests,
  getMyActiveRequest,
  markAsPaid,
  getAllTopUpRequests,
  getPendingCount,
  approveTopUpRequest,
  rejectTopUpRequest,
} from '../controllers/wallet-topup.controller';

const router = Router();

// Аутентификация уже применена в index.ts: app.use('/api/wallet-topup', auth, walletTopUpRoutes)

// Клиентские роуты
router.post('/', createTopUpRequest);
router.get('/my', getMyTopUpRequests);
router.get('/my/active', getMyActiveRequest);
router.put('/:id/paid', markAsPaid);

// Админские роуты
router.get('/admin', getAllTopUpRequests);
router.get('/admin/count', getPendingCount);
router.put('/admin/:id/approve', approveTopUpRequest);
router.put('/admin/:id/reject', rejectTopUpRequest);

export default router;
