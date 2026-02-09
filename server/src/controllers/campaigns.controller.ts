import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getUserIdByPhone } from '../utils/userHelper';
import { getStorageService } from '../services/storage.service';
import { log } from '../utils/logger';
import { getBudgetRecommendations, calculateDailyBudget } from '../services/budget.service';

export class CampaignsController {
  // Получить все кампании
  static async getCampaigns(req: Request, res: Response) {
    try {
      const userPhone = req.user?.phone;
      
      if (!userPhone) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      const userId = await getUserIdByPhone(userPhone);
      
      const campaigns = await prisma.campaign.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      // Преобразуем данные для фронтенда
      const formattedCampaigns = campaigns.map(campaign => {
        // Парсим audience из JSON, если он есть
        let parsedAudience = null;
        if (campaign.audience) {
          try {
            if (typeof campaign.audience === 'string') {
              parsedAudience = JSON.parse(campaign.audience);
            } else if (typeof campaign.audience === 'object') {
              parsedAudience = campaign.audience;
            }
          } catch (error) {
            console.error('Ошибка парсинга audience для кампании', campaign.id, error);
            parsedAudience = null;
          }
        }

        return {
          id: campaign.id,
          name: campaign.name,
          platforms: campaign.platform.split(', ').filter(Boolean),
          status: campaign.status,
          budget: `₸${Number(campaign.budget).toLocaleString()}`,
          spent: `₸${Number(campaign.spent).toLocaleString()}`,
          conversions: campaign.conversions,
          imageUrl: campaign.imageUrl || null,
          phone: campaign.phone || null,
          location: null, // Можно добавить в схему позже
          audience: parsedAudience,
        };
      });

      res.json(formattedCampaigns);
    } catch (error: any) {
      console.error('Ошибка при получении кампаний:', error);
      console.error('Детали ошибки:', {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
        name: error?.name,
        stack: error?.stack,
      });
      
      const errorDetails: any = {
        message: String(error?.message || 'Неизвестная ошибка'),
        code: String(error?.code || 'UNKNOWN'),
        name: String(error?.name || 'Error'),
      };
      
      if (process.env.NODE_ENV === 'development') {
        if (error?.stack) {
          errorDetails.stack = String(error.stack).split('\n').slice(0, 10).join('\n');
        }
        if (error?.meta) {
          errorDetails.meta = error.meta;
        }
      }
      
      res.status(500).json({ 
        error: error?.message || 'Ошибка сервера',
        message: error?.message,
        details: errorDetails,
      });
    }
  }

  // Получить кампанию по ID
  static async getCampaignById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userPhone = req.user?.phone;

      if (!userPhone) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      const userId = await getUserIdByPhone(userPhone);

