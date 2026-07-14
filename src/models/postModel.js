const { query } = require('../config/db');

/**
 * Create a new post.
 * @param {string} ownerId - UUID
 * @param {number} price - Positive integer (coins)
 * @param {string} storageKeyOriginal - S3 key for original
 * @param {string} storageKeyPreview - S3 key for blurred preview
 * @returns {Promise<Object>} Created post
 */
async function create(ownerId, price, storageKeyOriginal, storageKeyPreview) {
  const { rows } = await query(
    `INSERT INTO posts (owner_id, price, storage_key_original, storage_key_preview)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [ownerId, price, storageKeyOriginal, storageKeyPreview]
  );
  return rows[0];
}

/**
 * Find a post by ID (any status — used for detail/unlock/delete).
 * @param {string} id - UUID
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const { rows } = await query('SELECT * FROM posts WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Get all active posts for the feed, annotated with per-user lock status.
 * Returns: post data + is_owner flag + is_unlocked flag for the requesting user.
 * @param {string} userId - Requesting user's UUID
 * @returns {Promise<Array>}
 */
async function findAllActive(userId) {
  const { rows } = await query(
    `SELECT
       p.*,
       (p.owner_id = $1) AS is_owner,
       (u.id IS NOT NULL) AS is_unlocked
     FROM posts p
     LEFT JOIN unlocks u ON u.post_id = p.id AND u.user_id = $1
     WHERE p.status = 'active'
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Soft-delete a post: set status to 'deleted' and record deleted_at.
 * Per TRD §5: never remove the row or S3 objects.
 * @param {string} id - UUID
 * @returns {Promise<Object>} Updated post
 */
async function softDelete(id) {
  const { rows } = await query(
    `UPDATE posts SET status = 'deleted', deleted_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return rows[0];
}

/**
 * Count how many unlocks exist for a post.
 * Used to determine if S3 cleanup is safe (future background job).
 * @param {string} postId - UUID
 * @returns {Promise<number>}
 */
async function countUnlocks(postId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM unlocks WHERE post_id = $1',
    [postId]
  );
  return rows[0].count;
}

module.exports = { create, findById, findAllActive, softDelete, countUnlocks };
