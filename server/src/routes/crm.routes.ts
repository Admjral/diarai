import { Router } from 'express';
import { CRMController } from '../controllers/crm.controller';

const router = Router();

router.get('/stats', CRMController.getStats);
router.get('/all', CRMController.getAll);

export default router;



