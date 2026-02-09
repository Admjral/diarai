import { prisma, ensureConnection } from '../db/prisma';

/**
 * Получает userId (Int) из базы данных по телефону пользователя
 * Если пользователь не найден, создает нового с планом Start
 */
export async function getUserIdByPhone(userPhone: string): Promise<number> {
  if (!userPhone || typeof userPhone !== 'string' || userPhone.trim() === '') {
    throw new Error('Телефон пользователя не предоставлен или невалиден');
  }

  const trimmedPhone = userPhone.trim();

  try {
    // Убеждаемся, что подключение к БД установлено
    await ensureConnection();

    console.log('[getUserIdByPhone] Поиск пользователя с phone:', trimmedPhone);

    // Ищем пользователя по phone
    let user = await prisma.user.findUnique({
      where: { phone: trimmedPhone },
      select: { id: true },
    });

    console.log('[getUserIdByPhone] Результат поиска:', user ? `найден (id: ${user.id})` : 'не найден');

    // Если пользователь не найден, создаем нового
    if (!user) {
      try {
        console.log('[getUserIdByPhone] Создание нового пользователя...');
        user = await prisma.user.create({
          data: {
            phone: trimmedPhone,
            name: trimmedPhone,
            password: '', // В реальном приложении пароль хранится в Supabase
            plan: 'Start',
          },
          select: { id: true },
        });
        console.log('[getUserIdByPhone] Пользователь создан с id:', user.id);
      } catch (createError: any) {
        console.error('[getUserIdByPhone] Ошибка при создании пользователя:', createError);
        console.error('[getUserIdByPhone] Код ошибки:', createError.code);
        console.error('[getUserIdByPhone] Сообщение:', createError.message);

        // Если ошибка уникальности (пользователь был создан параллельно), пытаемся найти снова
        if (createError.code === 'P2002') {
          console.log('[getUserIdByPhone] Пользователь уже существует, повторный поиск...');
          user = await prisma.user.findUnique({
            where: { phone: trimmedPhone },
            select: { id: true },
          });
          if (!user) {
            throw new Error('Не удалось создать или найти пользователя после ошибки уникальности');
          }
          console.log('[getUserIdByPhone] Пользователь найден после повторного поиска, id:', user.id);
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
    console.error('[getUserIdByPhone] Критическая ошибка:', error);
    console.error('[getUserIdByPhone] Тип ошибки:', error.constructor.name);
    console.error('[getUserIdByPhone] Phone:', trimmedPhone);
    if (error.stack) {
      console.error('[getUserIdByPhone] Stack trace:', error.stack);
    }
    throw error;
  }
}

/**
 * @deprecated Используйте getUserIdByPhone вместо этой функции.
 * Оставлено для обратной совместимости.
 */
export const getUserIdByEmail = getUserIdByPhone;
