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
  phone: string;
  role: string;
}

// Генерация JWT токена
const generateToken = (user: { id: number; phone: string; role: string }): string => {
  return jwt.sign(
    {
      userId: user.id,
      phone: user.phone,
      role: user.role,
    } as JwtPayload,
    getJwtSecret(),
    { expiresIn: '7d' }
  );
};

// Нормализация номера телефона: оставляем только цифры, приводим к формату 7XXXXXXXXXX
function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  // 8XXXXXXXXXX → 7XXXXXXXXXX
  if (digits.startsWith('8') && digits.length === 11) {
    digits = '7' + digits.slice(1);
  }
  // Если нет кода страны, добавляем 7
  if (digits.length === 10) {
    digits = '7' + digits;
  }
  return digits;
}

// Валидация номера телефона (казахстанский формат)
function isValidPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  return /^7\d{10}$/.test(digits);
}

// Регистрация
export const register = async (req: Request, res: Response) => {
  try {
    const { phone, password, name } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Номер телефона и пароль обязательны' });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Неверный формат номера телефона. Используйте формат +7XXXXXXXXXX' });
    }

    const normalizedPhone = normalizePhone(phone);

    if (password.length < 8) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 8 символов' });
    }

    const hasLetter = /[a-zA-Zа-яА-Я]/.test(password);
    const hasNumber = /\d/.test(password);
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({ error: 'Пароль должен содержать буквы и цифры' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким номером уже существует' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        phone: normalizedPhone,
        password: hashedPassword,
        name: name || `User ${normalizedPhone.slice(-4)}`,
        plan: 'Start',
        role: 'user',
      },
    });

    const token = generateToken(user);

    console.log(`[Auth] Зарегистрирован новый пользователь: ${normalizedPhone}`);

    res.status(201).json({
      message: 'Регистрация успешна',
      token,
      user: {
        id: user.id,
        phone: user.phone,
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
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Номер телефона и пароль обязательны' });
    }

    const normalizedPhone = normalizePhone(phone);

    const user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!user) {
      return res.status(401).json({ error: 'Неверный номер телефона или пароль' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный номер телефона или пароль' });
    }

    const token = generateToken(user);

    console.log(`[Auth] Пользователь вошёл: ${normalizedPhone}`);

    res.json({
      message: 'Вход выполнен успешно',
      token,
      user: {
        id: user.id,
        phone: user.phone,
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

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        phone: true,
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

// Выход
export const logout = async (req: Request, res: Response) => {
  res.json({ message: 'Выход выполнен успешно' });
};

// Обновление токена
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!dbUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const token = generateToken(dbUser);

    res.json({
      token,
      user: {
        id: dbUser.id,
        phone: dbUser.phone,
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
