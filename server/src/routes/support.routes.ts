import { Router } from 'express';
import {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket,
} from '../controllers/support.controller';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import {
  createSupportTicketSchema,
  updateSupportTicketSchema,
  idParamSchema,
} from '../validations/schemas';

const router = Router();

// GET /api/support - получить все обращения пользователя
router.get('/', getAllTickets);

// GET /api/support/:id - получить обращение по ID
router.get('/:id', validateParams(idParamSchema), getTicketById);

// POST /api/support - создать новое обращение
router.post('/', validateBody(createSupportTicketSchema), createTicket);

// PUT /api/support/:id - обновить обращение
router.put('/:id', validateParams(idParamSchema), validateBody(updateSupportTicketSchema), updateTicket);

// DELETE /api/support/:id - удалить обращение
router.delete('/:id', validateParams(idParamSchema), deleteTicket);

export default router;



