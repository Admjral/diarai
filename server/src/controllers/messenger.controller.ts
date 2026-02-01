import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { log } from '../utils/logger';
import axios from 'axios';
import { MessengerType, ConversationStatus, MessageSenderType, MessageDeliveryStatus } from '@prisma/client';

const MESSENGER_SERVICE_URL = process.env.MESSENGER_SERVICE_URL || 'http://localhost:3002';
const MESSENGER_API_KEY = process.env.MESSENGER_API_KEY || '';

// =====================
// CONFIG ENDPOINTS
// =====================

/**
 * GET /api/messenger/config
 * Получить все конфигурации мессенджеров пользователя
 */
export async function getConfigs(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    const configs = await prisma.messengerConfig.findMany({
      where: { userId: userIdNum },
      select: {
        id: true,
        type: true,
        aiEnabled: true,
        aiSystemPrompt: true,
        escalationEnabled: true,
        escalationKeywords: true,
        isConnected: true,
        sessionId: true, // Нужно для проверки статуса WhatsApp на фронтенде
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ configs });
  } catch (error) {
    log.error('getConfigs error', error);
    res.status(500).json({ error: 'Failed to get configs' });
  }
}

/**
 * POST /api/messenger/config
 * Создать/обновить конфигурацию мессенджера
 */
export async function upsertConfig(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const { type, credentials, aiEnabled, aiSystemPrompt, escalationEnabled, escalationKeywords } = req.body;

    if (!type || !['whatsapp', 'telegram', 'instagram'].includes(type)) {
      return res.status(400).json({ error: 'Invalid messenger type' });
    }

    const config = await prisma.messengerConfig.upsert({
      where: {
        userId_type: {
          userId: userIdNum,
          type: type as MessengerType,
        },
      },
      create: {
        userId: userIdNum,
        type: type as MessengerType,
        credentials: credentials || {},
        aiEnabled: aiEnabled ?? true,
        aiSystemPrompt,
        escalationEnabled: escalationEnabled ?? true,
        escalationKeywords: escalationKeywords || [],
      },
      update: {
        credentials: credentials || undefined,
        aiEnabled,
        aiSystemPrompt,
        escalationEnabled,
        escalationKeywords,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      config: {
        id: config.id,
        type: config.type,
        aiEnabled: config.aiEnabled,
        isConnected: config.isConnected,
      },
    });
  } catch (error) {
    log.error('upsertConfig error', error);
    res.status(500).json({ error: 'Failed to save config' });
  }
}

/**
 * DELETE /api/messenger/config/:type
 * Удалить конфигурацию мессенджера
 */
export async function deleteConfig(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const { type } = req.params;

    await prisma.messengerConfig.delete({
      where: {
        userId_type: {
          userId: userIdNum,
          type: type as MessengerType,
        },
      },
    });

    res.json({ success: true });
  } catch (error) {
    log.error('deleteConfig error', error);
    res.status(500).json({ error: 'Failed to delete config' });
  }
}

// =====================
// WHATSAPP SESSION
// =====================

/**
 * POST /api/messenger/whatsapp/session
 * Создать WhatsApp сессию
 */
