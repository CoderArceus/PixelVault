const userModel = require('../models/userModel');
const transactionModel = require('../models/transactionModel');
const unlockModel = require('../models/unlockModel');
const { getSignedDownloadUrl } = require('../config/s3');

/**
 * GET /users/me
 * Returns user profile + coin balance.
 */
async function getProfile(req, res, next) {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /users/me/transactions
 * Returns transaction history for the authenticated user.
 */
async function getTransactions(req, res, next) {
  try {
    const transactions = await transactionModel.findAllByUser(req.user.id);
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /users/me/inventory
 * Returns all posts the user has unlocked, including deleted posts.
 * Per TRD §5: no status filter — joins through unlocks so deleted posts
 * still resolve and return valid signed URLs to the original.
 */
async function getInventory(req, res, next) {
  try {
    const items = await unlockModel.findAllByUser(req.user.id);

    // Generate signed URLs for each item — originals are accessible
    // because the user has a valid unlock record
    const inventory = await Promise.all(
      items.map(async (item) => ({
        unlock_id: item.unlock_id,
        price_paid: item.price_paid,
        unlocked_at: item.unlocked_at,
        post: {
          id: item.post_id,
          owner_id: item.owner_id,
          price: item.price,
          status: item.status,
          created_at: item.post_created_at,
          preview_url: await getSignedDownloadUrl(item.storage_key_preview, req.hostname),
          original_url: await getSignedDownloadUrl(item.storage_key_original, req.hostname),
        },
      }))
    );

    res.json({ inventory });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, getTransactions, getInventory };
