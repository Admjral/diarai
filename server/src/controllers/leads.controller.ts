import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getUserIdByEmail } from '../utils/userHelper';
import { createNotification } from '../services/notification.service';
import { NotificationType } from '@prisma/client';

export class LeadsController {
  // Получить все лиды пользователя
  static async getLeads(req: Request, res: Response) {
    try {
      const userEmail = req.user?.email;
      
      // Безопасное логирование без чувствительных данных
      console.log('[leads] Запрос на получение лидов от:', userEmail);
      
      if (!userEmail) {
        console.error('Email пользователя не предоставлен');
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      // Получаем userId из базы данных по email
      let userId: number;
      try {
        userId = await getUserIdByEmail(userEmail);
      } catch (error: any) {
        console.error('[leads] Ошибка получения userId:', error.message);
        return res.status(500).json({
          error: 'Ошибка при получении данных пользователя',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }

      const leads = await prisma.lead.findMany({
        where: { userId },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      console.log('[leads] Найдено лидов:', leads.length);
      res.json(leads);
    } catch (error: any) {
      console.error('[leads] Ошибка получения лидов:', error.message);
      res.status(500).json({
        error: 'Ошибка сервера',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Получить лид по ID
  static async getLeadById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userEmail = req.user?.email;

      if (!userEmail) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      const userId = await getUserIdByEmail(userEmail);

      const lead = await prisma.lead.findFirst({
        where: { 
          id: parseInt(id, 10),
          userId 
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Лид не найден' });
      }

      res.json(lead);
    } catch (error) {
      console.error('Ошибка при получении лида:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }

  // Создать новый лид
  static async createLead(req: Request, res: Response) {
    try {
      const userEmail = req.user?.email;
      const { name, phone, email, status, source, stage, lastAction, notes, campaignId } = req.body;

      if (!userEmail) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      if (!name || !phone || !email) {
        return res.status(400).json({ error: 'Необходимы поля: name, phone, email' });
      }

      // Валидация email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Неверный формат email адреса' });
      }

      const userId = await getUserIdByEmail(userEmail);

      // Проверяем, что кампания принадлежит пользователю, если campaignId указан
      if (campaignId) {
        const campaign = await prisma.campaign.findFirst({
          where: {
            id: campaignId,
            userId,
          },
        });
        if (!campaign) {
          return res.status(404).json({ error: 'Кампания не найдена или не принадлежит пользователю' });
        }
      }

      const lead = await prisma.lead.create({
        data: {
          name,
          phone,
          email,
          status: status || 'new',
          source: source || 'Другое',
          notes: notes || null,
          campaignId: campaignId || null,
          userId,
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      // Отправляем уведомление о новом лиде
      try {
        await createNotification({
          userId,
          type: NotificationType.new_lead,
          title: 'Новый лид',
          message: `Получен новый лид: ${name} (${phone})`,
          data: {
            leadId: lead.id,
            leadName: name,
            leadPhone: phone,
            leadEmail: email,
            source: source || 'Другое',
          },
        });
      } catch (error: any) {
        console.error('[leads.controller] Ошибка отправки уведомления о новом лиде:', error);
        // Не блокируем создание лида из-за ошибки уведомления
      }

      res.status(201).json(lead);
    } catch (error: any) {
      console.error('Ошибка при создании лида:', error);
      
      // Более детальная обработка ошибок
      if (error?.code === 'P2002') {
        return res.status(409).json({ error: 'Лид с таким email уже существует' });
      }
      
      if (error?.code === 'P2003') {
        return res.status(400).json({ error: 'Неверный userId' });
      }
      
      res.status(500).json({ 
        error: 'Ошибка сервера',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    }
  }

  // Обновить лид
  static async updateLead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userEmail = req.user?.email;
      const { name, phone, email, status, source, stage, lastAction, notes, campaignId } = req.body;

      if (!userEmail) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      // Валидация ID
      const leadId = parseInt(id, 10);
      if (isNaN(leadId)) {
        return res.status(400).json({ error: 'Неверный формат ID' });
      }

      // Валидация email если он передан
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({ error: 'Неверный формат email адреса' });
        }
      }

      const userId = await getUserIdByEmail(userEmail);

      const lead = await prisma.lead.findFirst({
        where: { 
          id: leadId,
          userId 
        },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Лид не найден' });
      }

      // Проверяем, что кампания принадлежит пользователю, если campaignId указан
      if (campaignId !== undefined) {
        if (campaignId !== null) {
          const campaign = await prisma.campaign.findFirst({
            where: {
              id: campaignId,
              userId,
            },
          });
          if (!campaign) {
            return res.status(404).json({ error: 'Кампания не найдена или не принадлежит пользователю' });
          }
        }
      }

      const updatedLead = await prisma.lead.update({
        where: { id: leadId },
        data: {
          ...(name && { name }),
          ...(phone && { phone }),
          ...(email && { email }),
          ...(status && { status }),
          ...(source !== undefined && { source }),
          ...(stage !== undefined && { stage }),
          ...(lastAction !== undefined && { lastAction: lastAction ? new Date(lastAction) : null }),
          ...(notes !== undefined && { notes }),
          ...(campaignId !== undefined && { campaignId: campaignId || null }),
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      res.json(updatedLead);
    } catch (error: any) {
      console.error('Ошибка при обновлении лида:', error);
      
      if (error?.code === 'P2025') {
        return res.status(404).json({ error: 'Лид не найден' });
      }
      
      res.status(500).json({ 
        error: 'Ошибка сервера',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    }
  }

  // Удалить лид
  static async deleteLead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userEmail = req.user?.email;

      if (!userEmail) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      // Валидация ID
      const leadId = parseInt(id, 10);
      if (isNaN(leadId)) {
        return res.status(400).json({ error: 'Неверный формат ID' });
      }

      const userId = await getUserIdByEmail(userEmail);

      const lead = await prisma.lead.findFirst({
        where: { 
          id: leadId,
          userId 
        },
      });

      if (!lead) {
        return res.status(404).json({ error: 'Лид не найден' });
      }

      await prisma.lead.delete({
        where: { id: leadId },
      });

      res.json({ message: 'Лид удален' });
    } catch (error: any) {
      console.error('Ошибка при удалении лида:', error);
      
      if (error?.code === 'P2025') {
        return res.status(404).json({ error: 'Лид не найден' });
      }
      
      res.status(500).json({ 
        error: 'Ошибка сервера',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    }
  }
}