export async function createWhatsAppSession(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const sessionId = `user-${userIdNum}-wa`;

    // Создаем сессию в messenger-service
    const response = await axios.post(
      `${MESSENGER_SERVICE_URL}/session/whatsapp`,
      { sessionId },
      {
        headers: {
          'X-API-Key': MESSENGER_API_KEY,
          'X-User-Id': String(userIdNum),
        },
      }
    );

    // Сохраняем sessionId в конфиге
    await prisma.messengerConfig.upsert({
      where: {
        userId_type: {
          userId: userIdNum,
          type: 'whatsapp',
        },
      },
      create: {
        userId: userIdNum,
        type: 'whatsapp',
        sessionId,
        credentials: {},
      },
      update: {
        sessionId,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      sessionId,
      data: response.data.data,
    });
  } catch (error) {
    log.error('createWhatsAppSession error', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
}

/**
 * GET /api/messenger/whatsapp/qr
 * Получить QR код для WhatsApp
 */
export async function getWhatsAppQR(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    // Получаем sessionId из конфига
    const config = await prisma.messengerConfig.findUnique({
      where: {
        userId_type: {
          userId: userIdNum,
          type: 'whatsapp',
        },
      },
    });

    if (!config?.sessionId) {
      return res.status(404).json({ error: 'Session not found. Create session first.' });
    }

    // Получаем QR из messenger-service
    const response = await axios.get(
      `${MESSENGER_SERVICE_URL}/session/whatsapp/${config.sessionId}/qr`,
      {
        headers: {
          'X-API-Key': MESSENGER_API_KEY,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    log.error('getWhatsAppQR error', error);
    res.status(500).json({ error: 'Failed to get QR code' });
  }
}

/**
 * GET /api/messenger/whatsapp/status
 * Получить статус WhatsApp сессии
 */
export async function getWhatsAppStatus(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    const config = await prisma.messengerConfig.findUnique({
      where: {
        userId_type: {
          userId: userIdNum,
          type: 'whatsapp',
        },
      },
    });

    if (!config?.sessionId) {
      return res.json({ success: true, data: { status: 'NO_SESSION' } });
    }

    // Получаем статус из messenger-service
    const response = await axios.get(
      `${MESSENGER_SERVICE_URL}/session/whatsapp/${config.sessionId}/status`,
      {
        headers: { 'X-API-Key': MESSENGER_API_KEY },
        timeout: 5000,
      }
    );

    const sessionData = response.data?.data;
    const wahaStatus = sessionData?.status || 'UNKNOWN';

    // Обновляем isConnected в базе если статус изменился
    const isConnected = wahaStatus === 'WORKING' || wahaStatus === 'CONNECTED';
    if (config.isConnected !== isConnected) {
      await prisma.messengerConfig.update({
        where: { id: config.id },
        data: { isConnected, lastSyncAt: new Date() },
      });
    }

    res.json({
      success: true,
      data: {
        status: wahaStatus,
        isConnected,
        sessionId: config.sessionId,
      },
    });
  } catch (error) {
    log.error('getWhatsAppStatus error', error);
    res.status(500).json({ error: 'Failed to get session status' });
  }
}

// =====================
// TELEGRAM
// =====================

/**
 * POST /api/messenger/telegram/connect
 * Подключить Telegram бота
 */
export async function connectTelegram(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const { botToken } = req.body;

    if (!botToken) {
      return res.status(400).json({ error: 'Bot token is required' });
    }

    // Валидация формата токена Telegram (10:35 формат)
    if (!/^\d{8,12}:[A-Za-z0-9_-]{35}$/.test(botToken)) {
      return res.status(400).json({
        error: 'Invalid token format. Expected format: 123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      });
    }

    // Проверяем токен, делая запрос к Telegram API
    try {
      const telegramResponse = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
      if (!telegramResponse.data.ok) {
        return res.status(400).json({ error: 'Invalid Telegram bot token' });
      }

      const botInfo = telegramResponse.data.result;
      log.info('Telegram bot verified', { botUsername: botInfo.username });
    } catch (telegramError) {
      log.error('Telegram token validation failed', telegramError);
      return res.status(400).json({ error: 'Invalid Telegram bot token. Please check and try again.' });
    }

    // Регистрируем бота в messenger-service (для webhook)
    try {
      await axios.post(
        `${MESSENGER_SERVICE_URL}/telegram/register`,
        {
          userId: userIdNum,
          botToken,
        },
        {
          headers: {
            'X-API-Key': MESSENGER_API_KEY,
            'X-User-Id': String(userIdNum),
          },
        }
      );
    } catch (registerError) {
      log.error('Failed to register Telegram bot in messenger-service', registerError);
      // Продолжаем - messenger-service может быть недоступен локально
    }

    // Сохраняем конфигурацию
    const config = await prisma.messengerConfig.upsert({
      where: {
        userId_type: {
          userId: userIdNum,
          type: 'telegram',
        },
      },
      create: {
        userId: userIdNum,
        type: 'telegram',
        credentials: { botToken }, // В продакшене нужно шифровать
        isConnected: true,
        lastSyncAt: new Date(),
      },
      update: {
        credentials: { botToken },
        isConnected: true,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      config: {
        id: config.id,
        type: config.type,
        isConnected: config.isConnected,
        lastSyncAt: config.lastSyncAt,
      },
    });
  } catch (error) {
    log.error('connectTelegram error', error);
    res.status(500).json({ error: 'Failed to connect Telegram bot' });
  }
}

// =====================
// INBOX ENDPOINTS
// =====================

/**
 * GET /api/messenger/inbox
 * Получить список разговоров
 */
export async function getInbox(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    const { status, messengerType, limit = '50', offset = '0' } = req.query;

    const where: any = { userId: userIdNum };
    if (status) where.status = status as ConversationStatus;
    if (messengerType) where.messengerType = messengerType as MessengerType;

    const [conversations, total, unreadTotal] = await Promise.all([
      prisma.messengerConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        take: parseInt(limit as string, 10),
        skip: parseInt(offset as string, 10),
        select: {
          id: true,
          messengerId: true,
          messengerType: true,
          contactName: true,
          contactAvatar: true,
          lastMessage: true,
          lastMessageAt: true,
          unreadCount: true,
          status: true,
          assignedToId: true,
          createdAt: true,
        },
      }),
      prisma.messengerConversation.count({ where }),
      prisma.messengerConversation.aggregate({
        where: { userId: userIdNum },
        _sum: { unreadCount: true },
      }),
    ]);

    res.json({
      conversations,
      total,
      unreadTotal: unreadTotal._sum.unreadCount || 0,
    });
  } catch (error) {
    log.error('getInbox error', error);
    res.status(500).json({ error: 'Failed to get inbox' });
  }
}

/**
 * GET /api/messenger/inbox/:id
 * Получить разговор с сообщениями
 */
export async function getConversation(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const { id } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const conversation = await prisma.messengerConversation.findFirst({
      where: {
        id,
        userId: userIdNum,
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await prisma.messengerMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
    });

    // Помечаем сообщения как прочитанные и сбрасываем счетчик
    await prisma.$transaction([
      prisma.messengerMessage.updateMany({
        where: {
          conversationId: id,
          sender: 'customer',
          status: { not: 'read' },
        },
        data: {
          status: 'read',
          readAt: new Date(),
        },
      }),
      prisma.messengerConversation.update({
        where: { id },
        data: { unreadCount: 0 },
      }),
    ]);

    res.json({
      conversation,
      messages: messages.reverse(), // Хронологический порядок
    });
  } catch (error) {
    log.error('getConversation error', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
}

/**
 * POST /api/messenger/inbox/:id/send
 * Отправить сообщение в разговор
 */
export async function sendMessage(req: Request, res: Response) {
  log.info('sendMessage called', {
    conversationId: req.params.id,
    body: req.body,
  });

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const { id } = req.params;
    const { text, mediaUrls } = req.body;

    if (!text && !mediaUrls?.length) {
      return res.status(400).json({ error: 'Message text or media required' });
    }

    // Получаем разговор
    const conversation = await prisma.messengerConversation.findFirst({
      where: {
        id,
        userId: userIdNum,
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Получаем конфигурацию мессенджера
    const config = await prisma.messengerConfig.findUnique({
      where: {
        userId_type: {
          userId: userIdNum,
          type: conversation.messengerType,
        },
      },
    });

    // Отправляем через messenger-service
    const requestBody = {
      userId: userIdNum,
      messengerType: conversation.messengerType,
      messengerId: conversation.messengerId,
      text,
      mediaUrls,
      sessionId: config?.sessionId,
    };

    log.info('Sending message via messenger-service', {
      url: `${MESSENGER_SERVICE_URL}/send`,
      requestBody: JSON.stringify(requestBody),
      apiKeyPresent: !!MESSENGER_API_KEY,
      apiKeyLength: MESSENGER_API_KEY?.length || 0,
    });

    try {
      const sendResponse = await axios.post(
        `${MESSENGER_SERVICE_URL}/send`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': MESSENGER_API_KEY,
            'X-User-Id': String(userIdNum),
          },
          timeout: 15000,
        }
      );
      log.info('Message sent via messenger-service', {
        success: sendResponse.data?.success,
        messageId: sendResponse.data?.data?.messageId
      });
    } catch (sendError: any) {
      log.error('Failed to send via messenger service', {
        error: {
          message: sendError?.message,
          code: sendError?.code,
          status: sendError?.response?.status,
          responseData: sendError?.response?.data,
        }
      });
      // Продолжаем сохранять в БД даже если отправка не удалась
    }

    // Сохраняем сообщение в БД
    const message = await prisma.messengerMessage.create({
      data: {
        conversationId: id,
        text: text || '',
        mediaUrls: mediaUrls || [],
        sender: 'operator',
        status: 'sent',
      },
    });

    // Обновляем lastMessage в разговоре
    await prisma.messengerConversation.update({
      where: { id },
      data: {
        lastMessage: text || '[Медиа]',
        lastMessageAt: new Date(),
      },
    });

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    log.error('sendMessage error', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
}

/**
 * PUT /api/messenger/inbox/:id/close
 * Закрыть разговор
 */
export async function closeConversation(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const { id } = req.params;

    const conversation = await prisma.messengerConversation.updateMany({
      where: {
        id,
        userId: userIdNum,
      },
      data: {
        status: 'closed',
      },
    });

    if (conversation.count === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true });
  } catch (error) {
    log.error('closeConversation error', error);
    res.status(500).json({ error: 'Failed to close conversation' });
  }
}

/**
 * PUT /api/messenger/inbox/:id/archive
 * Архивировать разговор
 */
export async function archiveConversation(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const { id } = req.params;

    const conversation = await prisma.messengerConversation.updateMany({
      where: {
        id,
        userId: userIdNum,
      },
      data: {
        status: 'archived',
      },
    });

    if (conversation.count === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true });
  } catch (error) {
    log.error('archiveConversation error', error);
    res.status(500).json({ error: 'Failed to archive conversation' });
  }
}

// =====================
// WEBHOOK (from messenger-service)
// =====================

/**
 * POST /api/messenger/webhook
 * Webhook от messenger-service для входящих сообщений
 */
export async function handleWebhook(req: Request, res: Response) {
  try {
    const { event, userId, messengerType, message, timestamp } = req.body;

    log.info('Messenger webhook received', { event, userId, messengerType });

    // Быстро отвечаем 200
    res.status(200).json({ success: true });

    // Обрабатываем асинхронно
    if (event === 'message.received' && message) {
      await processIncomingMessage(userId, messengerType, message);
    } else if (event === 'message.ai_responded' && message) {
      await processAIResponse(userId, messengerType, message);
    } else if (event === 'message.escalated' && message) {
      await processEscalation(userId, messengerType, message);
    }
  } catch (error) {
    log.error('Webhook processing error', error);
    // Не возвращаем ошибку - уже отправили 200
  }
}

/**
 * Обработать входящее сообщение
 */
async function processIncomingMessage(
  userId: number,
  messengerType: MessengerType,
  message: any
) {
  // Найти или создать разговор
  let conversation = await prisma.messengerConversation.findUnique({
    where: {
      userId_messengerId_messengerType: {
        userId,
        messengerId: message.messengerId,
        messengerType,
      },
    },
  });

  if (!conversation) {
    // Создаем новый разговор
    conversation = await prisma.messengerConversation.create({
      data: {
        userId,
        messengerId: message.messengerId,
        messengerType,
        contactName: message.senderName || message.messengerId,
        contactPhone: messengerType === 'whatsapp' ? message.messengerId : null,
      },
    });

    // Автоматически создаем лид из нового чата
    const contactPhone = messengerType === 'whatsapp' ? message.messengerId : '';
    const contactName = message.senderName || message.messengerId;

    // Проверяем, нет ли уже лида с таким телефоном
    const existingLead = await prisma.lead.findFirst({
      where: {
        userId,
        OR: [
          { phone: contactPhone },
          { name: contactName }
        ].filter(condition => Object.values(condition).some(v => v && v !== ''))
      }
    });

    if (!existingLead) {
      const lead = await prisma.lead.create({
        data: {
          userId,
          name: contactName,
          phone: contactPhone,
          email: '',
          source: `Мессенджер (${messengerType})`,
          status: 'new',
          notes: `Автоматически создан из ${messengerType} чата`,
        },
      });

      // Связываем conversation с lead
      await prisma.messengerConversation.update({
        where: { id: conversation.id },
        data: { leadId: lead.id },
      });

      log.info('Lead auto-created from messenger', {
        leadId: lead.id,
        conversationId: conversation.id,
        messengerType,
      });
    }
  }

  // Создаем сообщение
  await prisma.messengerMessage.create({
    data: {
      conversationId: conversation.id,
      text: message.text || '',
      mediaUrls: message.mediaUrls || [],
      sender: 'customer',
      senderName: message.senderName,
      status: 'received',
      externalId: message.id,
    },
  });

  // Обновляем разговор
  await prisma.messengerConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessage: message.text || '[Медиа]',
      lastMessageAt: new Date(),
      unreadCount: { increment: 1 },
    },
  });

  // Создаем уведомление
  await prisma.notification.create({
    data: {
      userId,
      type: 'messenger_new_message',
      title: `Новое сообщение (${messengerType})`,
      message: `${message.senderName || 'Клиент'}: ${(message.text || '').substring(0, 100)}`,
      data: {
        conversationId: conversation.id,
        messengerType,
      },
    },
  });

  log.info('Incoming message processed', {
    conversationId: conversation.id,
    messengerType,
  });
}