      const campaign = await prisma.campaign.findFirst({
        where: { 
          id: parseInt(id, 10),
          userId 
        },
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Кампания не найдена' });
      }

      res.json(campaign);
    } catch (error: any) {
      console.error('Ошибка при получении кампании:', error);
      console.error('Детали ошибки:', {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
      });
      
      const errorDetails: any = {
        message: String(error?.message || 'Неизвестная ошибка'),
        code: String(error?.code || 'UNKNOWN'),
        name: String(error?.name || 'Error'),
      };
      
      if (process.env.NODE_ENV === 'development' && error?.stack) {
        errorDetails.stack = String(error.stack).split('\n').slice(0, 10).join('\n');
      }
      
      res.status(500).json({ 
        error: error?.message || 'Ошибка сервера',
        message: error?.message,
        details: errorDetails,
      });
    }
  }

  // Создать новую кампанию
  static async createCampaign(req: Request, res: Response) {
    try {
      const {
        name,
        platforms,
        status,
        budget,
        spent,
        conversions,
        phone,
        location,
        audience,
        imageUrl,
        budgetPeriodDays = 7,
      } = req.body;

      if (!name || !platforms || !Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ error: 'Необходимы поля: name, platforms (массив)' });
      }

      // Получаем userId из базы данных по email
      const userPhone = req.user?.phone;

      if (!userPhone) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      const userId = await getUserIdByPhone(userPhone);

      // Преобразуем budget и spent из строки в число (убираем ₸ и запятые)
      const budgetNum = typeof budget === 'string'
        ? parseFloat(budget.replace(/[^\d.]/g, ''))
        : budget;
      const spentNum = typeof spent === 'string'
        ? parseFloat(spent.replace(/[^\d.]/g, '')) || 0
        : (spent || 0);

      if (!budgetNum || budgetNum < 1000) {
        return res.status(400).json({ error: 'Минимальный бюджет: 1000₸' });
      }

      // Проверяем баланс кошелька
      const wallet = await prisma.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        return res.status(400).json({
          error: 'Кошелёк не найден. Пополните баланс для создания кампании.',
          code: 'WALLET_NOT_FOUND'
        });
      }

      const walletBalance = Number(wallet.balance);
      if (budgetNum > walletBalance) {
        return res.status(400).json({
          error: `Недостаточно средств. Доступно: ${walletBalance.toLocaleString()}₸, требуется: ${budgetNum.toLocaleString()}₸`,
          code: 'INSUFFICIENT_FUNDS',
          availableBalance: walletBalance,
          requestedBudget: budgetNum,
        });
      }

      // Рассчитываем дневной бюджет
      const periodDays = budgetPeriodDays || 7;
      const dailyBudget = calculateDailyBudget(budgetNum, periodDays);

      // Получаем рекомендации по бюджету
      const recommendations = getBudgetRecommendations(platforms, budgetNum, periodDays);

      // Сохраняем platforms как JSON строку (первая платформа для обратной совместимости)
      const platformString = platforms.join(', ');

      // Атомарная транзакция: списание с кошелька + создание кампании
      const result = await prisma.$transaction(async (tx) => {
        // 1. Списываем с кошелька
        const updatedWallet = await tx.wallet.update({
          where: { userId },
          data: { balance: { decrement: budgetNum } },
        });

        // 2. Создаём транзакцию в истории
        const transaction = await tx.walletTransaction.create({
          data: {
            userId,
            walletId: wallet.id,
            type: 'campaign_budget',
            amount: budgetNum,
            balanceBefore: wallet.balance,
            balanceAfter: updatedWallet.balance,
            description: `Бюджет кампании: ${name}`,
          },
        });

        // 3. Создаём кампанию
        const campaignData: any = {
          userId,
          name,
          platform: platformString,
          status: status || 'На проверке',
          budget: budgetNum,
          spent: spentNum,
          conversions: conversions || 0,
          budgetPeriodDays: periodDays,
          dailyBudget: dailyBudget,
          walletTransactionId: transaction.id,
        };

        if (imageUrl) {
          campaignData.imageUrl = imageUrl;
        }

        if (phone) {
          campaignData.phone = phone.trim();
        }

        if (audience) {
          campaignData.audience = audience;
        }

        const campaign = await tx.campaign.create({
          data: campaignData,
        });

        return { campaign, wallet: updatedWallet, transaction };
      });

      // Парсим audience из JSON, если он есть
      let parsedAudience = null;
      if (result.campaign.audience) {
        try {
          if (typeof result.campaign.audience === 'string') {
            parsedAudience = JSON.parse(result.campaign.audience);
          } else if (typeof result.campaign.audience === 'object') {
            parsedAudience = result.campaign.audience;
          }
        } catch (error) {
          console.error('Ошибка парсинга audience при создании кампании:', error);
          parsedAudience = null;
        }
      }

      log.info('Кампания создана с бюджетом', {
        campaignId: result.campaign.id,
        budget: budgetNum,
        periodDays,
        dailyBudget,
        newWalletBalance: Number(result.wallet.balance),
      });

      // Возвращаем с преобразованными данными
      res.status(201).json({
        ...result.campaign,
        platforms: platforms,
        phone: result.campaign.phone || null,
        location: location || null,
        audience: parsedAudience,
        imageUrl: result.campaign.imageUrl || null,
        budget: `₸${budgetNum.toLocaleString()}`,
        spent: `₸${spentNum.toLocaleString()}`,
        dailyBudget: `₸${dailyBudget.toLocaleString()}`,
        budgetPeriodDays: periodDays,
        walletBalance: Number(result.wallet.balance),
        budgetRecommendations: recommendations.warnings,
      });
    } catch (error: any) {
      console.error('Ошибка при создании кампании:', error);
      console.error('Детали ошибки:', {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
        stack: error?.stack,
      });

      // Более детальное сообщение об ошибке
      let errorMessage = 'Ошибка сервера';
      if (error?.code === 'P2002') {
        errorMessage = 'Кампания с таким именем уже существует';
      } else if (error?.code === 'P2011') {
        errorMessage = 'Ошибка валидации данных';
      } else if (error?.message) {
        errorMessage = error.message;
      }

      res.status(500).json({
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    }
  }

  // Обновить кампанию
  static async updateCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userPhone = req.user?.phone;
      
      if (!userPhone) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      const userId = await getUserIdByPhone(userPhone);
      const {
        name,
        platforms,
        status,
        budget,
        spent,
        conversions,
        phone,
        location,
        audience,
        imageUrl,
      } = req.body;

      const campaign = await prisma.campaign.findUnique({
        where: { id: parseInt(id, 10) },
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Кампания не найдена' });
      }

      // Проверяем, что кампания принадлежит пользователю
      if (campaign.userId !== userId) {
        return res.status(403).json({ error: 'Нет доступа к этой кампании' });
      }

      // Преобразуем budget и spent если они строки
      const budgetNum = budget !== undefined 
        ? (typeof budget === 'string' ? parseFloat(budget.replace(/[^\d.]/g, '')) : budget)
        : undefined;
      const spentNum = spent !== undefined
        ? (typeof spent === 'string' ? parseFloat(spent.replace(/[^\d.]/g, '')) : spent)
        : undefined;

      const platformString = platforms ? platforms.join(', ') : undefined;

      const updateData: any = {
        ...(name && { name }),
        ...(platformString && { platform: platformString }),
        ...(status && { status }),
        ...(budgetNum !== undefined && { budget: budgetNum }),
        ...(spentNum !== undefined && { spent: spentNum }),
        ...(conversions !== undefined && { conversions }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
      };

      // Сохраняем audience как JSON, если он передан
      if (audience !== undefined) {
        updateData.audience = audience;
      }

      const updatedCampaign = await prisma.campaign.update({
        where: { id: parseInt(id, 10) },
        data: updateData,
      });

      // Парсим audience из JSON, если он есть
      const parsedAudience = updatedCampaign.audience 
        ? (typeof updatedCampaign.audience === 'string' ? JSON.parse(updatedCampaign.audience) : updatedCampaign.audience)
        : null;

      // Возвращаем с преобразованными данными
      res.json({
        ...updatedCampaign,
        platforms: updatedCampaign.platform.split(', ').filter(Boolean),
        budget: `₸${Number(updatedCampaign.budget).toLocaleString()}`,
        spent: `₸${Number(updatedCampaign.spent).toLocaleString()}`,
        imageUrl: updatedCampaign.imageUrl || null,
        phone: updatedCampaign.phone || null,
        location: location || null,
        audience: parsedAudience,
      });
    } catch (error: any) {
      console.error('Ошибка при обновлении кампании:', error);
      console.error('Детали ошибки:', {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
      });
      
      const errorDetails: any = {
        message: String(error?.message || 'Неизвестная ошибка'),
        code: String(error?.code || 'UNKNOWN'),
        name: String(error?.name || 'Error'),
      };
      
      if (process.env.NODE_ENV === 'development' && error?.stack) {
        errorDetails.stack = String(error.stack).split('\n').slice(0, 10).join('\n');
      }
      
      res.status(500).json({ 
        error: error?.message || 'Ошибка сервера',
        message: error?.message,
        details: errorDetails,
      });
    }
  }

  // Удалить кампанию
  static async deleteCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userPhone = req.user?.phone;
      
      if (!userPhone) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      const userId = await getUserIdByPhone(userPhone);

      const campaign = await prisma.campaign.findUnique({
        where: { id: parseInt(id, 10) },
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Кампания не найдена' });
      }

      // Проверяем, что кампания принадлежит пользователю
      if (campaign.userId !== userId) {
        return res.status(403).json({ error: 'Нет доступа к этой кампании' });
      }

      await prisma.campaign.delete({
        where: { id: parseInt(id, 10) },
      });

      res.json({ message: 'Кампания удалена' });
    } catch (error: any) {
      console.error('Ошибка при удалении кампании:', error);
      console.error('Детали ошибки:', {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
      });
      
      const errorDetails: any = {
        message: String(error?.message || 'Неизвестная ошибка'),
        code: String(error?.code || 'UNKNOWN'),
        name: String(error?.name || 'Error'),
      };
      
      if (process.env.NODE_ENV === 'development' && error?.stack) {
        errorDetails.stack = String(error.stack).split('\n').slice(0, 10).join('\n');
      }
      
      res.status(500).json({ 
        error: error?.message || 'Ошибка сервера',
        message: error?.message,
        details: errorDetails,
      });
    }
  }

  // Загрузка изображения для кампании (локальное хранилище)
  static async uploadImage(req: Request, res: Response) {
    try {
      const { image, fileName } = req.body;

      if (!image) {
        return res.status(400).json({ error: 'Изображение не предоставлено' });
      }

      const storageService = getStorageService();

      // Определяем расширение файла
      const fileExt = fileName?.split('.').pop() || 'jpg';
      const originalName = `campaign-image.${fileExt}`;

      // Загружаем в локальное хранилище
      const result = await storageService.uploadBase64(image, originalName, 'campaigns');

      // Получаем полный публичный URL
      const publicUrl = storageService.getPublicUrl(result.url);

      log.info('Campaign image uploaded', {
        filename: result.filename,
        size: result.size,
        url: result.url,
      });

      res.json({ imageUrl: publicUrl });
    } catch (error: any) {
      log.error('Error uploading campaign image', error);
      // В случае ошибки возвращаем base64 как fallback
      res.json({ imageUrl: req.body.image });
    }
  }

  // Загрузка изображения через multipart form
  static async uploadImageFile(req: Request, res: Response) {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'Файл не предоставлен' });
      }

      const storageService = getStorageService();

      // Загружаем в локальное хранилище
      const result = await storageService.uploadBuffer(
        file.buffer,
        file.originalname,
        'campaigns'
      );

      // Получаем полный публичный URL
      const publicUrl = storageService.getPublicUrl(result.url);

      log.info('Campaign image file uploaded', {
        originalName: file.originalname,
        filename: result.filename,
        size: result.size,
      });

      res.json({ imageUrl: publicUrl });
    } catch (error: any) {
      log.error('Error uploading campaign image file', error);
      res.status(500).json({ error: 'Ошибка загрузки изображения' });
    }
  }
}

