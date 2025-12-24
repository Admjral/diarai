import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { Plan, Role } from '@prisma/client';
import Papa from 'papaparse';

// Проверка, является ли пользователь админом
async function isAdmin(req: Request): Promise<boolean> {
  const userEmail = req.user?.email;
  if (!userEmail) return false;
  
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { role: true },
  });
  
  return user?.role === Role.admin;
}

// Получить всех пользователей
export async function getAllUsers(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Ошибка при получении пользователей:', error);
    res.status(500).json({ error: 'Ошибка при получении пользователей' });
  }
}

// Обновить план пользователя (админ)
export async function updateUserPlan(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { userId } = req.params;
    const { plan } = req.body;

    if (!plan || !['Free', 'Pro', 'Business'].includes(plan)) {
      return res.status(400).json({ error: 'Неверный план подписки' });
    }

    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { plan: plan as Plan },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        role: true,
      },
    });

    res.json({ ...user, message: 'План подписки обновлен' });
  } catch (error) {
    console.error('Ошибка при обновлении плана:', error);
    res.status(500).json({ error: 'Ошибка при обновлении плана' });
  }
}

// Установить роль пользователя
export async function updateUserRole(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Неверная роль' });
    }

    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { role: role as Role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    res.json({ ...user, message: 'Роль обновлена' });
  } catch (error) {
    console.error('Ошибка при обновлении роли:', error);
    res.status(500).json({ error: 'Ошибка при обновлении роли' });
  }
}

// Получить все кампании всех пользователей
export async function getAllCampaigns(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Добавляем информацию о пользователе
    const campaignsWithUsers = await Promise.all(
      campaigns.map(async (campaign) => {
        const user = await prisma.user.findUnique({
          where: { id: campaign.userId },
          select: { email: true, name: true },
        });
        
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
          audience: parsedAudience,
          user: user || null,
        };
      })
    );

    res.json(campaignsWithUsers);
  } catch (error) {
    console.error('Ошибка при получении кампаний:', error);
    res.status(500).json({ error: 'Ошибка при получении кампаний' });
  }
}

// Включить/выключить кампанию
export async function toggleCampaign(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { campaignId } = req.params;
    const { status } = req.body;

    if (!status || !['Активна', 'На паузе', 'На проверке'].includes(status)) {
      return res.status(400).json({ error: 'Неверный статус' });
    }

    const campaign = await prisma.campaign.update({
      where: { id: parseInt(campaignId) },
      data: { status },
    });

    let message = '';
    if (status === 'Активна') {
      message = 'Кампания активирована';
    } else if (status === 'На паузе') {
      message = 'Кампания приостановлена';
    } else if (status === 'На проверке') {
      message = 'Кампания отправлена на проверку';
    }

    res.json({ ...campaign, message });
  } catch (error) {
    console.error('Ошибка при изменении статуса кампании:', error);
    res.status(500).json({ error: 'Ошибка при изменении статуса кампании' });
  }
}

// Получить статистику по всем пользователям
export async function getAdminStats(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const [
      totalUsers,
      activeUsers,
      totalCampaigns,
      activeCampaigns,
      totalLeads,
      totalDeals,
      revenue,
      totalWallets,
      totalBalance,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { plan: { not: 'Free' } } }),
      prisma.campaign.count(),
      prisma.campaign.count({ where: { status: 'Активна' } }),
      prisma.lead.count(),
      prisma.deal.count(),
      prisma.deal.aggregate({
        _sum: { amount: true },
      }),
      prisma.wallet.count(),
      prisma.wallet.aggregate({
        _sum: { balance: true },
      }),
    ]);

    res.json({
      totalUsers,
      activeUsers,
      totalCampaigns,
      activeCampaigns,
      totalLeads,
      totalDeals,
      revenue: revenue._sum.amount || 0,
      totalWallets,
      totalBalance: totalBalance._sum.balance || 0,
    });
  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    res.status(500).json({ error: 'Ошибка при получении статистики' });
  }
}

