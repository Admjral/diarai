import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { Plan, Role, CampaignAction } from '@prisma/client';
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

// Экспорт лидов в CSV (по пользователю или всех)
export async function exportLeads(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const userId = req.query.userId ? parseInt(req.query.userId as string) : null;

    // Если userId указан, проверяем существование пользователя
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
    }

    const whereClause = userId ? { userId } : {};

    const leads = await prisma.lead.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    // Формируем CSV
    const csvHeader = 'ID,Имя,Телефон,Email,Источник,Статус,Дата создания\n';
    const csvRows = leads.map(lead => 
      `${lead.id},"${lead.name}","${lead.phone}","${lead.email}","${lead.source}","${lead.status}","${lead.createdAt.toISOString()}"`
    ).join('\n');

    const filename = userId ? `leads_user_${userId}.csv` : 'leads_all.csv';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send('\ufeff' + csvHeader + csvRows); // BOM для Excel
  } catch (error) {
    console.error('Ошибка при экспорте лидов:', error);
    res.status(500).json({ error: 'Ошибка при экспорте лидов' });
  }
}

// Экспорт клиентов в CSV (по пользователю или всех)
export async function exportClients(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const userId = req.query.userId ? parseInt(req.query.userId as string) : null;

    // Если userId указан, проверяем существование пользователя
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
    }

    // Для таблицы clients используем userid_old для фильтрации
    const whereClause = userId ? { userid_old: userId } : {};

    const clients = await prisma.clients.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    const csvHeader = 'ID,Имя,Телефон,Email,Этап,Статус,Дата создания\n';
    const csvRows = clients.map(client => 
      `${client.id},"${client.name}","${client.phone}","${client.email}","${client.stage}","${client.status}","${client.createdAt.toISOString()}"`
    ).join('\n');

    const filename = userId ? `clients_user_${userId}.csv` : 'clients_all.csv';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send('\ufeff' + csvHeader + csvRows);
  } catch (error) {
    console.error('Ошибка при экспорте клиентов:', error);
    res.status(500).json({ error: 'Ошибка при экспорте клиентов' });
  }
}

// Экспорт статистики кампаний в CSV (по пользователю или всех)
export async function exportCampaignsStats(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const userId = req.query.userId ? parseInt(req.query.userId as string) : null;

    // Если userId указан, проверяем существование пользователя
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
    }

    const whereClause = userId ? { userId } : {};

    const campaigns = await prisma.campaign.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
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

    const filename = userId ? `campaigns_stats_user_${userId}.csv` : 'campaigns_stats_all.csv';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
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
            updatedAt: new Date(),
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

// Обновить статистику кампании (админ)
export async function updateCampaignStats(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { campaignId } = req.params;
    const { spent, conversions, budget } = req.body;

    // Проверяем существование кампании
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseInt(campaignId) },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Кампания не найдена' });
    }

    // Формируем данные для обновления
    const updateData: any = {};
    
    if (spent !== undefined) {
      const spentNum = typeof spent === 'string' 
        ? parseFloat(spent.replace(/[₸,\s]/g, '')) 
        : spent;
      if (!isNaN(spentNum) && spentNum >= 0) {
        updateData.spent = spentNum;
      }
    }

    if (conversions !== undefined) {
      const conversionsNum = parseInt(conversions);
      if (!isNaN(conversionsNum) && conversionsNum >= 0) {
        updateData.conversions = conversionsNum;
      }
    }

    if (budget !== undefined) {
      const budgetNum = typeof budget === 'string' 
        ? parseFloat(budget.replace(/[₸,\s]/g, '')) 
        : budget;
      if (!isNaN(budgetNum) && budgetNum > 0) {
        updateData.budget = budgetNum;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Необходимо указать хотя бы одно поле для обновления' });
    }

    // Обновляем кампанию
    const updatedCampaign = await prisma.campaign.update({
      where: { id: parseInt(campaignId) },
      data: updateData,
    });

    // Получаем информацию о пользователе
    const user = await prisma.user.findUnique({
      where: { id: updatedCampaign.userId },
      select: { email: true, name: true },
    });

    res.json({
      ...updatedCampaign,
      budget: `₸${Number(updatedCampaign.budget).toLocaleString()}`,
      spent: `₸${Number(updatedCampaign.spent).toLocaleString()}`,
      conversions: updatedCampaign.conversions,
      user: user || null,
      message: 'Статистика кампании обновлена',
    });
  } catch (error) {
    console.error('Ошибка при обновлении статистики кампании:', error);
    res.status(500).json({ error: 'Ошибка при обновлении статистики кампании' });
  }
}

