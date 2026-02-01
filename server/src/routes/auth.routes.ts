import { Router } from 'express';
import { register, login, logout, me, refreshToken } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Публичные роуты (без авторизации)
router.post('/register', register);
router.post('/login', login);

// Защищённые роуты (требуют авторизации)
router.get('/me', authMiddleware, me);
router.post('/logout', authMiddleware, logout);
router.post('/refresh', authMiddleware, refreshToken);

export default router;
