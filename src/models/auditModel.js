const { query } = require('../config/db');

/**
 * Log an unlock attempt to the audit log.
 * 
 * @param {string} userId - UUID of the user attempting to unlock
 * @param {string} postId - UUID of the post
 * @param {string} status - One of: 'success', 'insufficient_balance', 'already_unlocked', 'not_found'
 * @param {object} [client] - Optional DB client for participating in an existing transaction
 */
async function logAttempt(userId, postId, status, client) {
  const sql = `
    INSERT INTO unlock_attempts_log (user_id, post_id, status)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  const params = [userId, postId, status];

  if (client) {
    const res = await client.query(sql, params);
    return res.rows[0];
  } else {
    const res = await query(sql, params);
    return res.rows[0];
  }
}

module.exports = { logAttempt };
