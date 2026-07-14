const postModel = require('../models/postModel');
const unlockModel = require('../models/unlockModel');
const userModel = require('../models/userModel');
const transactionModel = require('../models/transactionModel');
const { getClient } = require('../config/db');
const { getSignedDownloadUrl } = require('../config/s3');
const auditModel = require('../models/auditModel');
const feedCache = require('../config/feedCache');

/**
 * POST /posts/:id/unlock
 * Atomic operation: check balance → deduct → create unlock + transaction → return original URL.
 * Per TRD §6:
 *  - Idempotent: if already unlocked, returns existing unlock (no double charge)
 *  - UNIQUE(user_id, post_id) constraint prevents duplicates at DB level
 *  - Atomic: all DB changes happen in a single transaction
 */
async function unlockPost(req, res, next) {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    // 1. Check post exists and is active
    const post = await postModel.findById(postId);
    if (!post || post.status !== 'active') {
      await auditModel.logAttempt(userId, postId, 'not_found');
      return res.status(404).json({ error: 'Post not found' });
    }

    // Owners don't need to unlock their own content
    if (post.owner_id === userId) {
      return res.status(400).json({ error: 'You cannot unlock your own post' });
    }

    // 2. Check if already unlocked — idempotent return
    const existingUnlock = await unlockModel.findByUserAndPost(userId, postId);
    if (existingUnlock) {
      await auditModel.logAttempt(userId, postId, 'already_unlocked');
      const originalUrl = await getSignedDownloadUrl(post.storage_key_original, req.hostname);
      return res.json({
        message: 'Already unlocked',
        unlock: existingUnlock,
        original_url: originalUrl,
      });
    }

    // 3. Check balance
    const user = await userModel.findById(userId);
    if (user.coin_balance < post.price) {
      await auditModel.logAttempt(userId, postId, 'insufficient_balance');
      return res.status(402).json({
        error: 'Insufficient balance',
        required: post.price,
        current_balance: user.coin_balance,
      });
    }

    // 4. Atomic transaction: deduct balance, create unlock, create transaction
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Re-check balance within the transaction to prevent race conditions
      const { rows: [freshUser] } = await client.query(
        'SELECT coin_balance FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (freshUser.coin_balance < post.price) {
        await client.query('ROLLBACK');
        await auditModel.logAttempt(userId, postId, 'insufficient_balance');
        return res.status(402).json({
          error: 'Insufficient balance',
          required: post.price,
          current_balance: freshUser.coin_balance,
        });
      }

      const newBalance = freshUser.coin_balance - post.price;

      // Deduct coins
      await userModel.updateBalance(userId, newBalance, client);

      // Create unlock record
      const unlock = await unlockModel.create(userId, postId, post.price, client);

      // Create transaction record (negative amount for spend)
      const transaction = await transactionModel.create(
        userId,
        unlock.id,
        -post.price,
        newBalance,
        client
      );

      // Log success inside the atomic transaction
      await auditModel.logAttempt(userId, postId, 'success', client);

      await client.query('COMMIT');

      // Unlock changes this user's locked/unlocked view — flush their cache only
      feedCache.invalidateUser(userId);

      // 5. Return signed URL to the original
      const originalUrl = await getSignedDownloadUrl(post.storage_key_original, req.hostname);

      res.status(201).json({
        message: 'Post unlocked successfully',
        unlock: {
          id: unlock.id,
          post_id: unlock.post_id,
          price_paid: unlock.price_paid,
          created_at: unlock.created_at,
        },
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          balance_after: transaction.balance_after,
        },
        original_url: originalUrl,
      });
    } catch (err) {
      await client.query('ROLLBACK');

      // Handle the UNIQUE constraint violation gracefully (race condition safety net)
      if (err.code === '23505' && err.constraint === 'unlocks_user_id_post_id_key') {
        await auditModel.logAttempt(userId, postId, 'already_unlocked');
        const existingUnlock = await unlockModel.findByUserAndPost(userId, postId);
        const originalUrl = await getSignedDownloadUrl(post.storage_key_original, req.hostname);
        return res.json({
          message: 'Already unlocked',
          unlock: existingUnlock,
          original_url: originalUrl,
        });
      }

      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { unlockPost };
