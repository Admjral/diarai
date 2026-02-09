import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { getUserIdByPhone } from '../utils/userHelper';

// Вспомогательная функция для расчета процентного изменения
function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

// Вспомогательная функция для форматирования изменения
function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}% за неделю`;
}

// Генерация AI Insights на основе данных
function generateAIInsights(
  leadsChange: number,
  salesChange: number,
  conversionChange: number,
  conversionRate: number
): { message: string; recommendation: string } {
  // Анализ трендов
  const isGrowth = leadsChange > 0 || salesChange > 0 || conversionChange > 0;
  const bestMetric = Math.max(leadsChange, salesChange, conversionChange);
  
  if (bestMetric === conversionChange && conversionChange > 10) {
    return {
      message: `Ваша конверсия выросла на ${conversionChange.toFixed(1)}% за последнюю неделю!`,
      recommendation: 'Рекомендуем увеличить бюджет на рекламу в Instagram на 15% для максимизации результатов.',
    };
  }
  
  if (bestMetric === salesChange && salesChange > 15) {
    return {
      message: `Продажи выросли на ${salesChange.toFixed(1)}% за последнюю неделю!`,
      recommendation: 'Отличные результаты! Рассмотрите возможность расширения рекламных кампаний на другие платформы.',
    };
  }
  
  if (bestMetric === leadsChange && leadsChange > 10) {
    return {
      message: `Количество лидов увеличилось на ${leadsChange.toFixed(1)}% за последнюю неделю!`,
      recommendation: 'Рекомендуем оптимизировать процесс обработки лидов для улучшения конверсии.',
    };
  }
  
  if (!isGrowth) {
    return {
      message: 'Требуется внимание к показателям.',
      recommendation: 'Рекомендуем проанализировать рекламные кампании и оптимизировать таргетинг.',
    };
  }
  
  return {
    message: `Ваша конверсия составляет ${conversionRate.toFixed(1)}%.`,
    recommendation: 'Продолжайте отслеживать показатели и оптимизировать рекламные кампании.',
  };
}

export class DashboardController {
  // Получить статистику для дашборда
  static async getStats(req: Request, res: Response) {
    try {
      const userPhone = req.user?.phone;

      if (!userPhone) {
        return res.status(401).json({ error: 'Email пользователя не предоставлен' });
      }

      const userId = await getUserIdByPhone(userPhone);

      // Даты для расчета изменений за неделю
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Параллельные запросы для оптимизации
      const [
        // Текущие значения
        currentLeadsCount,
        currentClosedDeals,
        currentSalesAmount,
        // Значения за предыдущую неделю
        previousLeadsCount,
        previousClosedDeals,
        previousSalesAmount,
        // Активность за 7 дней
        campaignsCreated,
        newClients,
        activeCampaigns,
        // Последние действия
        recentLeads,
        recentCampaigns,
        // Для расчета конверсии
        totalLeads,
        totalClosedDeals,
      ] = await Promise.all([
        // Текущие лиды (последние 7 дней)
        prisma.lead.count({
          where: {
            userId,
            createdAt: { gte: sevenDaysAgo },
          },
        }),
        // Закрытые сделки за последние 7 дней
        prisma.deal.count({
          where: {
            userId,
            stage: 'closed_won',
            createdAt: { gte: sevenDaysAgo },
          },
        }),
        // Сумма продаж за последние 7 дней
        prisma.deal.aggregate({
          where: {
            userId,
            stage: 'closed_won',
            createdAt: { gte: sevenDaysAgo },
          },
          _sum: { amount: true },
        }),
        // Лиды за предыдущую неделю
        prisma.lead.count({
          where: {
            userId,
            createdAt: {
              gte: fourteenDaysAgo,
              lt: sevenDaysAgo,
            },
          },
        }),
        // Закрытые сделки за предыдущую неделю
        prisma.deal.count({
          where: {
            userId,
            stage: 'closed_won',
            createdAt: {
              gte: fourteenDaysAgo,
              lt: sevenDaysAgo,
            },
          },
        }),
        // Сумма продаж за предыдущую неделю
        prisma.deal.aggregate({
          where: {
            userId,
            stage: 'closed_won',
            createdAt: {
              gte: fourteenDaysAgo,
              lt: sevenDaysAgo,
            },
          },
          _sum: { amount: true },
        }),
        // Кампании созданные за 7 дней
        prisma.campaign.count({
          where: {
            userId,
            createdAt: { gte: sevenDaysAgo },
          },
        }),
        // Новые клиенты за 7 дней
        prisma.lead.count({
          where: {
            userId,
            createdAt: { gte: sevenDaysAgo },
          },
        }),
        // Активные кампании
        prisma.campaign.count({
          where: {
            userId,
            status: 'Активна',
          },
        }),
        // Последние лиды
        prisma.lead.findMany({
          where: { userId },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            source: true,
            createdAt: true,
          },
        }),
        // Последние кампании
        prisma.campaign.findMany({
          where: { userId },
          take: 3,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
        }),
        // Все лиды для расчета конверсии
        prisma.lead.count({ where: { userId } }),
        // Все закрытые сделки для расчета конверсии
        prisma.deal.count({
          where: {
            userId,
            stage: 'closed_won',
          },
        }),
      ]);

      // Расчет изменений
      const leadsChange = calculatePercentageChange(currentLeadsCount, previousLeadsCount);
      const salesChange = calculatePercentageChange(
        Number(currentSalesAmount._sum.amount || 0),
        Number(previousSalesAmount._sum.amount || 0)
      );

      // Расчет конверсии
      const conversionRate = totalLeads > 0 ? (totalClosedDeals / totalLeads) * 100 : 0;
      const previousConversionRate = previousLeadsCount > 0
        ? (previousClosedDeals / previousLeadsCount) * 100
        : 0;
      const conversionChange = calculatePercentageChange(conversionRate, previousConversionRate);

      // Форматирование продаж
      const salesValue = Number(currentSalesAmount._sum.amount || 0);
      const formattedSales = salesValue >= 1000000
        ? `₸${(salesValue / 1000000).toFixed(1)}M`
        : `₸${(salesValue / 1000).toFixed(0)}K`;

      // Формирование последних действий
      const recentActions: Array<{
        type: 'lead' | 'campaign';
        description: string;
        timestamp: string;
        source?: string;
      }> = [];

      // Добавляем последние лиды
      recentLeads.forEach((lead) => {
        recentActions.push({
          type: 'lead',
          description: `Новый лид от ${lead.source || 'неизвестного источника'}`,
          timestamp: lead.createdAt.toISOString(),
          source: lead.source || undefined,
        });
      });

      // Добавляем последние кампании
      recentCampaigns.forEach((campaign) => {
        recentActions.push({
          type: 'campaign',
          description: `Запущена рекламная кампания "${campaign.name}"`,
          timestamp: campaign.createdAt.toISOString(),
        });
      });

      // Сортируем по времени (новые первыми) и берем последние 5
      recentActions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const topRecentActions = recentActions.slice(0, 5);

      // Генерация AI Insights
      const aiInsights = generateAIInsights(leadsChange, salesChange, conversionChange, conversionRate);

      // Формирование ответа
      res.json({
        kpis: {
          leads: {
            value: currentLeadsCount,
            change: leadsChange,
            changeLabel: formatChange(leadsChange),
          },
          sales: {
            value: salesValue,
            formattedValue: formattedSales,
            change: salesChange,
            changeLabel: formatChange(salesChange),
          },
          conversion: {
            value: conversionRate,
            change: conversionChange,
            changeLabel: formatChange(conversionChange),
          },
        },
        aiInsights,
        activity: {
          campaignsCreated,
          newClients,
          activeCampaigns,
        },
        recentActions: topRecentActions,
      });
    } catch (error: any) {
      console.error('Ошибка при получении статистики дашборда:', error);
      res.status(500).json({ 
        error: 'Ошибка сервера',
        details: error.message 
      });
    }
  }
}

