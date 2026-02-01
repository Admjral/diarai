import { prisma, ensureConnection } from '../db/prisma';

/**
 * Получает userId (Int) из базы данных по email пользователя
 * Если пользователь не найден, создает нового с планом Start
 */
export async function getUserIdByEmail(userEmail: string): Promise<number> {
  if (!userEmail || typeof userEmail !== 'string' || userEmail.trim() === '') {
    throw new Error('Email пользователя не предоставлен или невалиден');
  }

  const trimmedEmail = userEmail.trim().toLowerCase();

  try {
    // Убеждаемся, что подключение к БД установлено
    await ensureConnection();
    
    console.log('[getUserIdByEmail] Поиск пользователя с email:', trimmedEmail);
    
    // Ищем пользователя по email
    let user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
      select: { id: true },
    });

    console.log('[getUserIdByEmail] Результат поиска:', user ? `найден (id: ${user.id})` : 'не найден');

    // Если пользователь не найден, создаем нового
    if (!user) {
      try {
        console.log('[getUserIdByEmail] Создание нового пользователя...');
        user = await prisma.user.create({
          data: {
            email: trimmedEmail,
            name: trimmedEmail.split('@')[0] || 'Пользователь',
            password: '', // В реальном приложении пароль хранится в Supabase
            plan: 'Start',
          },
          select: { id: true },
        });
        console.log('[getUserIdByEmail] ✅ Пользователь создан с id:', user.id);
      } catch (createError: any) {
        console.error('[getUserIdByEmail] ❌ Ошибка при создании пользователя:', createError);
        console.error('[getUserIdByEmail] Код ошибки:', createError.code);
        console.error('[getUserIdByEmail] Сообщение:', createError.message);
        
        // Если ошибка уникальности (пользователь был создан параллельно), пытаемся найти снова
        if (createError.code === 'P2002') {
          console.log('[getUserIdByEmail] Пользователь уже существует, повторный поиск...');
          user = await prisma.user.findUnique({
            where: { email: trimmedEmail },
            select: { id: true },
          });
          if (!user) {
            throw new Error('Не удалось создать или найти пользователя после ошибки уникальности');
          }
          console.log('[getUserIdByEmail] ✅ Пользователь найден после повторного поиска, id:', user.id);
        } else {
          throw createError;
        }
      }
    }

    if (!user || !user.id) {
      throw new Error('Пользователь не найден и не может быть создан');
    }

    return user.id;
  } catch (error: any) {
    console.error('[getUserIdByEmail] ❌ Критическая ошибка:', error);
    console.error('[getUserIdByEmail] Тип ошибки:', error.constructor.name);
    console.error('[getUserIdByEmail] Email:', trimmedEmail);
    if (error.stack) {
      console.error('[getUserIdByEmail] Stack trace:', error.stack);
    }
    throw error;
  }
}

