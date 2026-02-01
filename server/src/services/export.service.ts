import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type ExportFormat = 'csv' | 'xlsx' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  userId: number;
  filters?: {
    status?: string;
    stage?: string;
    priority?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

/**
 * Экспорт лидов
 */
export async function exportLeads(options: ExportOptions) {
  const where: any = {
    userId: options.userId,
  };

  if (options.filters?.status && options.filters.status !== 'all') {
    where.status = options.filters.status;
  }

  if (options.filters?.dateFrom || options.filters?.dateTo) {
    where.createdAt = {};
    if (options.filters.dateFrom) {
      where.createdAt.gte = new Date(options.filters.dateFrom);
    }
    if (options.filters.dateTo) {
      where.createdAt.lte = new Date(options.filters.dateTo);
    }
  }

  const leads = await prisma.lead.findMany({
    where,
    include: {
      campaign: {
        select: {
          name: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const data = leads.map((lead) => ({
    ID: lead.id,
    Имя: lead.name,
    Телефон: lead.phone,
    Email: lead.email,
    Статус: lead.status,
    Источник: lead.source || '',
    Кампания: lead.campaign?.name || '',
    Статус_кампании: lead.campaign?.status || '',
    Заметки: lead.notes || '',
    Создано: new Date(lead.createdAt).toLocaleString('ru-RU'),
    Обновлено: new Date(lead.updatedAt).toLocaleString('ru-RU'),
  }));

  return formatExport(data, options.format, 'leads');
}

/**
 * Экспорт сделок
 */
export async function exportDeals(options: ExportOptions) {
  const where: any = {
    userId: options.userId,
  };

  if (options.filters?.stage && options.filters.stage !== 'all') {
    where.stage = options.filters.stage;
  }

  if (options.filters?.dateFrom || options.filters?.dateTo) {
    where.createdAt = {};
    if (options.filters.dateFrom) {
      where.createdAt.gte = new Date(options.filters.dateFrom);
    }
    if (options.filters.dateTo) {
      where.createdAt.lte = new Date(options.filters.dateTo);
    }
  }

  const deals = await prisma.deal.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
  });

  const data = deals.map((deal) => ({
    ID: deal.id,
    Название: deal.name,
    Клиент: deal.clientName || '',
    Сумма: deal.amount.toString(),
    Валюта: deal.currency || '₸',
    Вероятность: deal.probability || 0,
    Этап: deal.stage,
    Дата_закрытия: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleString('ru-RU') : '',
    Заметки: deal.notes || '',
    Создано: new Date(deal.createdAt).toLocaleString('ru-RU'),
    Обновлено: new Date(deal.updatedAt).toLocaleString('ru-RU'),
  }));

  return formatExport(data, options.format, 'deals');
}

/**
 * Экспорт задач
 */
export async function exportTasks(options: ExportOptions) {
  const where: any = {
    userId: options.userId,
  };

  if (options.filters?.status && options.filters.status !== 'all') {
    where.status = options.filters.status;
  }

  if (options.filters?.priority && options.filters.priority !== 'all') {
    where.priority = options.filters.priority;
  }

  if (options.filters?.dateFrom || options.filters?.dateTo) {
    where.createdAt = {};
    if (options.filters.dateFrom) {
      where.createdAt.gte = new Date(options.filters.dateFrom);
    }
    if (options.filters.dateTo) {
      where.createdAt.lte = new Date(options.filters.dateTo);
    }
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
  });

  const data = tasks.map((task) => ({
    ID: task.id,
    Название: task.title,
    Описание: task.description || '',
    Статус: task.status,
    Приоритет: task.priority,
    Срок_выполнения: task.dueDate ? new Date(task.dueDate).toLocaleString('ru-RU') : '',
    Назначено: task.assignedTo || '',
    Теги: task.tags.join(', ') || '',
    Создано: new Date(task.createdAt).toLocaleString('ru-RU'),
    Обновлено: new Date(task.updatedAt).toLocaleString('ru-RU'),
  }));

  return formatExport(data, options.format, 'tasks');
}

/**
 * Экспорт кампаний
 */
export async function exportCampaigns(options: ExportOptions) {
  const where: any = {
    userId: options.userId,
  };

  if (options.filters?.status && options.filters.status !== 'all') {
    where.status = options.filters.status;
  }

  if (options.filters?.dateFrom || options.filters?.dateTo) {
    where.createdAt = {};
    if (options.filters.dateFrom) {
      where.createdAt.gte = new Date(options.filters.dateFrom);
    }
    if (options.filters.dateTo) {
      where.createdAt.lte = new Date(options.filters.dateTo);
    }
  }

  const campaigns = await prisma.campaign.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
  });

  const data = campaigns.map((campaign) => ({
    ID: campaign.id,
    Название: campaign.name,
    Платформа: campaign.platform,
    Статус: campaign.status,
    Бюджет: campaign.budget.toString(),
    Потрачено: campaign.spent.toString(),
    Конверсии: campaign.conversions || 0,
    Изображение: campaign.imageUrl || '',
    Создано: new Date(campaign.createdAt).toLocaleString('ru-RU'),
    Обновлено: new Date(campaign.updatedAt).toLocaleString('ru-RU'),
  }));

  return formatExport(data, options.format, 'campaigns');
}

/**
 * Форматирование данных для экспорта
 */
function formatExport(
  data: any[],
  format: ExportFormat,
  entityName: string
): { content: Buffer | string; contentType: string; filename: string } {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${entityName}_${timestamp}`;

  switch (format) {
    case 'csv':
      const csv = Papa.unparse(data, {
        header: true,
        delimiter: ',',
      });
      return {
        content: '\ufeff' + csv, // BOM для правильного отображения кириллицы в Excel
        contentType: 'text/csv; charset=utf-8',
        filename: `${filename}.csv`,
      };

    case 'xlsx':
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, entityName);
      const xlsxBuffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      });
      return {
        content: xlsxBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `${filename}.xlsx`,
      };

    case 'json':
      return {
        content: JSON.stringify(data, null, 2),
        contentType: 'application/json',
        filename: `${filename}.json`,
      };

    default:
      throw new Error(`Неподдерживаемый формат экспорта: ${format}`);
  }
}