// Экспорт всех лидов в CSV
export async function exportLeads(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Формируем CSV
    const csvHeader = 'ID,Имя,Телефон,Email,Источник,Статус,Дата создания\n';
    const csvRows = leads.map(lead => 
      `${lead.id},"${lead.name}","${lead.phone}","${lead.email}","${lead.source}","${lead.status}","${lead.createdAt.toISOString()}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
    res.send('\ufeff' + csvHeader + csvRows); // BOM для Excel
  } catch (error) {
    console.error('Ошибка при экспорте лидов:', error);
    res.status(500).json({ error: 'Ошибка при экспорте лидов' });
  }
}

// Экспорт всех клиентов в CSV
export async function exportClients(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const clients = await prisma.clients.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const csvHeader = 'ID,Имя,Телефон,Email,Этап,Статус,Дата создания\n';
    const csvRows = clients.map(client => 
      `${client.id},"${client.name}","${client.phone}","${client.email}","${client.stage}","${client.status}","${client.createdAt.toISOString()}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=clients.csv');
    res.send('\ufeff' + csvHeader + csvRows);
  } catch (error) {
    console.error('Ошибка при экспорте клиентов:', error);
    res.status(500).json({ error: 'Ошибка при экспорте клиентов' });
  }
}

// Экспорт статистики кампаний в CSV
export async function exportCampaignsStats(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        // Получаем информацию о пользователе через userId
      },
    });

    // Получаем информацию о пользователях
    const campaignsWithUsers = await Promise.all(
      campaigns.map(async (campaign) => {
        const user = await prisma.user.findUnique({
          where: { id: campaign.userId },
          select: { email: true, name: true },
        });
        return {
          ...campaign,
          userEmail: user?.email || 'N/A',
          userName: user?.name || 'N/A',
        };
      })
    );

    // Формируем CSV
    const csvHeader = 'ID,Название,Пользователь,Email пользователя,Платформы,Статус,Бюджет (₸),Потрачено (₸),Конверсии,Дата создания,Дата обновления\n';
    const csvRows = campaignsWithUsers.map(campaign => {
      const platforms = campaign.platform.split(', ').filter(Boolean).join('; ');
      const budget = Number(campaign.budget).toFixed(2);
      const spent = Number(campaign.spent).toFixed(2);
      return `${campaign.id},"${campaign.name}","${campaign.userName}","${campaign.userEmail}","${platforms}","${campaign.status}",${budget},${spent},${campaign.conversions},"${campaign.createdAt.toISOString()}","${campaign.updatedAt.toISOString()}"`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=campaigns_stats.csv');
    res.send('\ufeff' + csvHeader + csvRows);
  } catch (error) {
    console.error('Ошибка при экспорте статистики кампаний:', error);
    res.status(500).json({ error: 'Ошибка при экспорте статистики кампаний' });
  }
}

// Получить все кошельки пользователей
export async function getAllWallets(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const wallets = await prisma.wallet.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    // Добавляем информацию о пользователе
    const walletsWithUsers = await Promise.all(
      wallets.map(async (wallet) => {
        const user = await prisma.user.findUnique({
          where: { id: wallet.userId },
          select: { email: true, name: true },
        });
        return {
          ...wallet,
          balance: wallet.balance.toString(),
          user: user || null,
        };
      })
    );

    res.json(walletsWithUsers);
  } catch (error) {
    console.error('Ошибка при получении кошельков:', error);
    res.status(500).json({ error: 'Ошибка при получении кошельков' });
  }
}

// Пополнить кошелек пользователя (админ)
export async function adminAddFunds(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { userId } = req.params;
    const { amount, note } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Сумма должна быть положительным числом' });
    }

    // Ищем или создаем кошелек пользователя
    let wallet = await prisma.wallet.findUnique({
      where: { userId: parseInt(userId) },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: parseInt(userId),
          balance: 0,
          currency: '₸',
        },
      });
    }

    // Обновляем баланс
    const newBalance = Number(wallet.balance) + Number(amount);
    wallet = await prisma.wallet.update({
      where: { userId: parseInt(userId) },
      data: { balance: newBalance },
    });

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { email: true, name: true },
    });

    res.json({
      ...wallet,
      balance: wallet.balance.toString(),
      user: user || null,
      message: `Кошелек пополнен на ${amount} ${wallet.currency}`,
      note: note || null,
    });
  } catch (error) {
    console.error('Ошибка при пополнении кошелька:', error);
    res.status(500).json({ error: 'Ошибка при пополнении кошелька' });
  }
}

