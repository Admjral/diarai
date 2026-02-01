import { Router, Request, Response, NextFunction } from 'express';
import { getWallet, addFunds, withdrawFunds, updateCurrency, getTransactions } from '../controllers/wallet.controller';
import { validateBody } from '../middleware/validation.middleware';
import { addFundsSchema, withdrawFundsSchema, updateCurrencySchema } from '../validations/schemas';

const router = Router();

// Обертка для обработки ошибок с гарантированной передачей деталей
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error: any) => {
      console.error('[asyncHandler] Перехвачена ошибка:', error);
      console.error('[asyncHandler] Тип ошибки:', error.constructor.name);
      console.error('[asyncHandler] Сообщение:', error.message);
      console.error('[asyncHandler] Stack:', error.stack);
      
      // Если ответ еще не отправлен, отправляем детали ошибки
      if (!res.headersSent) {
        const errorDetails: any = {
          message: String(error.message || 'Неизвестная ошибка'),
          code: String(error.code || 'UNKNOWN'),
          name: String(error.name || 'Error'),
        };
        
        // Проверяем, связана ли ошибка с отсутствием модели Wallet
        if (error.message?.includes('wallet') || 
            error.message?.includes('Wallet') ||
            error.message?.includes('is not a function') ||
            error.message?.includes('Unknown model')) {
          errorDetails.code = 'PRISMA_MODEL_NOT_FOUND';
          errorDetails.solution = 'Выполните: cd server && npm run prisma:generate';
          errorDetails.steps = [
            '1. Откройте терминал',
            '2. Перейдите в папку server: cd server',
            '3. Запустите: npm run prisma:generate',
            '4. Перезапустите сервер: npm run dev'
          ];
        }
        
        if (process.env.NODE_ENV === 'development') {
          if (error.stack) {
            errorDetails.stack = String(error.stack).split('\n').slice(0, 10).join('\n');
          }
          if (error.meta) {
            errorDetails.meta = error.meta;
          }
        }
        
        console.error('[asyncHandler] Отправляем детали ошибки:', JSON.stringify(errorDetails, null, 2));
        
        const responseData = {
          error: error.message || 'Ошибка при обработке запроса',
          message: errorDetails.message,
          details: errorDetails,
        };
        
        try {
          res.status(500).json(responseData);
          console.error('[asyncHandler] Ответ успешно отправлен');
        } catch (sendError: any) {
          console.error('[asyncHandler] Ошибка при отправке ответа:', sendError);
          if (!res.headersSent) {
            res.status(500).send(JSON.stringify(responseData));
          }
        }
      } else {
        console.error('[asyncHandler] Ответ уже отправлен, передаем ошибку дальше');
        next(error);
      }
    });
  };
};

// GET /api/wallet - получить кошелек пользователя
router.get('/', asyncHandler(getWallet));

// ПРИМЕЧАНИЕ: Маршруты kaspi перенесены в api/index.ts для прямого доступа
// Это необходимо для правильной работы на Vercel

// POST /api/wallet/add - пополнить кошелек
router.post('/add', validateBody(addFundsSchema), addFunds);

// POST /api/wallet/withdraw - снять средства с кошелька
router.post('/withdraw', validateBody(withdrawFundsSchema), withdrawFunds);

// PUT /api/wallet/currency - обновить валюту кошелька
router.put('/currency', validateBody(updateCurrencySchema), updateCurrency);

// GET /api/wallet/transactions - получить историю транзакций
router.get('/transactions', asyncHandler(getTransactions));

export default router;

