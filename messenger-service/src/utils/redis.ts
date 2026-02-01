import Redis from 'ioredis';
import { log } from './logger.js';

let redis: Redis | null = null;
let subscriber: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on('connect', () => {
      log.info('Redis connected');
    });

    redis.on('error', (err) => {
      log.error('Redis connection error', err);
    });
  }
  return redis;
}

export function getSubscriber(): Redis {
  if (!subscriber) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    subscriber = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    subscriber.on('connect', () => {
      log.info('Redis subscriber connected');
    });

    subscriber.on('error', (err) => {
      log.error('Redis subscriber error', err);
    });
  }
  return subscriber;
}

// Channels for PubSub
export const REDIS_CHANNELS = {
  MESSAGE_RECEIVED: 'messenger:message:received',
  MESSAGE_SENT: 'messenger:message:sent',
  MESSAGE_STATUS: 'messenger:message:status',
  SESSION_STATUS: 'messenger:session:status',
  SEND_MESSAGE: 'messenger:send',
} as const;

// Publish event to Redis
export async function publishEvent(channel: string, data: unknown): Promise<void> {
  try {
    const client = getRedis();
    await client.publish(channel, JSON.stringify(data));
    log.debug('Published event to Redis', { channel });
  } catch (error) {
    log.error('Failed to publish event', error, { channel });
    throw error;
  }
}

// Cleanup
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
  log.info('Redis connections closed');
}
