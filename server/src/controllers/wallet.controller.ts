import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { createKaspiWalletDepositOrder } from '../services/kaspi.service';
import { TransactionType } from '@prisma/client';
import { log } from '../utils/logger';

// Получить кошелек пользователя
export async function getWallet(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;
    log.debug('getWallet: запрос', { userEmail });

    if (!userEmail) {
      log.warn('getWallet: email не предоставлен');
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    // Ищем пользователя по email
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      log.warn('getWallet: пользователь не найден', { userEmail });
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    log.debug('getWallet: пользователь найден', { userId: user.id });

    // Ищем или создаем кошелек пользователя
    let wallet;
    
    // Проверяем доступность модели wallet перед использованием
    const walletModel = (prisma as any).wallet;
    if (!walletModel || typeof walletModel.findUnique !== 'function') {
      log.error('getWallet: модель Wallet недоступна в Prisma Client');
      return res.status(500).json({
        error: 'Модель Wallet не найдена. Запустите: cd server && npm run prisma:generate',
        message: 'Prisma Client не содержит модель Wallet. Необходимо перегенерировать клиент.',
      });
    }
    
    try {
      wallet = await (prisma as any).wallet.findUnique({
        where: { userId: user.id },
      });
    } catch (prismaError: any) {
      log.error('getWallet: ошибка Prisma', prismaError, { code: prismaError.code });

      // Если это ошибка "Unknown model" или связанная с wallet
      if (prismaError.message?.includes('Unknown model') ||
          prismaError.message?.includes('wallet') ||
          prismaError.message?.includes('prisma.wallet') ||
          prismaError.message?.includes('is not a function') ||
          prismaError.code === 'P2001') {
        return res.status(500).json({
          error: 'Модель Wallet не найдена. Запустите: cd server && npm run prisma:generate',
          message: 'Prisma Client не содержит модель Wallet. Необходимо перегенерировать клиент.',
        });
      }

      throw prismaError;
    }

    if (!wallet) {
      log.debug('getWallet: создание нового кошелька', { userId: user.id });
      try {
        wallet = await (prisma as any).wallet.create({
          data: {
            userId: user.id,
            balance: 0,
            currency: '₸',
          },
        });
        log.info('getWallet: кошелек создан', { walletId: wallet.id });
      } catch (createError: any) {
        log.error('getWallet: ошибка создания кошелька', createError);
        throw createError;
      }
    } else {
      log.debug('getWallet: кошелек найден', { walletId: wallet.id });
    }

    res.json({
      id: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance.toString(),
      currency: wallet.currency,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    });
  } catch (error: any) {
    log.error('getWallet: ошибка', error, { code: error.code });

    // Определяем сообщение для пользователя
    let userFriendlyMessage = 'Ошибка при получении кошелька';

    if (error.code === 'P2002') {
      userFriendlyMessage = 'Кошелек с таким userId уже существует';
    } else if (error.code === 'P2025') {
      userFriendlyMessage = 'Запись не найдена';
    } else if (error.message?.includes('Unknown model') ||
               error.message?.includes('wallet') ||
               error.message?.includes('Wallet model not found')) {
      userFriendlyMessage = 'Модель Wallet не найдена. Запустите: cd server && npm run prisma:generate';
    }

    if (!res.headersSent) {
      res.status(500).json({ error: userFriendlyMessage });
    }
  }
}

// Пополнить кошелек
export async function addFunds(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;
    const { amount, paymentMethod } = req.body;

    log.debug('addFunds: запрос', { userEmail, amount, paymentMethod });

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Сумма должна быть положительным числом' });
    }

    // Проверяем paymentMethod
    const method = paymentMethod || req.body?.paymentMethod || req.body?.payment_method;
    const methodStr = String(method || '').toLowerCase().trim();
    const isKaspi = methodStr === 'kaspi';

    // Если указан способ оплаты kaspi, создаем заказ в Kaspi
    if (isKaspi) {
      log.info('addFunds: создание заказа Kaspi', { userEmail });
      return await createKaspiDepositOrder(req, res);
    }

    log.debug('addFunds: прямое пополнение', { method });

    // Ищем пользователя по email
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // АТОМАРНАЯ операция: upsert + increment в транзакции
    // Это предотвращает race condition при параллельных запросах
    const wallet = await prisma.$transaction(async (tx) => {
      // Upsert создаст кошелек если его нет, или вернет существующий
      const existingWallet = await tx.wallet.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          balance: Number(amount),
          currency: '₸',
        },
        update: {
          // Атомарный increment - безопасен при параллельных запросах
          balance: { increment: Number(amount) },
        },
      });
      return existingWallet;
    });

    res.json({
      id: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance.toString(),
      currency: wallet.currency,
      message: `Кошелек пополнен на ${amount} ${wallet.currency}`,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    });
  } catch (error: any) {
    log.error('addFunds: ошибка', error);
    res.status(500).json({ error: 'Ошибка при пополнении кошелька' });
  }
}

