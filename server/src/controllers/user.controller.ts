import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { Plan, Role } from '@prisma/client';

// Получить профиль пользователя (включая план)
export async function getUserProfile(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    // Ищем пользователя по email
    let user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Если пользователь не найден, создаем нового с планом Start
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: userEmail.split('@')[0] || 'Пользователь',
          password: '', // В реальном приложении пароль хранится в Supabase
          plan: Plan.Start,
          role: Role.user,
        },
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    if (!user) {
      return res.status(500).json({ error: 'Не удалось создать или получить пользователя' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error: any) {
    console.error('Ошибка при получении профиля пользователя:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      name: error.name,
      meta: error.meta,
    });
    
    // Проверяем, связана ли ошибка с подключением к БД
    if (error.code === 'P1001' || error.message?.includes('Can\'t reach database server')) {
      return res.status(500).json({ 
        error: 'Ошибка подключения к базе данных',
        message: 'Не удалось подключиться к базе данных. Проверьте DATABASE_URL в переменных окружения.',
        details: {
          code: error.code,
          message: error.message,
        }
      });
    }
    
    // Проверяем, связана ли ошибка с отсутствием таблицы
    if (error.code === 'P2025' || error.message?.includes('does not exist')) {
      return res.status(500).json({ 
        error: 'Таблица не найдена',
        message: 'Таблица users не существует. Выполните миграции: npm run prisma:migrate',
        details: {
          code: error.code,
          message: error.message,
        }
      });
    }
    
    res.status(500).json({ 
      error: 'Ошибка при получении профиля пользователя',
      message: error.message || 'Неизвестная ошибка',
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        name: error.name,
        stack: error.stack,
      } : undefined
    });
  }
}

// Обновить план пользователя
export async function updateUserPlan(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;
    const { plan } = req.body;

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    if (!plan || !['Start', 'Pro', 'Business'].includes(plan)) {
      return res.status(400).json({ error: 'Неверный план подписки. Допустимые значения: Start, Pro, Business' });
    }

    // Ищем пользователя по email
    let user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    // Если пользователь не найден, создаем нового
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: userEmail.split('@')[0] || 'Пользователь',
          password: '', // В реальном приложении пароль хранится в Supabase
          plan: plan as Plan,
          role: Role.user,
        },
      });
    } else {
      // Обновляем план существующего пользователя
      user = await prisma.user.update({
        where: { email: userEmail },
        data: { plan: plan as Plan },
      });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      message: 'План подписки успешно обновлен',
    });
  } catch (error) {
    console.error('Ошибка при обновлении плана пользователя:', error);
    res.status(500).json({ error: 'Ошибка при обновлении плана пользователя' });
  }
}

