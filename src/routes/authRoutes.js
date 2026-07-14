const { Router } = require('express');
const authController = require('../controllers/authController');
const { authenticateRefresh } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');

const router = Router();

// POST /auth/register — create user, initialize wallet at 100 coins
router.post('/register', authController.register);

// POST /auth/login — returns access + refresh token (rate limited)
router.post('/login', loginLimiter, authController.login);

// POST /auth/refresh — rotate access token using refresh token
router.post('/refresh', authenticateRefresh, authController.refresh);

module.exports = router;
