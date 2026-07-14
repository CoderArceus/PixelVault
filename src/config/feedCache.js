const NodeCache = require('node-cache');

/**
 * In-memory feed cache with per-user keying.
 *
 * Design decisions (documented here and in README):
 *
 *  1. Cache key is `feed:{userId}` — the feed is unpaginated (no query params),
 *     so the user's ID is the only dimension that differentiates responses.
 *
 *  2. TTL is 30 seconds — short enough that even without explicit invalidation,
 *     staleness is bounded. Signed URLs (15-min expiry) remain valid for the
 *     entire cache lifetime.
 *
 *  3. Staleness tradeoff (explicit, not accidental):
 *     - The ACTING user's view is always immediately correct: publish, delete,
 *       and unlock all flush the acting user's cache entry synchronously before
 *       the response is sent.
 *     - OTHER users may see stale data for up to 30 s (e.g. a newly published
 *       post not appearing, or a deleted post still showing). This is acceptable
 *       eventual consistency for a feed listing and avoids the thundering-herd
 *       problem of flushing every user's cache on every write.
 *
 *  4. Invalidation triggers:
 *     - Post published  → flush ALL entries (new content affects every user's feed)
 *     - Post deleted    → flush ALL entries (removed content affects every user's feed)
 *     - Post unlocked   → flush ONLY the unlocking user's entry (only their
 *       locked/unlocked flag changes; other users' views are still correct for them)
 */

// 30-second TTL, check for expired keys every 60 s
const feedCache = new NodeCache({ stdTTL: 30, checkperiod: 60 });

/**
 * Build the cache key for a user's feed.
 * @param {string} userId
 * @returns {string}
 */
function feedKey(userId) {
  return `feed:${userId}`;
}

/**
 * Get a cached feed response for a user, or null if not cached / expired.
 */
function get(userId) {
  return feedCache.get(feedKey(userId)) || null;
}

/**
 * Store a feed response for a user.
 */
function set(userId, data) {
  feedCache.set(feedKey(userId), data);
}

/**
 * Invalidate a single user's cached feed (e.g. after they unlock a post).
 */
function invalidateUser(userId) {
  feedCache.del(feedKey(userId));
}

/**
 * Invalidate ALL cached feeds (e.g. after a post is published or deleted,
 * which changes every user's feed).
 */
function invalidateAll() {
  feedCache.flushAll();
}

module.exports = { get, set, invalidateUser, invalidateAll };
