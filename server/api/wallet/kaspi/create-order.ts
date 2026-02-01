import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';

// Создаем мини-приложение Express для обработки запроса
const app = express();
app.use(express.json());

// Импортируем необходимые модули
import { createKaspiDepositOrder } from '../../../src/controllers/wallet.controller';
import { validateBody } from '../../../src/middleware/validation.middleware';
import { addFundsSchema } from '../../../src/validations/schemas';
import { authMiddleware } from '../../../src/middleware/auth.middleware';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[api/wallet/kaspi/create-order.ts] ⚠️⚠️⚠️ ЗАПРОС ПОЛУЧЕН:', {
    method: req.method,
    url: req.url,
    path: (req as any).path,
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешен' });
  }

  // Преобразуем VercelRequest в Express Request
  const expressReq = req as any;
  const expressRes = res as any;

  try {
    // Применяем auth middleware
    await new Promise<void>((resolve, reject) => {
      authMiddleware(expressReq, expressRes, (err?: any) => {
        if (err) {
          console.error('[api/wallet/kaspi/create-order.ts] Auth error:', err);
          return reject(err);
        }
        if (expressRes.headersSent) {
          console.log('[api/wallet/kaspi/create-order.ts] Response already sent by auth');
          return;
        }
        resolve();
      });
    });

    if (expressRes.headersSent) {
      return;
    }

    // Применяем validation middleware
    await new Promise<void>((resolve, reject) => {
      validateBody(addFundsSchema)(expressReq, expressRes, (err?: any) => {
        if (err) {
          console.error('[api/wallet/kaspi/create-order.ts] Validation error:', err);
          return reject(err);
        }
        if (expressRes.headersSent) {
          console.log('[api/wallet/kaspi/create-order.ts] Response already sent by validation');
          return;
        }
        resolve();
      });
    });

    if (expressRes.headersSent) {
      return;
    }

    // Вызываем контроллер
    console.log('[api/wallet/kaspi/create-order.ts] Вызываем createKaspiDepositOrder');
    await createKaspiDepositOrder(expressReq, expressRes);
  } catch (error: any) {
    console.error('[api/wallet/kaspi/create-order.ts] Ошибка:', error);
    if (!expressRes.headersSent && !res.headersSent) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Ошибка при создании заказа',
        details: error
      });
    }
  }
}