// Массовое обновление статистики кампаний
export async function bulkUpdateCampaignsStats(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { updates } = req.body; // Массив { campaignId, spent?, conversions?, budget? }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Необходимо предоставить массив обновлений' });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const { campaignId, spent, conversions, budget } = update;

        if (!campaignId) {
          errors.push({ campaignId, error: 'ID кампании обязателен' });
          continue;
        }

        const updateData: any = {};

        if (spent !== undefined) {
          const spentNum = typeof spent === 'string' 
            ? parseFloat(spent.replace(/[₸,\s]/g, '')) 
            : spent;
          if (!isNaN(spentNum) && spentNum >= 0) {
            updateData.spent = spentNum;
          }
        }

        if (conversions !== undefined) {
          const conversionsNum = parseInt(conversions);
          if (!isNaN(conversionsNum) && conversionsNum >= 0) {
            updateData.conversions = conversionsNum;
          }
        }

        if (budget !== undefined) {
          const budgetNum = typeof budget === 'string' 
            ? parseFloat(budget.replace(/[₸,\s]/g, '')) 
            : budget;
          if (!isNaN(budgetNum) && budgetNum > 0) {
            updateData.budget = budgetNum;
          }
        }

        if (Object.keys(updateData).length === 0) {
          errors.push({ campaignId, error: 'Нет данных для обновления' });
          continue;
        }

        const updated = await prisma.campaign.update({
          where: { id: parseInt(campaignId) },
          data: updateData,
        });

        results.push({
          campaignId: updated.id,
          spent: Number(updated.spent),
          conversions: updated.conversions,
          budget: Number(updated.budget),
        });
      } catch (error: any) {
        errors.push({ campaignId: update.campaignId, error: error.message });
      }
    }

    res.json({
      message: `Обновлено ${results.length} кампаний`,
      updated: results.length,
      errors: errors.length,
      errorDetails: errors,
    });
  } catch (error) {
    console.error('Ошибка при массовом обновлении статистики:', error);
    res.status(500).json({ error: 'Ошибка при массовом обновлении статистики' });
  }
}

// =====================
// CAMPAIGN MANAGEMENT (Admin Edit, Approve, Reject, History)
// =====================

// Редактировать кампанию (админ)
export async function adminEditCampaign(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const adminEmail = req.user?.email;
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    });

    if (!admin) {
      return res.status(401).json({ error: 'Админ не найден' });
    }

    const { campaignId } = req.params;
    const { name, adText, audience, budget, platform } = req.body;

    // Получаем текущую кампанию
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseInt(campaignId) },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Кампания не найдена' });
    }

    // Собираем изменения для истории
    const changes: { fieldName: string; oldValue: any; newValue: any }[] = [];
    const updateData: any = {};

    if (name && name !== campaign.name) {
      changes.push({ fieldName: 'name', oldValue: campaign.name, newValue: name });
      updateData.name = name;
    }

    if (platform && platform !== campaign.platform) {
      changes.push({ fieldName: 'platform', oldValue: campaign.platform, newValue: platform });
      updateData.platform = platform;
    }

    if (budget !== undefined) {
      const budgetNum = typeof budget === 'string'
        ? parseFloat(budget.replace(/[₸,\s]/g, ''))
        : budget;
      if (!isNaN(budgetNum) && budgetNum !== Number(campaign.budget)) {
        changes.push({ fieldName: 'budget', oldValue: Number(campaign.budget), newValue: budgetNum });
        updateData.budget = budgetNum;
      }
    }

    if (audience !== undefined) {
      const currentAudience = campaign.audience as any;
      // Обновляем adText внутри audience если передан
      if (adText) {
        const newAudience = { ...(currentAudience || {}), adText };
        changes.push({ fieldName: 'audience.adText', oldValue: currentAudience?.adText, newValue: adText });
        updateData.audience = newAudience;
      } else {
        changes.push({ fieldName: 'audience', oldValue: currentAudience, newValue: audience });
        updateData.audience = audience;
      }
    } else if (adText) {
      // Обновляем только adText в существующем audience
      const currentAudience = (campaign.audience as any) || {};
      const newAudience = { ...currentAudience, adText };
      changes.push({ fieldName: 'audience.adText', oldValue: currentAudience?.adText, newValue: adText });
      updateData.audience = newAudience;
    }

    if (changes.length === 0) {
      return res.status(400).json({ error: 'Нет изменений для сохранения' });
    }

    // Выполняем транзакцию: обновление кампании + запись в историю
    await prisma.$transaction([
      ...changes.map(change =>
        prisma.campaignHistory.create({
          data: {
            campaignId: parseInt(campaignId),
            adminId: admin.id,
            action: 'updated' as CampaignAction,
            fieldName: change.fieldName,
            oldValue: change.oldValue,
            newValue: change.newValue,
          },
        })
      ),
      prisma.campaign.update({
        where: { id: parseInt(campaignId) },
        data: updateData,
      }),
    ]);

    // Получаем обновленную кампанию
    const updatedCampaign = await prisma.campaign.findUnique({
      where: { id: parseInt(campaignId) },
    });

    res.json({
      success: true,
      campaign: updatedCampaign,
      changes: changes.length,
      message: `Кампания обновлена (${changes.length} изменений)`,
    });
  } catch (error) {
    console.error('Ошибка при редактировании кампании:', error);
    res.status(500).json({ error: 'Ошибка при редактировании кампании' });
  }
}