/**
 * Обработать AI ответ
 */
async function processAIResponse(
  userId: number,
  messengerType: MessengerType,
  message: any
) {
  const conversation = await prisma.messengerConversation.findUnique({
    where: {
      userId_messengerId_messengerType: {
        userId,
        messengerId: message.messengerId,
        messengerType,
      },
    },
  });

  if (!conversation) return;

  // Создаем AI сообщение
  await prisma.messengerMessage.create({
    data: {
      conversationId: conversation.id,
      text: message.text,
      sender: 'ai',
      isAIGenerated: true,
      aiConfidence: message.aiConfidence,
      status: 'sent',
    },
  });

  // Обновляем счетчик AI ответов
  await prisma.messengerConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessage: message.text,
      lastMessageAt: new Date(),
      aiResponseCount: { increment: 1 },
    },
  });

  log.info('AI response saved', {
    conversationId: conversation.id,
    confidence: message.aiConfidence,
  });
}

/**
 * Обработать эскалацию
 */
async function processEscalation(
  userId: number,
  messengerType: MessengerType,
  message: any
) {
  const conversation = await prisma.messengerConversation.findUnique({
    where: {
      userId_messengerId_messengerType: {
        userId,
        messengerId: message.messengerId,
        messengerType,
      },
    },
  });

  if (!conversation) return;

  // Обновляем сообщение как эскалированное
  await prisma.messengerMessage.updateMany({
    where: {
      conversationId: conversation.id,
      externalId: message.id,
    },
    data: {
      isEscalated: true,
      escalatedAt: new Date(),
    },
  });

  // Обновляем счетчик эскалаций
  await prisma.messengerConversation.update({
    where: { id: conversation.id },
    data: {
      escalatedCount: { increment: 1 },
    },
  });

  // Создаем уведомление об эскалации
  await prisma.notification.create({
    data: {
      userId,
      type: 'messenger_escalation',
      title: 'Требуется внимание оператора',
      message: `Сообщение от ${message.senderName || 'клиента'} требует ручной обработки`,
      data: {
        conversationId: conversation.id,
        messengerType,
        messageText: message.text,
      },
    },
  });

  log.info('Escalation processed', {
    conversationId: conversation.id,
    messengerType,
  });
}

