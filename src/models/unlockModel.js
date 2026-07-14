const { query } = require('../config/db');

/**
 * Create an unlock record within a transaction.
 * The UNIQUE(user_id, post_id) constraint prevents duplicates at DB level.
 * @param {string} userId - UUID
 * @param {string} postId - UUID
 * @param {number} pricePaid - Snapshot of price at unlock time
 * @param {import('pg').PoolClient} client - Transaction client
 * @returns {Promise<Object>} Created unlock
 */
async function create(userId, postId, pricePaid, client) {
  const { rows } = await client.query(
    `INSERT INTO unlocks (user_id, post_id, price_paid)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, postId, pricePaid]
  );
  return rows[0];
}

/**
 * Check if a user has already unlocked a specific post.
 * @param {string} userId - UUID
 * @param {string} postId - UUID
 * @returns {Promise<Object|null>}
 */
async function findByUserAndPost(userId, postId) {
  const { rows } = await query(
    'SELECT * FROM unlocks WHERE user_id = $1 AND post_id = $2',
    [userId, postId]
  );
  return rows[0] || null;
}

/**
 * Get all posts a user has unlocked (inventory).
 * Per TRD §5: NO status filter — deleted posts still resolve here.
 * @param {string} userId - UUID
 * @returns {Promise<Array>}
 */
async function findAllByUser(userId) {
  const { rows } = await query(
    `SELECT
       u.id AS unlock_id,
       u.price_paid,
       u.created_at AS unlocked_at,
       p.id AS post_id,
       p.owner_id,
       p.price,
       p.storage_key_original,
       p.storage_key_preview,
       p.status,
       p.created_at AS post_created_at
     FROM unlocks u
     JOIN posts p ON p.id = u.post_id
     WHERE u.user_id = $1
     ORDER BY u.created_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Count unlocks for a specific post.
 * @param {string} postId - UUID
 * @returns {Promise<number>}
 */
async function countByPost(postId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM unlocks WHERE post_id = $1',
    [postId]
  );
  return rows[0].count;
}

module.exports = { create, findByUserAndPost, findAllByUser, countByPost };
