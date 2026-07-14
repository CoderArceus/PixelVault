const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/**
 * Rate limiter for /auth/login — brute-force protection.
 * Per TRD §6: apply to login endpoint.
 */
const loginLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_LOGIN_WINDOW_MS,
  max: env.RATE_LIMIT_LOGIN_MAX,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for /posts/:id/unlock — abuse/spam protection.
 * Per TRD §6: apply to unlock endpoint.
 */
const unlockLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_UNLOCK_WINDOW_MS,
  max: env.RATE_LIMIT_UNLOCK_MAX,
  message: { error: 'Too many unlock attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, unlockLimiter };