// =====================
// SESSION LOOKUP (for messenger-service)
// =====================

/**
 * GET /api/messenger/session/whatsapp/:sessionId
 * Получить данные пользователя по WhatsApp sessionId
 * Используется messenger-service для определения userId по webhook
 */
export async function getSessionByWhatsAppId(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;

    // Проверяем API ключ (запрос от messenger-service)
    const apiKey = req.headers['x-api-key'] as string;
    const expectedKey = process.env.MESSENGER_API_KEY || '';

    if (!apiKey || apiKey !== expectedKey) {
      log.warn('Invalid API key for session lookup', {
        sessionId,
        receivedKeyLength: apiKey?.length || 0,
        expectedKeyLength: expectedKey?.length || 0,
        receivedKeyPrefix: apiKey?.substring(0, 8) || 'none',
        expectedKeyPrefix: expectedKey?.substring(0, 8) || 'none',
      });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // WAHA Core использует 'default' как имя сессии,
    // ищем по sessionId или, если 'default', берём первую WhatsApp конфигурацию
    const whereClause = sessionId === 'default'
      ? { type: 'whatsapp' as const }
      : { type: 'whatsapp' as const, sessionId };

    const config = await prisma.messengerConfig.findFirst({
      where: whereClause,
      select: {
        userId: true,
        aiEnabled: true,
        aiSystemPrompt: true,
        escalationEnabled: true,
        escalationKeywords: true,
        isConnected: true,
      },
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: {
        userId: config.userId,
        aiEnabled: config.aiEnabled,
        aiSystemPrompt: config.aiSystemPrompt,
        escalationKeywords: config.escalationEnabled ? config.escalationKeywords : [],
      },
    });
  } catch (error) {
    log.error('getSessionByWhatsAppId error', error);
    res.status(500).json({ error: 'Failed to get session data' });
  }
}

