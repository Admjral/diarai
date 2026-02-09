import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getUserIdByPhone } from '../utils/userHelper';

export class CRMController {
  // Получить статистику CRM
  static async getStats(req: Request, res: Response) {
    try {
      const userPhone = req.user?.phone;

      if (!userPhone) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      const userId = await getUserIdByPhone(userPhone);

      const [leadsCount, dealsCount, tasksCount, totalDealsAmount] = await Promise.all([
        prisma.lead.count({ where: { userId } }),
        prisma.deal.count({ where: { userId } }),
        prisma.task.count({ where: { userId, status: { not: 'done' } } }),
        prisma.deal.aggregate({
          where: { userId },
          _sum: { amount: true },
        }),
      ]);

      const activeLeads = await prisma.lead.count({
        where: { userId, status: 'contacted' },
      });

      const closedDeals = await prisma.deal.count({
        where: { userId, stage: { in: ['closed_won', 'closed_lost'] } },
      });

      res.json({
        leads: leadsCount,
        activeLeads,
        deals: dealsCount,
        closedDeals,
        tasks: tasksCount,
        totalAmount: totalDealsAmount._sum.amount || 0,
      });
    } catch (error) {
      console.error('Ошибка при получении статистики:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }

  // Получить все данные CRM (leads, deals, tasks)
  static async getAll(req: Request, res: Response) {
    try {
      const userPhone = req.user?.phone;

      if (!userPhone) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      const userId = await getUserIdByPhone(userPhone);

      const [leads, deals, tasks] = await Promise.all([
        prisma.lead.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.deal.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.task.findMany({
          where: { userId },
          orderBy: [
            { dueDate: 'asc' },
            { createdAt: 'desc' },
          ],
        }),
      ]);

      res.json({ leads, deals, tasks });
    } catch (error) {
      console.error('Ошибка при получении данных CRM:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
}

