import { Router } from 'express';
import {
  createPaymentRequest,
  getMyPaymentRequests,
  getPendingPaymentRequests,
  getPendingCount,
  approvePaymentRequest,
  rejectPaymentRequest,
} from '../controllers/payment-request.controller';

const router = Router();

// Клиентские роуты
router.post('/', createPaymentRequest);
router.get('/my', getMyPaymentRequests);

// Админские роуты
router.get('/admin', getPendingPaymentRequests);
router.get('/admin/count', getPendingCount);
router.put('/admin/:id/approve', approvePaymentRequest);
router.put('/admin/:id/reject', rejectPaymentRequest);

export default router;
