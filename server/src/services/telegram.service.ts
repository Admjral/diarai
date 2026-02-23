/**
 * Telegram Bot Notification Service
 * Отправляет уведомления администратору через Telegram бота
 *
 * Переменные окружения:
 * - TELEGRAM_BOT_TOKEN: токен бота от @BotFather
 * - TELEGRAM_ADMIN_CHAT_ID: chat ID администратора или группы
 */

const TELEGRAM_API = 'https://api.telegram.org/bot';

function getConfig() {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '',
  };
}

function isConfigured(): boolean {
  const { botToken, adminChatId } = getConfig();
  return !!(botToken && adminChatId);
}

async function sendMessage(chatId: string, text: string): Promise<boolean> {
  const { botToken } = getConfig();
  if (!botToken) return false;

  try {
    const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('[Telegram] Ошибка отправки:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Telegram] Ошибка:', err);
    return false;
  }
}

export async function notifyAdminNewUser(phone: string, name: string): Promise<void> {
  if (!isConfigured()) {
    console.log('[Telegram] Не настроен, пропуск уведомления о регистрации');
    return;
  }

  const { adminChatId } = getConfig();
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });

  const text =
    `🆕 <b>Новая регистрация</b>\n\n` +
    `📱 Телефон: <code>+${phone}</code>\n` +
    `👤 Имя: ${name}\n` +
    `🕐 Время: ${now}`;

  await sendMessage(adminChatId, text);
}

export async function notifyAdmin(text: string): Promise<void> {
  if (!isConfigured()) return;
  const { adminChatId } = getConfig();
  await sendMessage(adminChatId, text);
}