/**
 * GET /api/messenger/session/instagram/:accountId
 * Получить данные пользователя по Instagram account ID
 */
export async function getSessionByInstagramAccount(req: Request, res: Response) {
  try {
    const { accountId } = req.params;

    // Проверяем API ключ
    const apiKey = req.headers['x-api-key'] as string;
    const expectedKey = process.env.MESSENGER_API_KEY || '';

    if (!apiKey || apiKey !== expectedKey) {
      log.warn('Invalid API key for Instagram session lookup', { accountId });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Instagram account ID хранится в credentials
    const config = await prisma.messengerConfig.findFirst({
      where: {
        type: 'instagram',
        credentials: {
          path: ['instagramAccountId'],
          equals: accountId,
        },
      },
      select: {
        userId: true,
        aiEnabled: true,
        aiSystemPrompt: true,
        escalationEnabled: true,
        escalationKeywords: true,
        isConnected: true,
      },
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Instagram account not found'
      });
    }

    res.json({
      success: true,
      data: {
        userId: config.userId,
        aiEnabled: config.aiEnabled,
        aiSystemPrompt: config.aiSystemPrompt,
        escalationKeywords: config.escalationEnabled ? config.escalationKeywords : [],
      },
    });
  } catch (error) {
    log.error('getSessionByInstagramAccount error', error);
    res.status(500).json({ error: 'Failed to get session data' });
  }
}

