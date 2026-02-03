import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { Role, WalletTopUpStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

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
 * POST /api/wallet-topup
 * Создать запрос на пополнение кошелька (клиент)
 */
export async function createTopUpRequest(req: Request, res: Response) {
  try {
    const { amount, note } = req.body;
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    // Валидация суммы
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount < 100) {
      return res.status(400).json({ error: 'Минимальная сумма пополнения 100 ₸' });
    }

    if (numAmount > 10000000) {
      return res.status(400).json({ error: 'Максимальная сумма пополнения 10,000,000 ₸' });
    }

    const userId = await getUserIdByEmail(userEmail);
    if (!userId) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверить нет ли уже активного запроса (pending_payment или paid)
    const existingRequest = await prisma.walletTopUpRequest.findFirst({
      where: {
        userId,
        status: {
          in: [WalletTopUpStatus.pending_payment, WalletTopUpStatus.paid],
        },
      },
    });

    if (existingRequest) {
      return res.status(400).json({
        error: 'У вас уже есть активный запрос на пополнение',
        existingRequest,
      });
    }

    const request = await prisma.walletTopUpRequest.create({
      data: {
        userId,
        amount: new Decimal(numAmount),
        status: WalletTopUpStatus.pending_payment,
        note: note || null,
      },
    });

    res.status(201).json({
      message: 'Запрос создан. Оплатите по QR-коду и нажмите "Оплатил".',
      request,
    });
  } catch (error) {
    console.error('Ошибка при создании запроса на пополнение:', error);
    res.status(500).json({ error: 'Ошибка при создании запроса' });
  }
}

/**
 * GET /api/wallet-topup/my
 * Получить мои запросы (клиент)
 */
export async function getMyTopUpRequests(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const userId = await getUserIdByEmail(userEmail);
    if (!userId) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const requests = await prisma.walletTopUpRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json(requests);
  } catch (error) {
    console.error('Ошибка при получении запросов:', error);
    res.status(500).json({ error: 'Ошибка при получении запросов' });
  }
}

/**
 * GET /api/wallet-topup/my/active
 * Получить активный запрос пользователя (для проверки статуса)
 */
