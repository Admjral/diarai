import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { log } from './utils/logger.js';
import { getRedis, closeRedis } from './utils/redis.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimit.js';

// Routes
import webhookRoutes from './routes/webhook.routes.js';
import sendRoutes from './routes/send.routes.js';
import sessionRoutes from './routes/session.routes.js';
import healthRoutes from './routes/health.routes.js';
import telegramRoutes from './routes/telegram.routes.js';

// Services
import { getTelegramService } from './channels/telegram/telegram.service.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Trust proxy для Railway (reverse proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  log.http(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Rate limiting
app.use(generalLimiter);

// Routes
app.use('/webhook', webhookRoutes);
app.use('/send', sendRoutes);
app.use('/session', sessionRoutes);
app.use('/health', healthRoutes);
app.use('/telegram', telegramRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'DIAR AI Messenger Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      webhooks: '/webhook/*',
      send: '/send',
      session: '/session/*',
    },
  });
});

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
async function shutdown(signal: string) {
  log.info(`Received ${signal}, shutting down gracefully...`);

  // Stop Telegram bot
  const telegram = getTelegramService();
  telegram.stop();

  // Close Redis
  await closeRedis();

  log.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function start() {
  try {
    // Connect to Redis
    const redis = getRedis();
    await redis.ping();
    log.info('Redis connected');

    // Start Telegram bot (long polling mode)
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const telegram = getTelegramService();
      await telegram.start();
    }

    // Start HTTP server
    app.listen(PORT, () => {
      log.info(`Messenger service started on port ${PORT}`, {
        env: process.env.NODE_ENV,
        port: PORT,
      });
    });
  } catch (error) {
    log.error('Failed to start server', error);
    process.exit(1);
  }
}

start();

export default app;
