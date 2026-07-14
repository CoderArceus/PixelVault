const { pool, query } = require('../src/config/db');
const { ensureBucket } = require('../src/config/s3');

/**
 * Test setup: run migrations on test DB, create S3 bucket.
 * Requires TEST database (DATABASE_URL pointing to pixelvault_test).
 */
async function setup() {
  // Run migrations
  const { migrate } = require('../src/migrations/migrate');
  await migrate();

  // Ensure S3 bucket
  await ensureBucket();
}

/**
 * Clean all data from tables (preserve schema).
 * Call between test suites for isolation.
 */
async function cleanDatabase() {
  await query('DELETE FROM unlock_attempts_log');
  await query('DELETE FROM transactions');
  await query('DELETE FROM unlocks');
  await query('DELETE FROM posts');
  await query('DELETE FROM users');
}

/**
 * Tear down: close pool connection.
 */
async function teardown() {
  await pool.end();
}

module.exports = { setup, cleanDatabase, teardown };