/**
 * GET /api/messenger/session/telegram/:botId
 * Получить данные пользователя по Telegram bot ID
 */
export async function getSessionByTelegramBot(req: Request, res: Response) {
  try {
    const { botId } = req.params;

    // Проверяем API ключ
    const apiKey = req.headers['x-api-key'] as string;
    const expectedKey = process.env.MESSENGER_API_KEY || '';

    if (!apiKey || apiKey !== expectedKey) {
      log.warn('Invalid API key for Telegram session lookup', { botId });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Bot ID - это первая часть токена (до :)
    // Ищем конфигурации Telegram и проверяем bot ID
    const configs = await prisma.messengerConfig.findMany({
      where: {
        type: 'telegram',
        isConnected: true,
      },
      select: {
        userId: true,
        credentials: true,
        aiEnabled: true,
        aiSystemPrompt: true,
        escalationEnabled: true,
        escalationKeywords: true,
      },
    });

    // Находим конфигурацию с соответствующим bot ID
    const config = configs.find((c) => {
      const creds = c.credentials as { botToken?: string } | null;
      if (!creds?.botToken) return false;
      const tokenBotId = creds.botToken.split(':')[0];
      return tokenBotId === botId;
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Telegram bot not found'
      });
    }

    res.json({
      success: true,
      data: {
        userId: config.userId,
        aiEnabled: config.aiEnabled,
        aiSystemPrompt: config.aiSystemPrompt,
        escalationKeywords: config.escalationEnabled ? config.escalationKeywords : [],
      },
    });
  } catch (error) {
    log.error('getSessionByTelegramBot error', error);
    res.status(500).json({ error: 'Failed to get session data' });
  }
}

// =====================
// LEAD INTEGRATION ENDPOINTS
// =====================

/**
 * POST /api/messenger/inbox/:id/create-lead
 * Создать лид из разговора
 */
export async function createLeadFromConversation(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const { id } = req.params;

    // Найти разговор
    const conversation = await prisma.messengerConversation.findFirst({
      where: { id, userId: userIdNum },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    if (conversation.leadId) {
      return res.status(400).json({ error: 'Лид уже существует для этого чата' });
    }

    // Создать лид
    const lead = await prisma.lead.create({
      data: {
        userId: userIdNum,
        name: conversation.contactName,
        phone: conversation.contactPhone || '',
        email: '',
        source: `Мессенджер (${conversation.messengerType})`,
        status: 'new',
        notes: `Создан из ${conversation.messengerType} чата`,
      },
    });

    // Связать с разговором
    await prisma.messengerConversation.update({
      where: { id },
      data: { leadId: lead.id },
    });

    log.info('Lead created from conversation', {
      leadId: lead.id,
      conversationId: id,
      userId: userIdNum,
    });

    res.json({ success: true, lead });
  } catch (error) {
    log.error('createLeadFromConversation error', error);
    res.status(500).json({ error: 'Не удалось создать лид' });
  }
}

/**
 * GET /api/messenger/inbox/:id/lead
 * Получить лид, связанный с разговором
 */
export async function getConversationLead(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const { id } = req.params;

    const conversation = await prisma.messengerConversation.findFirst({
      where: { id, userId: userIdNum },
      include: {
        lead: true,
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    res.json({ lead: conversation.lead || null });
  } catch (error) {
    log.error('getConversationLead error', error);
    res.status(500).json({ error: 'Не удалось получить лид' });
  }
}
