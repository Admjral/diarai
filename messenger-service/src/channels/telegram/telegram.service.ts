import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { log } from '../../utils/logger.js';
import { UnifiedMessage } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import { getMessageService } from '../../services/message.service.js';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: {
    id: number;
    type: string;
    title?: string;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  date: number;
  text?: string;
  photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number }>;
  document?: { file_id: string; file_name?: string };
}

type MessageHandler = (message: UnifiedMessage) => Promise<void>;

export class TelegramService {
  private bot: Telegraf | null = null;
  private messageHandlers: Map<number, MessageHandler> = new Map();
  private chatUserMap: Map<number, number> = new Map(); // chatId -> userId
  private defaultUserId: number = 1; // default userId for all chats
  private isRunning = false;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      this.bot = new Telegraf(token);
      this.setupHandlers();
      log.info('Telegram service initialized');
    } else {
      log.warn('Telegram bot token not configured');
    }
  }

  /**
   * Настроить обработчики сообщений
   */
  private setupHandlers(): void {
    if (!this.bot) return;

    // Обработка текстовых сообщений
    this.bot.on(message('text'), async (ctx) => {
      await this.handleIncomingMessage(ctx);
    });

    // Обработка фото
    this.bot.on(message('photo'), async (ctx) => {
      await this.handleIncomingMessage(ctx);
    });

    // Обработка документов
    this.bot.on(message('document'), async (ctx) => {
      await this.handleIncomingMessage(ctx);
    });

    // Команда /start
    this.bot.command('start', async (ctx) => {
      await ctx.reply('Привет! Я бот для связи с поддержкой. Просто напишите ваш вопрос.');
    });

    // Ошибки
    this.bot.catch((err, ctx) => {
      log.error('Telegram bot error', err as Error, { chatId: ctx.chat?.id });
    });
  }

  /**
   * Обработать входящее сообщение
   */
  private async handleIncomingMessage(ctx: Context): Promise<void> {
    const msg = ctx.message as TelegramMessage;
    if (!msg) return;

    const chatId = msg.chat.id;
    const text = msg.text || '';

    log.info('Telegram message received', {
      chatId,
      from: msg.from?.username || msg.from?.first_name,
      text: text.substring(0, 100)
    });

    // Если есть зарегистрированные обработчики - используем их (для multi-tenant)
    if (this.messageHandlers.size > 0) {
      for (const [userId, handler] of this.messageHandlers) {
        try {
          const unifiedMessage = this.parseMessage(msg, userId);
          await handler(unifiedMessage);
        } catch (error) {
          log.error('Error handling Telegram message', error, { chatId });
        }
      }
      return;
    }

    // Пробуем найти userId по chatId в кэше или используем defaultUserId
    const userId = this.chatUserMap.get(chatId) || this.defaultUserId;

    try {
      const unifiedMessage = this.parseMessage(msg, userId);
      const messageService = getMessageService();

      // Отправляем сообщение в backend для сохранения
      await messageService.processIncomingMessage({
        message: unifiedMessage,
        aiEnabled: true, // По умолчанию включен AI
      });

      log.info('Telegram message sent to backend', {
        chatId,
        userId,
        messageId: unifiedMessage.id,
      });
    } catch (error) {
      log.error('Error processing Telegram message', error, { chatId });
      // Не отправляем ошибку пользователю - сообщение все равно получено
    }
  }

  /**
   * Зарегистрировать обработчик сообщений для пользователя
   */
  registerHandler(userId: number, handler: MessageHandler): void {
    this.messageHandlers.set(userId, handler);
    log.debug('Registered Telegram handler', { userId });
  }

  /**
   * Удалить обработчик
   */
  unregisterHandler(userId: number): void {
    this.messageHandlers.delete(userId);
    log.debug('Unregistered Telegram handler', { userId });
  }

  /**
   * Зарегистрировать маппинг chatId -> userId
   * Используется для multi-tenant архитектуры
   */
  registerChatUser(chatId: number, userId: number): void {
    this.chatUserMap.set(chatId, userId);
    log.debug('Registered chat-user mapping', { chatId, userId });
  }

  /**
   * Удалить маппинг chatId -> userId
   */
  unregisterChatUser(chatId: number): void {
    this.chatUserMap.delete(chatId);
    log.debug('Unregistered chat-user mapping', { chatId });
  }

  /**
   * Установить userId по умолчанию для всех чатов
   * (используется когда один бот обслуживает одного пользователя)
   */
  setDefaultUser(userId: number): void {
    this.defaultUserId = userId;
    log.info('Set default user for Telegram', { userId });
  }

  /**
   * Запустить бота (long polling)
   */
  async start(): Promise<void> {
    if (!this.bot || this.isRunning) return;

    try {
      // Запускаем бота без await - launch() блокирует до SIGTERM
      this.bot.launch().catch((error) => {
        log.error('Telegram bot error during polling', error);
      });
      this.isRunning = true;
      log.info('Telegram bot started (long polling)');

      // Graceful shutdown
      process.once('SIGINT', () => this.stop());
      process.once('SIGTERM', () => this.stop());
    } catch (error) {
      log.error('Failed to start Telegram bot', error);
      throw error;
    }
  }

  /**
   * Запустить в режиме webhook
   */
  async startWebhook(url: string, port: number = 3003): Promise<void> {
    if (!this.bot || this.isRunning) return;

    try {
      await this.bot.launch({
        webhook: {
          domain: url,
          port,
        },
      });
      this.isRunning = true;
      log.info('Telegram bot started (webhook)', { url, port });
    } catch (error) {
      log.error('Failed to start Telegram webhook', error);
      throw error;
    }
  }

  /**
   * Остановить бота
   */
  stop(): void {
    if (!this.bot || !this.isRunning) return;

    this.bot.stop('SIGTERM');
    this.isRunning = false;
    log.info('Telegram bot stopped');
  }

  /**
   * Отправить текстовое сообщение
   */
  async sendMessage(chatId: number | string, text: string): Promise<{ id: string }> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    try {
      const result = await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'HTML',
      });

      log.info('Telegram message sent', {
        chatId,
        messageId: result.message_id,
      });

      return { id: result.message_id.toString() };
    } catch (error) {
      log.error('Failed to send Telegram message', error, { chatId });
      throw error;
    }
  }

  /**
   * Отправить фото
   */
  async sendPhoto(
    chatId: number | string,
    photoUrl: string,
    caption?: string
  ): Promise<{ id: string }> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    try {
      const result = await this.bot.telegram.sendPhoto(chatId, photoUrl, {
        caption,
        parse_mode: 'HTML',
      });

      log.info('Telegram photo sent', {
        chatId,
        messageId: result.message_id,
      });

      return { id: result.message_id.toString() };
    } catch (error) {
      log.error('Failed to send Telegram photo', error, { chatId });
      throw error;
    }
  }

  /**
   * Преобразовать Telegram сообщение в унифицированный формат
   */
  parseMessage(msg: TelegramMessage, userId: number): UnifiedMessage {
    const sender = msg.from;
    const senderName = sender
      ? [sender.first_name, sender.last_name].filter(Boolean).join(' ')
      : 'Unknown';

    // Получаем медиа URLs
    const mediaUrls: string[] = [];
    // Для фото/документов нужно получить URL через getFile API
    // Это делается асинхронно, пока оставляем пустым

    return {
      id: uuidv4(),
      messengerType: 'telegram',
      messengerId: msg.chat.id.toString(),
      userId,
      text: msg.text || '',
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      senderName,
      direction: 'inbound',
      status: 'received',
      timestamp: new Date(msg.date * 1000),
      rawData: msg as unknown as Record<string, unknown>,
    };
  }

  /**
   * Получить информацию о боте
   */
  async getBotInfo(): Promise<{ id: number; username: string; name: string } | null> {
    if (!this.bot) return null;

    try {
      const me = await this.bot.telegram.getMe();
      return {
        id: me.id,
        username: me.username || '',
        name: me.first_name,
      };
    } catch (error) {
      log.error('Failed to get bot info', error);
      return null;
    }
  }

  /**
   * Проверить здоровье
   */
  async healthCheck(): Promise<boolean> {
    if (!this.bot) return false;

    try {
      await this.bot.telegram.getMe();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Singleton
let telegramService: TelegramService | null = null;

export function getTelegramService(): TelegramService {
  if (!telegramService) {
    telegramService = new TelegramService();
  }
  return telegramService;
}
