const { query } = require('../config/db');

/**
 * Create a transaction record within a DB transaction.
 * @param {string} userId - UUID
 * @param {string} unlockId - UUID
 * @param {number} amount - Negative for spend
 * @param {number} balanceAfter - Denormalized snapshot
 * @param {import('pg').PoolClient} client - Transaction client
 * @returns {Promise<Object>}
 */
async function create(userId, unlockId, amount, balanceAfter, client) {
  const { rows } = await client.query(
    `INSERT INTO transactions (user_id, unlock_id, amount, balance_after)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, unlockId, amount, balanceAfter]
  );
  return rows[0];
}

/**
 * Get transaction history for a user, ordered most recent first.
 * @param {string} userId - UUID
 * @returns {Promise<Array>}
 */
async function findAllByUser(userId) {
  const { rows } = await query(
    `SELECT t.*, p.id AS post_id, p.price AS post_price
     FROM transactions t
     JOIN unlocks u ON u.id = t.unlock_id
     JOIN posts p ON p.id = u.post_id
     WHERE t.user_id = $1
     ORDER BY t.created_at DESC`,
    [userId]
  );
  return rows;
}

module.exports = { create, findAllByUser };
