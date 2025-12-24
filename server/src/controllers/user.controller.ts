import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { Plan } from '@prisma/client';

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

    // Если пользователь не найден, создаем нового с планом Free
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: userEmail.split('@')[0] || 'Пользователь',
          password: '', // В реальном приложении пароль хранится в Supabase
          plan: Plan.Free,
        },
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          createdAt: true,
          updatedAt: true,
        },
      });
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
  } catch (error) {
    console.error('Ошибка при получении профиля пользователя:', error);
    res.status(500).json({ error: 'Ошибка при получении профиля пользователя' });
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

    if (!plan || !['Free', 'Pro', 'Business'].includes(plan)) {
      return res.status(400).json({ error: 'Неверный план подписки. Допустимые значения: Free, Pro, Business' });
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

