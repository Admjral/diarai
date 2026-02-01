import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { IntegrationStatus } from '@prisma/client';

// Получить все интеграции пользователя
export async function getIntegrations(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Получаем все интеграции пользователя
    const integrations = await prisma.integrations.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(integrations);
  } catch (error: any) {
    console.error('Ошибка при получении интеграций:', error);
    res.status(500).json({ 
      error: 'Ошибка при получении интеграций',
      details: error.message 
    });
  }
}

// Подключить интеграцию
export async function connectIntegration(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;
    const { type, config } = req.body;

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    if (!type) {
      return res.status(400).json({ error: 'Тип интеграции обязателен' });
    }

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем, существует ли уже такая интеграция
    const existing = await prisma.integrations.findUnique({
      where: {
        userId_type: {
          userId: user.id,
          type: type,
        },
      },
    });

    let integration;
    if (existing) {
      // Обновляем существующую интеграцию
      integration = await prisma.integrations.update({
        where: { id: existing.id },
        data: {
          status: IntegrationStatus.connected,
          config: config || {},
          updatedAt: new Date(),
        },
      });
    } else {
      // Создаем новую интеграцию
      integration = await prisma.integrations.create({
        data: {
          userId: user.id,
          type: type,
          status: IntegrationStatus.connected,
          config: config || {},
          updatedAt: new Date(),
        },
      });
    }

    res.json({
      message: 'Интеграция успешно подключена',
      integration,
    });
  } catch (error: any) {
    console.error('Ошибка при подключении интеграции:', error);
    res.status(500).json({ 
      error: 'Ошибка при подключении интеграции',
      details: error.message 
    });
  }
}

// Отключить интеграцию
export async function disconnectIntegration(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;
    const { type } = req.body;

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    if (!type) {
      return res.status(400).json({ error: 'Тип интеграции обязателен' });
    }

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Находим интеграцию
    const integration = await prisma.integrations.findUnique({
      where: {
        userId_type: {
          userId: user.id,
          type: type,
        },
      },
    });

    if (!integration) {
      return res.status(404).json({ error: 'Интеграция не найдена' });
    }

    // Обновляем статус на disconnected
    await prisma.integrations.update({
      where: { id: integration.id },
      data: {
        status: IntegrationStatus.disconnected,
        updatedAt: new Date(),
      },
    });

    res.json({ message: 'Интеграция успешно отключена' });
  } catch (error: any) {
    console.error('Ошибка при отключении интеграции:', error);
    res.status(500).json({ 
      error: 'Ошибка при отключении интеграции',
      details: error.message 
    });
  }
}

// Получить статистику интеграции (количество подключенных клиентов)
export async function getIntegrationStats(req: Request, res: Response) {
  try {
    const userEmail = req.user?.email;
    const { type } = req.query;

    if (!userEmail) {
      return res.status(401).json({ error: 'Email пользователя не предоставлен' });
    }

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Здесь можно добавить логику подсчета клиентов по интеграции
    // Пока возвращаем базовую статистику
    const integration = await prisma.integrations.findUnique({
      where: {
        userId_type: {
          userId: user.id,
          type: type as string,
        },
      },
    });

    // Подсчитываем количество лидов, связанных с этой интеграцией
    // (если в будущем добавите поле integrationType в Lead)
    const connectedClients = 0; // Заглушка, можно реализовать позже

    res.json({
      type,
      connected: integration?.status === IntegrationStatus.connected || false,
      connectedClients,
    });
  } catch (error: any) {
    console.error('Ошибка при получении статистики интеграции:', error);
    res.status(500).json({ 
      error: 'Ошибка при получении статистики интеграции',
      details: error.message 
    });
  }
}

