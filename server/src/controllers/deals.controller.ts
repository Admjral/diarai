import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getUserIdByEmail } from '../utils/userHelper';
import { createNotification } from '../services/notification.service';
import { NotificationType } from '@prisma/client';

export class DealsController {
  // Получить все сделки пользователя
  static async getDeals(req: Request, res: Response) {
    try {
      const userEmail = req.user?.email;

      if (!userEmail) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      const userId = await getUserIdByEmail(userEmail);

      const deals = await prisma.deal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      res.json(deals);
    } catch (error) {
      console.error('Ошибка при получении сделок:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }

  // Получить сделку по ID
  static async getDealById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userEmail = req.user?.email;

      if (!userEmail) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      const userId = await getUserIdByEmail(userEmail);

      const deal = await prisma.deal.findFirst({
        where: { 
          id: parseInt(id, 10),
          userId 
        },
      });

      if (!deal) {
        return res.status(404).json({ error: 'Сделка не найдена' });
      }

      res.json(deal);
    } catch (error) {
      console.error('Ошибка при получении сделки:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }

  // Создать новую сделку
  static async createDeal(req: Request, res: Response) {
    try {
      const userEmail = req.user?.email;
      const { name, clientName, amount, currency, stage, probability, expectedCloseDate, notes, clientId } = req.body;

      if (!userEmail) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      // Строгая проверка поля name
      if (!name || typeof name !== 'string' || name.trim() === '') {
        console.log('Отладочная информация - полученные данные:', req.body);
        return res.status(400).json({ error: 'Необходимо поле: name (не может быть пустым)' });
      }

      const userId = await getUserIdByEmail(userEmail);

      // Обработка amount - может быть строкой или числом
      let amountValue = 0;
      if (amount !== undefined && amount !== null && amount !== '') {
        const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        amountValue = isNaN(parsedAmount) ? 0 : parsedAmount;
      }

      const deal = await prisma.deal.create({
        data: {
          name: name.trim(),
          clientName: clientName && typeof clientName === 'string' ? clientName.trim() : name.trim(),
          amount: amountValue,
          currency: currency || '₸',
          stage: stage || 'lead',
          probability: probability ? parseInt(probability.toString(), 10) : 0,
          expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
          notes: notes || null,
          userId,
          clientId: clientId ? parseInt(clientId.toString(), 10) : null,
        },
      });

      res.status(201).json(deal);
    } catch (error: any) {
      console.error('Ошибка при создании сделки:', error);
      
      if (error?.code === 'P2002') {
        return res.status(409).json({ error: 'Сделка с такими данными уже существует' });
      }
      
      res.status(500).json({ 
        error: 'Ошибка сервера',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    }
  }

  // Обновить сделку
  static async updateDeal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userEmail = req.user?.email;
      const { name, clientName, amount, currency, stage, probability, expectedCloseDate, notes, clientId } = req.body;

      if (!userEmail) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      const userId = await getUserIdByEmail(userEmail);

      const deal = await prisma.deal.findFirst({
        where: { 
          id: parseInt(id, 10),
          userId 
        },
      });

      if (!deal) {
        return res.status(404).json({ error: 'Сделка не найдена' });
      }

      const updatedDeal = await prisma.deal.update({
        where: { id: parseInt(id, 10) },
        data: {
          ...(name && { name }),
          ...(clientName !== undefined && { clientName }),
          ...(amount !== undefined && { amount: parseFloat(amount) }),
          ...(currency && { currency }),
          ...(stage && { stage }),
          ...(probability !== undefined && { probability }),
          ...(expectedCloseDate !== undefined && { expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null }),
          ...(notes !== undefined && { notes }),
          ...(clientId !== undefined && { clientId }),
        },
      });

      // Отправляем уведомление при закрытии сделки
      if (stage && (stage === 'closed_won' || stage === 'closed_lost') && deal.stage !== stage) {
        try {
          const isWon = stage === 'closed_won';
          await createNotification({
            userId,
            type: NotificationType.deal_closed,
            title: isWon ? 'Сделка выиграна!' : 'Сделка проиграна',
            message: isWon
              ? `Сделка "${updatedDeal.name}" успешно закрыта. Сумма: ${updatedDeal.amount} ${updatedDeal.currency}`
              : `Сделка "${updatedDeal.name}" закрыта как проигранная.`,
            data: {
              dealId: updatedDeal.id,
              dealName: updatedDeal.name,
              amount: updatedDeal.amount.toString(),
              currency: updatedDeal.currency,
              stage: stage,
            },
          });
        } catch (error: any) {
          console.error('[deals.controller] Ошибка отправки уведомления о закрытии сделки:', error);
          // Не блокируем обновление сделки из-за ошибки уведомления
        }
      }

      res.json(updatedDeal);
    } catch (error: any) {
      console.error('Ошибка при обновлении сделки:', error);
      
      if (error?.code === 'P2025') {
        return res.status(404).json({ error: 'Сделка не найдена' });
      }
      
      res.status(500).json({ 
        error: 'Ошибка сервера',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    }
  }

  // Удалить сделку
  static async deleteDeal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userEmail = req.user?.email;

      if (!userEmail) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      const userId = await getUserIdByEmail(userEmail);

      const deal = await prisma.deal.findFirst({
        where: { 
          id: parseInt(id, 10),
          userId 
        },
      });

      if (!deal) {
        return res.status(404).json({ error: 'Сделка не найдена' });
      }

      await prisma.deal.delete({
        where: { id: parseInt(id, 10) },
      });

      res.json({ message: 'Сделка удалена' });
    } catch (error) {
      console.error('Ошибка при удалении сделки:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
}

