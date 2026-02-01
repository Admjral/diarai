import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Функция для получения JWT_SECRET (вызывается после загрузки .env)
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

// Генерация JWT токена
const generateToken = (user: { id: number; email: string; role: string }): string => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    } as JwtPayload,
    getJwtSecret(),
    { expiresIn: '7d' }
  );
};

// Регистрация
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Валидация
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    // Валидация email формата
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Неверный формат email' });
    }

    // Усиленная валидация пароля
    if (password.length < 8) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 8 символов' });
    }

    // Проверка на наличие хотя бы одной цифры и буквы
    const hasLetter = /[a-zA-Zа-яА-Я]/.test(password);
    const hasNumber = /\d/.test(password);
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({ error: 'Пароль должен содержать буквы и цифры' });
    }

    // Проверка существующего пользователя
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // Хеширование пароля
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Создание пользователя
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        plan: 'Start',
        role: 'user',
      },
    });

    // Генерация токена
    const token = generateToken(user);

    console.log(`[Auth] Зарегистрирован новый пользователь: ${email}`);

    res.status(201).json({
      message: 'Регистрация успешна',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('[Auth] Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
};

// Вход
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Валидация
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    // Поиск пользователя
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // Проверка пароля
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // Генерация токена
    const token = generateToken(user);

    console.log(`[Auth] Пользователь вошёл: ${email}`);

    res.json({
      message: 'Вход выполнен успешно',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('[Auth] Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
};

// Получить текущего пользователя
export const me = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    // Получаем актуальные данные из БД
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        role: true,
        subscriptionExpiresAt: true,
        createdAt: true,
      },
    });

    if (!dbUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ user: dbUser });
  } catch (error) {
    console.error('[Auth] Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};

// Выход (опционально - для blacklist токенов)
export const logout = async (req: Request, res: Response) => {
  // В простой реализации токен просто удаляется на клиенте
  // Для blacklist нужна Redis или таблица в БД
  res.json({ message: 'Выход выполнен успешно' });
};

// Обновление токена
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    // Получаем актуальные данные из БД
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!dbUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Генерируем новый токен
    const token = generateToken(dbUser);

    res.json({
      token,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        plan: dbUser.plan,
        role: dbUser.role,
      },
    });
  } catch (error) {
    console.error('[Auth] Ошибка обновления токена:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
};