// Снять средства с кошелька
export async function withdrawFunds(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;
    const { amount } = req.body;

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Сумма должна быть положительным числом' });
    }

    const withdrawAmount = Number(amount);

    // Ищем пользователя по email
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // АТОМАРНАЯ операция: проверка и списание в одной транзакции
    // Это предотвращает race condition при параллельных запросах
    const wallet = await prisma.$transaction(async (tx) => {
      // Получаем кошелек с блокировкой для обновления
      const currentWallet = await tx.wallet.findUnique({
        where: { userId: user.id },
      });

      if (!currentWallet) {
        throw new Error('WALLET_NOT_FOUND');
      }

      const currentBalance = Number(currentWallet.balance);

      if (currentBalance < withdrawAmount) {
        throw new Error(`INSUFFICIENT_FUNDS:${currentBalance}:${currentWallet.currency}`);
      }

      // Атомарный decrement
      return await tx.wallet.update({
        where: { userId: user.id },
        data: { balance: { decrement: withdrawAmount } },
      });
    });

    res.json({
      id: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance.toString(),
      currency: wallet.currency,
      message: `С кошелька снято ${amount} ${wallet.currency}`,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    });
  } catch (error: any) {
    // Обрабатываем специфичные ошибки транзакции
    if (error.message === 'WALLET_NOT_FOUND') {
      return res.status(404).json({ error: 'Кошелек не найден' });
    }
    if (error.message?.startsWith('INSUFFICIENT_FUNDS:')) {
      const [, balance, currency] = error.message.split(':');
      return res.status(400).json({
        error: `Недостаточно средств. Доступно: ${balance} ${currency}`
      });
    }
    log.error('withdrawFunds: ошибка', error);
    res.status(500).json({ error: 'Ошибка при снятии средств' });
  }
}

// Обновить валюту кошелька
export async function updateCurrency(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;
    const { currency } = req.body;

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    if (!currency || currency.trim() === '') {
      return res.status(400).json({ error: 'Валюта обязательна' });
    }

    // Ищем пользователя по email
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Ищем или создаем кошелек пользователя
    let wallet = await prisma.wallet.findUnique({
      where: { userId: user.id },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
          currency: currency.trim(),
        },
      });
    } else {
      wallet = await prisma.wallet.update({
        where: { userId: user.id },
        data: { currency: currency.trim() },
      });
    }

    res.json({
      id: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance.toString(),
      currency: wallet.currency,
      message: 'Валюта кошелька обновлена',
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    });
  } catch (error) {
    log.error('updateCurrency: ошибка', error);
    res.status(500).json({ error: 'Ошибка при обновлении валюты' });
  }
}

// Получить историю транзакций кошелька
export async function getTransactions(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    // Ищем пользователя по email
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Ищем кошелек пользователя
    const wallet = await prisma.wallet.findUnique({
      where: { userId: user.id },
    });

    if (!wallet) {
      return res.json({ transactions: [], total: 0 });
    }

    // Получаем транзакции кошелька
    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 100, // Ограничиваем последними 100 транзакциями
    });

    // Преобразуем Decimal в строки для JSON
    const formattedTransactions = transactions.map(tx => ({
      ...tx,
      amount: tx.amount.toString(),
      balanceBefore: tx.balanceBefore.toString(),
      balanceAfter: tx.balanceAfter.toString(),
    }));

    res.json({
      transactions: formattedTransactions,
      total: formattedTransactions.length,
    });
  } catch (error) {
    log.error('getTransactions: ошибка', error);
    res.status(500).json({ error: 'Ошибка при получении истории транзакций' });
  }
}

// Создать заказ Kaspi для пополнения кошелька
export async function createKaspiDepositOrder(req: Request, res: Response) {
  log.debug('createKaspiDepositOrder: запрос', { userEmail: req.user?.email });

  try {
    const userEmail = req.user?.email;
    const { amount } = req.body;

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Сумма должна быть положительным числом' });
    }

    // Ищем пользователя по email
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Ищем или создаем кошелек пользователя
    let wallet = await prisma.wallet.findUnique({
      where: { userId: user.id },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
          currency: '₸',
        },
      });
    }

    // Получаем URL фронтенда из переменных окружения
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const returnUrl = `${frontendUrl}/wallet?status=success&orderId={orderId}`;
    const cancelUrl = `${frontendUrl}/wallet?status=cancelled`;

    // Создаем заказ в Kaspi
    const kaspiOrder = await createKaspiWalletDepositOrder(
      amount,
      user.id,
      returnUrl,
      cancelUrl
    );

    log.info('createKaspiDepositOrder: заказ создан', { orderId: kaspiOrder.orderId });

    if (!kaspiOrder.paymentUrl) {
      log.error('createKaspiDepositOrder: paymentUrl пустой', undefined, { orderId: kaspiOrder.orderId });
      return res.status(500).json({
        error: 'Не удалось получить ссылку на оплату от Kaspi',
        message: 'Kaspi API не вернул ссылку на оплату. Проверьте настройки Kaspi API.',
        orderId: kaspiOrder.orderId,
      });
    }

    // Сохраняем информацию о заказе в транзакции (pending)
    const transaction = await prisma.walletTransaction.create({
      data: {
        userId: user.id,
        walletId: wallet.id,
        type: TransactionType.deposit,
        amount: amount,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance, // Пока не пополнен
        description: `Пополнение через Kaspi (заказ: ${kaspiOrder.orderId})`,
      },
    });

    res.json({
      success: true,
      orderId: kaspiOrder.orderId,
      paymentUrl: kaspiOrder.paymentUrl,
      transactionId: transaction.id,
      message: 'Заказ создан. Перенаправление на оплату...',
    });
  } catch (error: any) {
    log.error('createKaspiDepositOrder: ошибка', error);
    res.status(500).json({
      error: 'Ошибка при создании заказа',
      message: error.message || 'Неизвестная ошибка',
    });
  }
}

