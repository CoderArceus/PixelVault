const { query } = require('../config/db');

/**
 * Create a new user with default 100-coin balance.
 * @param {string} email
 * @param {string} passwordHash - bcrypt hash
 * @returns {Promise<Object>} Created user (id, email, coin_balance, created_at)
 */
async function create(email, passwordHash) {
  const { rows } = await query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, coin_balance, created_at`,
    [email, passwordHash]
  );
  return rows[0];
}

/**
 * Find user by email (for login).
 * Includes password_hash for verification.
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function findByEmail(email) {
  const { rows } = await query(
    `SELECT id, email, password_hash, coin_balance, created_at
     FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

/**
 * Find user by ID (for profile/balance).
 * Does NOT return password_hash.
 * @param {string} id - UUID
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const { rows } = await query(
    `SELECT id, email, coin_balance, created_at
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Update user's coin balance within a transaction.
 * @param {string} id - UUID
 * @param {number} newBalance
 * @param {import('pg').PoolClient} client - Transaction client
 * @returns {Promise<Object>}
 */
async function updateBalance(id, newBalance, client) {
  const { rows } = await client.query(
    `UPDATE users SET coin_balance = $1 WHERE id = $2
     RETURNING id, email, coin_balance`,
    [newBalance, id]
  );
  return rows[0];
}

module.exports = { create, findByEmail, findById, updateBalance };