// Одобрить кампанию (админ)
export async function approveCampaign(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const adminEmail = req.user?.email;
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    });

    if (!admin) {
      return res.status(401).json({ error: 'Админ не найден' });
    }

    const { campaignId } = req.params;

    // Проверяем существование кампании
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseInt(campaignId) },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Кампания не найдена' });
    }

    // Выполняем транзакцию
    await prisma.$transaction([
      prisma.campaignHistory.create({
        data: {
          campaignId: parseInt(campaignId),
          adminId: admin.id,
          action: 'approved' as CampaignAction,
        },
      }),
      prisma.campaign.update({
        where: { id: parseInt(campaignId) },
        data: {
          status: 'Активна',
          rejectionReason: null,
        },
      }),
    ]);

    // Создаем уведомление для владельца кампании
    await prisma.notification.create({
      data: {
        userId: campaign.userId,
        type: 'campaign_completed',
        title: 'Кампания одобрена',
        message: `Ваша кампания "${campaign.name}" была одобрена и активирована`,
        data: { campaignId: campaign.id },
      },
    });

    res.json({
      success: true,
      message: 'Кампания одобрена и активирована',
    });
  } catch (error) {
    console.error('Ошибка при одобрении кампании:', error);
    res.status(500).json({ error: 'Ошибка при одобрении кампании' });
  }
}

// Отклонить кампанию (админ)
export async function rejectCampaign(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const adminEmail = req.user?.email;
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    });

    if (!admin) {
      return res.status(401).json({ error: 'Админ не найден' });
    }

    const { campaignId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Укажите причину отклонения' });
    }

    // Проверяем существование кампании
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseInt(campaignId) },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Кампания не найдена' });
    }

    // Выполняем транзакцию
    await prisma.$transaction([
      prisma.campaignHistory.create({
        data: {
          campaignId: parseInt(campaignId),
          adminId: admin.id,
          action: 'rejected' as CampaignAction,
          comment: reason,
        },
      }),
      prisma.campaign.update({
        where: { id: parseInt(campaignId) },
        data: {
          status: 'Отклонена',
          rejectionReason: reason,
        },
      }),
    ]);

    // Создаем уведомление для владельца кампании
    await prisma.notification.create({
      data: {
        userId: campaign.userId,
        type: 'campaign_completed',
        title: 'Кампания отклонена',
        message: `Ваша кампания "${campaign.name}" была отклонена. Причина: ${reason}`,
        data: { campaignId: campaign.id, reason },
      },
    });

    res.json({
      success: true,
      message: 'Кампания отклонена',
    });
  } catch (error) {
    console.error('Ошибка при отклонении кампании:', error);
    res.status(500).json({ error: 'Ошибка при отклонении кампании' });
  }
}

// Получить историю изменений кампании (админ)
export async function getCampaignHistory(req: Request, res: Response) {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { campaignId } = req.params;

    // Проверяем существование кампании
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseInt(campaignId) },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Кампания не найдена' });
    }

    const history = await prisma.campaignHistory.findMany({
      where: { campaignId: parseInt(campaignId) },
      include: {
        admin: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(history);
  } catch (error) {
    console.error('Ошибка при получении истории кампании:', error);
    res.status(500).json({ error: 'Ошибка при получении истории кампании' });
  }
}