// Снять средства с кошелька пользователя (админ)
export async function adminWithdrawFunds(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { userId } = req.params;
    const { amount, note } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Сумма должна быть положительным числом' });
    }

    // Ищем кошелек пользователя
    let wallet = await prisma.wallet.findUnique({
      where: { userId: parseInt(userId) },
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Кошелек не найден' });
    }

    // Проверяем достаточность средств
    const currentBalance = Number(wallet.balance);
    const withdrawAmount = Number(amount);

    if (currentBalance < withdrawAmount) {
      return res.status(400).json({ 
        error: `Недостаточно средств. Доступно: ${currentBalance} ${wallet.currency}` 
      });
    }

    // Обновляем баланс
    const newBalance = currentBalance - withdrawAmount;
    wallet = await prisma.wallet.update({
      where: { userId: parseInt(userId) },
      data: { balance: newBalance },
    });

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { email: true, name: true },
    });

    res.json({
      ...wallet,
      balance: wallet.balance.toString(),
      user: user || null,
      message: `С кошелька снято ${amount} ${wallet.currency}`,
      note: note || null,
    });
  } catch (error) {
    console.error('Ошибка при снятии средств:', error);
    res.status(500).json({ error: 'Ошибка при снятии средств' });
  }
}

// Установить баланс кошелька напрямую (админ)
export async function adminSetBalance(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { userId } = req.params;
    const { balance, note } = req.body;

    if (balance === undefined || balance < 0) {
      return res.status(400).json({ error: 'Баланс должен быть неотрицательным числом' });
    }

    // Ищем или создаем кошелек пользователя
    let wallet = await prisma.wallet.findUnique({
      where: { userId: parseInt(userId) },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: parseInt(userId),
          balance: Number(balance),
          currency: '₸',
        },
      });
    } else {
      wallet = await prisma.wallet.update({
        where: { userId: parseInt(userId) },
        data: { balance: Number(balance) },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { email: true, name: true },
    });

    res.json({
      ...wallet,
      balance: wallet.balance.toString(),
      user: user || null,
      message: `Баланс установлен: ${balance} ${wallet.currency}`,
      note: note || null,
    });
  } catch (error) {
    console.error('Ошибка при установке баланса:', error);
    res.status(500).json({ error: 'Ошибка при установке баланса' });
  }
}

// Импорт лидов для пользователя
export async function importLeads(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { userId } = req.params;
    const file = req.file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json({ error: 'Файл не предоставлен' });
    }

    // Проверяем существование пользователя
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Парсим CSV
    const csvText = file.buffer.toString('utf-8');
    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parseResult.errors.length > 0) {
      return res.status(400).json({ 
        error: 'Ошибка парсинга CSV', 
        details: parseResult.errors 
      });
    }

    const leads = parseResult.data as any[];
    const createdLeads = [];
    const errors = [];

    for (const lead of leads) {
      try {
        // Пропускаем строку, если нет обязательных полей
        if (!lead.Имя || !lead.Телефон || !lead.Email) {
          errors.push({ row: lead, error: 'Отсутствуют обязательные поля' });
          continue;
        }

        const newLead = await prisma.lead.create({
          data: {
            userId: parseInt(userId),
            name: lead.Имя.trim(),
            phone: lead.Телефон.trim(),
            email: lead.Email.trim(),
            source: lead.Источник?.trim() || 'Другое',
            status: (lead.Статус?.trim() as any) || 'new',
            notes: lead.Заметки?.trim() || null,
          },
        });
        createdLeads.push(newLead);
      } catch (error: any) {
        errors.push({ row: lead, error: error.message });
      }
    }

    res.json({
      message: `Импортировано ${createdLeads.length} лидов`,
      created: createdLeads.length,
      errors: errors.length,
      errorDetails: errors,
    });
  } catch (error) {
    console.error('Ошибка при импорте лидов:', error);
    res.status(500).json({ error: 'Ошибка при импорте лидов' });
  }
}

