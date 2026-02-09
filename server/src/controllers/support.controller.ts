import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { SupportTicketStatus, SupportTicketPriority } from '@prisma/client';

// Получить все обращения пользователя
export async function getAllTickets(req: Request, res: Response) {
  try {
    const userPhone = req.user?.phone;

    if (!userPhone) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    // Проверяем доступность модели supportTicket перед использованием
    const supportTicketModel = (prisma as any).supportTicket;
    if (!supportTicketModel || typeof supportTicketModel.findMany !== 'function') {
      const errorDetails = {
        message: 'Модель SupportTicket не найдена в Prisma Client. Prisma Client нужно перегенерировать.',
        code: 'PRISMA_MODEL_NOT_FOUND',
        solution: 'Выполните следующие команды:',
        steps: [
          '1. Откройте терминал',
          '2. Перейдите в папку server: cd server',
          '3. Запустите: npx prisma generate',
          '4. Убедитесь, что таблица support_tickets создана в базе данных',
          '5. Перезапустите сервер: npm run dev'
        ],
      };
      
      console.error('[getAllTickets] Модель SupportTicket недоступна в Prisma Client');
      console.error('[getAllTickets] Детали:', errorDetails);
      
      return res.status(500).json({ 
        error: 'Модель SupportTicket не найдена. Необходимо перегенерировать Prisma Client.',
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
      });
    }

    // Ищем пользователя по email
    const user = await prisma.user.findUnique({
      where: { phone: userPhone },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Получаем все обращения пользователя
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(tickets);
  } catch (error: any) {
    console.error('Ошибка при получении обращений:', error);
    console.error('Детали ошибки:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    
    // Проверяем, является ли ошибка ошибкой отсутствия таблицы
    if (error?.code === 'P2021' || error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return res.status(500).json({ 
        error: 'Таблица support_tickets не найдена в базе данных',
        details: process.env.NODE_ENV === 'development' ? {
          message: error?.message,
          solution: 'Выполните миграцию: server/prisma/migrations/add_support_tickets.sql в Supabase SQL Editor',
        } : undefined,
      });
    }
    
    res.status(500).json({ 
      error: 'Ошибка при получении обращений',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
}

// Получить обращение по ID
export async function getTicketById(req: Request, res: Response) {
  try {
    const userPhone = req.user?.phone;
    const ticketId = parseInt(req.params.id);

    if (!userPhone) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    if (isNaN(ticketId)) {
      return res.status(400).json({ error: 'Неверный ID обращения' });
    }

    // Ищем пользователя по email
    const user = await prisma.user.findUnique({
      where: { phone: userPhone },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Получаем обращение
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: user.id, // Проверяем, что обращение принадлежит пользователю
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Обращение не найдено' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Ошибка при получении обращения:', error);
    res.status(500).json({ error: 'Ошибка при получении обращения' });
  }
}

// Создать новое обращение
export async function createTicket(req: Request, res: Response) {
  try {
    const userPhone = req.user?.phone;
    const { subject, message, priority } = req.body;

    if (!userPhone) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    if (!subject || !message) {
      return res.status(400).json({ error: 'Тема и сообщение обязательны' });
    }

    // Ищем пользователя по email
    let user = await prisma.user.findUnique({
      where: { phone: userPhone },
    });

    // Если пользователь не найден, создаем нового
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: userPhone,
          name: 'Пользователь',
          password: '', // В реальном приложении пароль хранится в Supabase
        },
      });
    }

    // Создаем обращение
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject: subject.trim(),
        message: message.trim(),
        priority: (priority || 'medium') as SupportTicketPriority,
        status: SupportTicketStatus.open,
      },
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Ошибка при создании обращения:', error);
    res.status(500).json({ error: 'Ошибка при создании обращения' });
  }
}

// Обновить обращение (только для администраторов или самого пользователя)
export async function updateTicket(req: Request, res: Response) {
  try {
    const userPhone = req.user?.phone;
    const ticketId = parseInt(req.params.id);
    const { status, response } = req.body;

    if (!userPhone) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    if (isNaN(ticketId)) {
      return res.status(400).json({ error: 'Неверный ID обращения' });
    }

    // Ищем пользователя по email
    const user = await prisma.user.findUnique({
      where: { phone: userPhone },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем, что обращение принадлежит пользователю
    const existingTicket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: user.id,
      },
    });

    if (!existingTicket) {
      return res.status(404).json({ error: 'Обращение не найдено' });
    }

    // Обновляем обращение
    const updateData: any = {};
    if (status) {
      updateData.status = status as SupportTicketStatus;
    }
    if (response !== undefined) {
      updateData.response = response ? response.trim() : null;
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
    });

    res.json(ticket);
  } catch (error) {
    console.error('Ошибка при обновлении обращения:', error);
    res.status(500).json({ error: 'Ошибка при обновлении обращения' });
  }
}

// Удалить обращение
export async function deleteTicket(req: Request, res: Response) {
  try {
    const userPhone = req.user?.phone;
    const ticketId = parseInt(req.params.id);

    if (!userPhone) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    if (isNaN(ticketId)) {
      return res.status(400).json({ error: 'Неверный ID обращения' });
    }

    // Ищем пользователя по email
    const user = await prisma.user.findUnique({
      where: { phone: userPhone },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем, что обращение принадлежит пользователю
    const existingTicket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: user.id,
      },
    });

    if (!existingTicket) {
      return res.status(404).json({ error: 'Обращение не найдено' });
    }

    // Удаляем обращение
    await prisma.supportTicket.delete({
      where: { id: ticketId },
    });

    res.json({ message: 'Обращение успешно удалено' });
  } catch (error) {
    console.error('Ошибка при удалении обращения:', error);
    res.status(500).json({ error: 'Ошибка при удалении обращения' });
  }
}