export async function getMyActiveRequest(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const userId = await getUserIdByEmail(userEmail);
    if (!userId) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const request = await prisma.walletTopUpRequest.findFirst({
      where: {
        userId,
        status: {
          in: [WalletTopUpStatus.pending_payment, WalletTopUpStatus.paid],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(request);
  } catch (error) {
    console.error('Ошибка при получении активного запроса:', error);
    res.status(500).json({ error: 'Ошибка при получении запроса' });
  }
}

/**
 * PUT /api/wallet-topup/:id/paid
 * Отметить запрос как "Оплатил" (клиент)
 */
export async function markAsPaid(req: Request, res: Response) {
  try {
    const requestId = parseInt(req.params.id);
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const userId = await getUserIdByEmail(userEmail);
    if (!userId) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Найти запрос
    const request = await prisma.walletTopUpRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    // Проверить, что это запрос текущего пользователя
    if (request.userId !== userId) {
      return res.status(403).json({ error: 'Нет доступа к этому запросу' });
    }

    // Проверить статус
    if (request.status !== WalletTopUpStatus.pending_payment) {
      return res.status(400).json({ error: 'Запрос уже обработан или отмечен как оплаченный' });
    }

    const updatedRequest = await prisma.walletTopUpRequest.update({
      where: { id: requestId },
      data: {
        status: WalletTopUpStatus.paid,
        paidAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Ожидайте подтверждения от администратора',
      request: updatedRequest,
    });
  } catch (error) {
    console.error('Ошибка при отметке оплаты:', error);
    res.status(500).json({ error: 'Ошибка при обновлении статуса' });
  }
}

/**
 * GET /api/wallet-topup/admin
 * Получить все запросы (админ)
 */
export async function getAllTopUpRequests(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { status } = req.query;

    const whereClause = status
      ? { status: status as WalletTopUpStatus }
      : {};

    const requests = await prisma.walletTopUpRequest.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Счетчики по статусам
    const pendingPaymentCount = await prisma.walletTopUpRequest.count({
      where: { status: WalletTopUpStatus.pending_payment },
    });

    const paidCount = await prisma.walletTopUpRequest.count({
      where: { status: WalletTopUpStatus.paid },
    });

    res.json({
      requests,
      counts: {
        pending_payment: pendingPaymentCount,
        paid: paidCount,
      },
    });
  } catch (error) {
    console.error('Ошибка при получении запросов:', error);
    res.status(500).json({ error: 'Ошибка при получении запросов' });
  }
}

/**
 * GET /api/wallet-topup/admin/count
 * Получить количество запросов требующих внимания (для badge)
 */
export async function getPendingCount(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    // Считаем только "paid" - те что ждут подтверждения админа
    const count = await prisma.walletTopUpRequest.count({
      where: { status: WalletTopUpStatus.paid },
    });

    res.json({ count });
  } catch (error) {
    console.error('Ошибка при получении счетчика:', error);
    res.status(500).json({ error: 'Ошибка при получении счетчика' });
  }
}

/**
 * PUT /api/wallet-topup/admin/:id/approve
 * Подтвердить пополнение (админ)
 */
export async function approveTopUpRequest(req: Request, res: Response) {
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
    const request = await prisma.walletTopUpRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    if (request.status !== WalletTopUpStatus.paid) {
      return res.status(400).json({
        error: 'Можно подтвердить только запросы со статусом "Оплатил"',
      });
    }

    // Транзакция: обновить запрос + пополнить кошелек
    const result = await prisma.$transaction(async (tx) => {
      // 1. Найти или создать кошелек
      let wallet = await tx.wallet.findUnique({
        where: { userId: request.userId },
      });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId: request.userId,
            balance: new Decimal(0),
          },
        });
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = new Decimal(balanceBefore).add(request.amount);

      // 2. Обновить баланс кошелька
      const updatedWallet = await tx.wallet.update({
        where: { userId: request.userId },
        data: {
          balance: balanceAfter,
        },
      });

      // 3. Создать транзакцию
      await tx.walletTransaction.create({
        data: {
          userId: request.userId,
          walletId: wallet.id,
          type: 'deposit',
          amount: request.amount,
          balanceBefore: balanceBefore,
          balanceAfter: balanceAfter,
          description: `Пополнение кошелька #${requestId}`,
        },
      });

      // 4. Обновить статус запроса
      const updatedRequest = await tx.walletTopUpRequest.update({
        where: { id: requestId },
        data: {
          status: WalletTopUpStatus.approved,
          adminNote: adminNote || null,
          processedAt: new Date(),
          processedBy: adminId,
        },
      });

      return { request: updatedRequest, wallet: updatedWallet };
    });

    res.json({
      success: true,
      message: `Пополнение на ${request.amount} ₸ подтверждено`,
      request: result.request,
      newBalance: result.wallet.balance,
    });
  } catch (error) {
    console.error('Ошибка при подтверждении пополнения:', error);
    res.status(500).json({ error: 'Ошибка при подтверждении' });
  }
}

/**
 * PUT /api/wallet-topup/admin/:id/reject
 * Отклонить запрос (админ)
 */
export async function rejectTopUpRequest(req: Request, res: Response) {
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
    const request = await prisma.walletTopUpRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    if (request.status === WalletTopUpStatus.approved) {
      return res.status(400).json({ error: 'Нельзя отклонить уже подтвержденный запрос' });
    }

    const updatedRequest = await prisma.walletTopUpRequest.update({
      where: { id: requestId },
      data: {
        status: WalletTopUpStatus.rejected,
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
    res.status(500).json({ error: 'Ошибка при отклонении' });
  }
}
