import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { Plan, Role, PaymentRequestStatus } from '@prisma/client';

// Цены планов
const PLAN_PRICES: Record<string, number> = {
  Pro: 9900,
  Business: 24900,
};

// Проверка, является ли пользователь админом
async function isAdmin(req: Request): Promise<boolean> {
  const userEmail = req.user?.email;
  if (!userEmail) return false;

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { role: true },
  });

  return user?.role === Role.admin;
}

// Получить ID пользователя по email
async function getUserIdByEmail(email: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return user?.id || null;
}

/**
 * POST /api/payment-requests
 * Создать запрос на активацию подписки (клиент)
 */
export async function createPaymentRequest(req: Request, res: Response) {
  try {
    const { plan, note } = req.body;
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    // Валидация плана
    if (!plan || !['Pro', 'Business'].includes(plan)) {
      return res.status(400).json({ error: 'Выберите план Pro или Business' });
    }

    const userId = await getUserIdByEmail(userEmail);
    if (!userId) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверить нет ли уже pending запроса
    const existingRequest = await prisma.paymentRequest.findFirst({
      where: {
        userId,
        status: PaymentRequestStatus.pending,
      },
    });

    if (existingRequest) {
      return res.status(400).json({
        error: 'У вас уже есть запрос на рассмотрении',
        existingRequest,
      });
    }

    const amount = PLAN_PRICES[plan];

    const request = await prisma.paymentRequest.create({
      data: {
        userId,
        plan: plan as Plan,
        amount,
        status: PaymentRequestStatus.pending,
        note: note || null,
      },
    });

    res.status(201).json({
      message: 'Запрос создан. Ожидайте подтверждения от администратора.',
      request,
    });
  } catch (error) {
    console.error('Ошибка при создании запроса на оплату:', error);
    res.status(500).json({ error: 'Ошибка при создании запроса' });
  }
}

/**
 * GET /api/payment-requests/my
 * Получить мои запросы (клиент)
 */
export async function getMyPaymentRequests(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const userId = await getUserIdByEmail(userEmail);
    if (!userId) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const requests = await prisma.paymentRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json(requests);
  } catch (error) {
    console.error('Ошибка при получении запросов:', error);
    res.status(500).json({ error: 'Ошибка при получении запросов' });
  }
}

/**
 * GET /api/admin/payment-requests
 * Получить все pending запросы (админ)
 */
export async function getPendingPaymentRequests(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { status } = req.query;

    const whereClause = status
      ? { status: status as PaymentRequestStatus }
      : { status: PaymentRequestStatus.pending };

    const requests = await prisma.paymentRequest.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            plan: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Добавить счетчик pending
    const pendingCount = await prisma.paymentRequest.count({
      where: { status: PaymentRequestStatus.pending },
    });

    res.json({ requests, pendingCount });
  } catch (error) {
    console.error('Ошибка при получении запросов:', error);
    res.status(500).json({ error: 'Ошибка при получении запросов' });
  }
}

/**
 * GET /api/admin/payment-requests/count
 * Получить количество pending запросов (для badge)
 */
export async function getPendingCount(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const count = await prisma.paymentRequest.count({
      where: { status: PaymentRequestStatus.pending },
    });

    res.json({ count });
  } catch (error) {
    console.error('Ошибка при получении счетчика:', error);
    res.status(500).json({ error: 'Ошибка при получении счетчика' });
  }
}

/**
 * PUT /api/admin/payment-requests/:id/approve
 * Одобрить запрос (админ)
 */
export async function approvePaymentRequest(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const requestId = parseInt(req.params.id);
    const { adminNote } = req.body;
    const adminEmail = req.user?.email;

    if (!adminEmail) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const adminId = await getUserIdByEmail(adminEmail);

    // Найти запрос
    const request = await prisma.paymentRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    if (request.status !== PaymentRequestStatus.pending) {
      return res.status(400).json({ error: 'Запрос уже обработан' });
    }

    // Транзакция: обновить запрос + план пользователя
    const [updatedRequest, updatedUser] = await prisma.$transaction([
      prisma.paymentRequest.update({
        where: { id: requestId },
        data: {
          status: PaymentRequestStatus.approved,
          adminNote: adminNote || null,
          processedAt: new Date(),
          processedBy: adminId,
        },
      }),
      prisma.user.update({
        where: { id: request.userId },
        data: {
          plan: request.plan,
          subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 дней
        },
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          subscriptionExpiresAt: true,
        },
      }),
    ]);

    res.json({
      success: true,
      message: `Подписка ${request.plan} активирована для пользователя`,
      request: updatedRequest,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Ошибка при одобрении запроса:', error);
    res.status(500).json({ error: 'Ошибка при одобрении запроса' });
  }
}

/**
 * PUT /api/admin/payment-requests/:id/reject
 * Отклонить запрос (админ)
 */
export async function rejectPaymentRequest(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const requestId = parseInt(req.params.id);
    const { adminNote } = req.body;
    const adminEmail = req.user?.email;

    if (!adminEmail) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const adminId = await getUserIdByEmail(adminEmail);

    // Найти запрос
    const request = await prisma.paymentRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    if (request.status !== PaymentRequestStatus.pending) {
      return res.status(400).json({ error: 'Запрос уже обработан' });
    }

    const updatedRequest = await prisma.paymentRequest.update({
      where: { id: requestId },
      data: {
        status: PaymentRequestStatus.rejected,
        adminNote: adminNote || 'Оплата не подтверждена',
        processedAt: new Date(),
        processedBy: adminId,
      },
    });

    res.json({
      success: true,
      message: 'Запрос отклонен',
      request: updatedRequest,
    });
  } catch (error) {
    console.error('Ошибка при отклонении запроса:', error);
    res.status(500).json({ error: 'Ошибка при отклонении запроса' });
  }
}
