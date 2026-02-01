import { Request, Response } from 'express';
import { exportLeads, exportDeals, exportTasks, exportCampaigns, ExportFormat } from '../services/export.service';
import { logger } from '../utils/logger';

/**
 * Экспорт лидов
 * GET /api/export/leads?format=csv&status=all
 */
export async function exportLeadsHandler(req: Request, res: Response) {
  try {
    const format = (req.query.format as ExportFormat) || 'csv';
    const userId = req.user?.userId || 0;

    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!['csv', 'xlsx', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Неподдерживаемый формат. Используйте: csv, xlsx, json' });
    }

    const filters = {
      status: req.query.status as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };

    const result = await exportLeads({
      format,
      userId,
      filters,
    });

    logger.info('Экспорт лидов', {
      userId,
      format,
      count: 'N/A', // Количество будет в данных
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

    if (Buffer.isBuffer(result.content)) {
      return res.send(result.content);
    } else {
      return res.send(result.content);
    }
  } catch (error: any) {
    logger.error('Ошибка экспорта лидов', error, {
      userId: req.user?.userId,
      format: req.query.format,
    });
    res.status(500).json({ error: 'Ошибка экспорта лидов', message: error.message });
  }
}

/**
 * Экспорт сделок
 * GET /api/export/deals?format=xlsx&stage=all
 */
export async function exportDealsHandler(req: Request, res: Response) {
  try {
    const format = (req.query.format as ExportFormat) || 'csv';
    const userId = req.user?.userId || 0;

    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!['csv', 'xlsx', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Неподдерживаемый формат. Используйте: csv, xlsx, json' });
    }

    const filters = {
      stage: req.query.stage as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };

    const result = await exportDeals({
      format,
      userId,
      filters,
    });

    logger.info('Экспорт сделок', {
      userId,
      format,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

    if (Buffer.isBuffer(result.content)) {
      return res.send(result.content);
    } else {
      return res.send(result.content);
    }
  } catch (error: any) {
    logger.error('Ошибка экспорта сделок', error, {
      userId: req.user?.userId,
      format: req.query.format,
    });
    res.status(500).json({ error: 'Ошибка экспорта сделок', message: error.message });
  }
}

/**
 * Экспорт задач
 * GET /api/export/tasks?format=csv&status=all&priority=all
 */
export async function exportTasksHandler(req: Request, res: Response) {
  try {
    const format = (req.query.format as ExportFormat) || 'csv';
    const userId = req.user?.userId || 0;

    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!['csv', 'xlsx', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Неподдерживаемый формат. Используйте: csv, xlsx, json' });
    }

    const filters = {
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };

    const result = await exportTasks({
      format,
      userId,
      filters,
    });

    logger.info('Экспорт задач', {
      userId,
      format,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

    if (Buffer.isBuffer(result.content)) {
      return res.send(result.content);
    } else {
      return res.send(result.content);
    }
  } catch (error: any) {
    logger.error('Ошибка экспорта задач', error, {
      userId: req.user?.userId,
      format: req.query.format,
    });
    res.status(500).json({ error: 'Ошибка экспорта задач', message: error.message });
  }
}

/**
 * Экспорт кампаний
 * GET /api/export/campaigns?format=xlsx&status=all
 */
export async function exportCampaignsHandler(req: Request, res: Response) {
  try {
    const format = (req.query.format as ExportFormat) || 'csv';
    const userId = req.user?.userId || 0;

    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!['csv', 'xlsx', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Неподдерживаемый формат. Используйте: csv, xlsx, json' });
    }

    const filters = {
      status: req.query.status as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    };

    const result = await exportCampaigns({
      format,
      userId,
      filters,
    });

    logger.info('Экспорт кампаний', {
      userId,
      format,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

    if (Buffer.isBuffer(result.content)) {
      return res.send(result.content);
    } else {
      return res.send(result.content);
    }
  } catch (error: any) {
    logger.error('Ошибка экспорта кампаний', error, {
      userId: req.user?.userId,
      format: req.query.format,
    });
    res.status(500).json({ error: 'Ошибка экспорта кампаний', message: error.message });
  }
}

