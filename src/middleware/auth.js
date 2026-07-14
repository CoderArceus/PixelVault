const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Generate an access token (short-lived, e.g. 15 min).
 * @param {Object} payload - { id, email }
 * @returns {string}
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY });
}

/**
 * Generate a refresh token (longer-lived, e.g. 7 days).
 * @param {Object} payload - { id, email }
 * @returns {string}
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRY });
}

/**
 * Middleware: Verify access token from Authorization header.
 * Attaches req.user = { id, email } on success.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired' });
    }
    return res.status(401).json({ error: 'Invalid access token' });
  }
}

/**
 * Middleware: Verify refresh token from request body.
 * Attaches req.user = { id, email } on success.
 */
function authenticateRefresh(req, res, next) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  authenticate,
  authenticateRefresh,
};