// Импорт клиентов для пользователя
export async function importClients(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { userId } = req.params;
    const file = req.file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json({ error: 'Файл не предоставлен' });
    }

    // Проверяем существование пользователя
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Парсим CSV
    const csvText = file.buffer.toString('utf-8');
    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parseResult.errors.length > 0) {
      return res.status(400).json({ 
        error: 'Ошибка парсинга CSV', 
        details: parseResult.errors 
      });
    }

    const clients = parseResult.data as any[];
    const createdClients = [];
    const errors = [];

    for (const client of clients) {
      try {
        // Пропускаем строку, если нет обязательных полей
        if (!client.Имя || !client.Телефон || !client.Email) {
          errors.push({ row: client, error: 'Отсутствуют обязательные поля' });
          continue;
        }

        // Получаем UUID пользователя из Supabase (для упрощения используем пустую строку, 
        // так как это поле может быть необязательным в некоторых случаях)
        const newClient = await prisma.clients.create({
          data: {
            userid_old: parseInt(userId),
            userId: '', // UUID будет установлен через RLS или другой механизм
            name: client.Имя.trim(),
            phone: client.Телефон.trim(),
            email: client.Email.trim(),
            stage: client.Этап?.trim() || 'Первый контакт',
            status: client.Статус?.trim() || 'Новый',
          },
        });
        createdClients.push(newClient);
      } catch (error: any) {
        errors.push({ row: client, error: error.message });
      }
    }

    res.json({
      message: `Импортировано ${createdClients.length} клиентов`,
      created: createdClients.length,
      errors: errors.length,
      errorDetails: errors,
    });
  } catch (error) {
    console.error('Ошибка при импорте клиентов:', error);
    res.status(500).json({ error: 'Ошибка при импорте клиентов' });
  }
}

// Импорт статистики кампаний для пользователя
export async function importCampaignsStats(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { userId } = req.params;
    const file = req.file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json({ error: 'Файл не предоставлен' });
    }

    // Проверяем существование пользователя
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Парсим CSV
    const csvText = file.buffer.toString('utf-8');
    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parseResult.errors.length > 0) {
      return res.status(400).json({ 
        error: 'Ошибка парсинга CSV', 
        details: parseResult.errors 
      });
    }

    const campaigns = parseResult.data as any[];
    const createdCampaigns = [];
    const updatedCampaigns = [];
    const errors = [];

    for (const campaign of campaigns) {
      try {
        // Пропускаем строку, если нет обязательных полей
        if (!campaign.Название) {
          errors.push({ row: campaign, error: 'Отсутствует название кампании' });
          continue;
        }

        const budget = parseFloat(campaign['Бюджет (₸)']?.replace(/[₸,\s]/g, '') || '0');
        const spent = parseFloat(campaign['Потрачено (₸)']?.replace(/[₸,\s]/g, '') || '0');
        const conversions = parseInt(campaign.Конверсии || '0');

        // Если есть ID, обновляем существующую кампанию
        if (campaign.ID && !isNaN(parseInt(campaign.ID))) {
          const existingCampaign = await prisma.campaign.findFirst({
            where: { id: parseInt(campaign.ID), userId: parseInt(userId) },
          });

          if (existingCampaign) {
            const updated = await prisma.campaign.update({
              where: { id: parseInt(campaign.ID) },
              data: {
                name: campaign.Название.trim(),
                platform: campaign.Платформы?.trim() || '',
                status: campaign.Статус?.trim() || 'Активна',
                budget: budget,
                spent: spent,
                conversions: conversions,
              },
            });
            updatedCampaigns.push(updated);
            continue;
          }
        }

        // Создаем новую кампанию
        const newCampaign = await prisma.campaign.create({
          data: {
            userId: parseInt(userId),
            name: campaign.Название.trim(),
            platform: campaign.Платформы?.trim() || '',
            status: campaign.Статус?.trim() || 'Активна',
            budget: budget,
            spent: spent,
            conversions: conversions,
          },
        });
        createdCampaigns.push(newCampaign);
      } catch (error: any) {
        errors.push({ row: campaign, error: error.message });
      }
    }

    res.json({
      message: `Импортировано ${createdCampaigns.length} новых кампаний, обновлено ${updatedCampaigns.length}`,
      created: createdCampaigns.length,
      updated: updatedCampaigns.length,
      errors: errors.length,
      errorDetails: errors,
    });
  } catch (error) {
    console.error('Ошибка при импорте статистики кампаний:', error);
    res.status(500).json({ error: 'Ошибка при импорте статистики кампаний' });
  }
}

