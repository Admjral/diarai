import rateLimit from 'express-rate-limit';

// General rate limit
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Webhook rate limit (higher for incoming messages)
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 500,
  message: { error: 'Too many webhook requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Send message rate limit
export const sendLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 1 message per second average
  message: { error: 'Message rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});
