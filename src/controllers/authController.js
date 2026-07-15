const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const { generateAccessToken, generateRefreshToken } = require('../middleware/auth');

const BCRYPT_ROUNDS = 12;

/**
 * POST /auth/register
 * Create user, initialize wallet at 100 coins.
 */
async function register(req, res, next) {
  try {
    const password = req.body.password;

    if (!req.body.email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const email = req.body.email.trim().toLowerCase();

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existing = await userModel.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await userModel.create(email, passwordHash);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        coin_balance: user.coin_balance,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/login
 * Verify credentials, issue access + refresh tokens.
 */
async function login(req, res, next) {
  try {
    const password = req.body.password;

    if (!req.body.email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const email = req.body.email.trim().toLowerCase();

    const user = await userModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokenPayload = { id: user.id, email: user.email };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        coin_balance: user.coin_balance,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/refresh
 * Rotate access token using a valid refresh token.
 * The authenticateRefresh middleware has already verified the token
 * and attached req.user.
 */
async function refresh(req, res, next) {
  try {
    const tokenPayload = { id: req.user.id, email: req.user.email };
    const accessToken = generateAccessToken(tokenPayload);

    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh };
