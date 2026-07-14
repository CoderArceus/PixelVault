const request = require('supertest');
const app = require('../src/app');
const { setup, cleanDatabase, teardown } = require('./setup');
const { query } = require('../src/config/db');

const TEST_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64'
);

let ownerToken;
let ownerId;
let buyerToken;
let buyerId;
let postId;

beforeAll(async () => {
  await setup();
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await cleanDatabase();

  // Register owner
  await request(app)
    .post('/auth/register')
    .send({ email: 'owner@example.com', password: 'password123' });

  const ownerLogin = await request(app)
    .post('/auth/login')
    .send({ email: 'owner@example.com', password: 'password123' });
  ownerToken = ownerLogin.body.accessToken;
  ownerId = ownerLogin.body.user.id;

  // Register buyer
  await request(app)
    .post('/auth/register')
    .send({ email: 'buyer@example.com', password: 'password123' });

  const buyerLogin = await request(app)
    .post('/auth/login')
    .send({ email: 'buyer@example.com', password: 'password123' });
  buyerToken = buyerLogin.body.accessToken;
  buyerId = buyerLogin.body.user.id;

  // Owner creates a post priced at 25 coins
  const createRes = await request(app)
    .post('/posts')
    .set('Authorization', `Bearer ${ownerToken}`)
    .field('price', '25')
    .attach('image', TEST_IMAGE, 'test.png');
  postId = createRes.body.post.id;
});

describe('POST /posts/:id/unlock', () => {
  it('should unlock a post successfully and deduct coins', async () => {
    const res = await request(app)
      .post(`/posts/${postId}/unlock`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Post unlocked successfully');
    expect(res.body.unlock).toBeDefined();
    expect(res.body.unlock.price_paid).toBe(25);
    expect(res.body.original_url).toBeDefined();
    expect(res.body.transaction.amount).toBe(-25);
    expect(res.body.transaction.balance_after).toBe(75); // 100 - 25

    // Assert audit log
    const logs = await query('SELECT * FROM unlock_attempts_log WHERE user_id = $1 AND post_id = $2', [buyerId, postId]);
    expect(logs.rows.length).toBe(1);
    expect(logs.rows[0].status).toBe('success');
  });

  it('should return 402 on insufficient balance', async () => {
    // Create an expensive post (more than 100 coins)
    const expensiveRes = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('price', '200')
      .attach('image', TEST_IMAGE, 'expensive.png');

    const expensiveId = expensiveRes.body.post.id;

    const res = await request(app)
      .post(`/posts/${expensiveId}/unlock`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(402);
    expect(res.body.error).toBe('Insufficient balance');
    expect(res.body.required).toBe(200);
    expect(res.body.current_balance).toBe(100);

    // Assert audit log
    const logs = await query('SELECT * FROM unlock_attempts_log WHERE user_id = $1 AND post_id = $2', [buyerId, expensiveId]);
    expect(logs.rows.length).toBe(1);
    expect(logs.rows[0].status).toBe('insufficient_balance');
  });

  it('should handle duplicate unlock idempotently (no double charge)', async () => {
    // First unlock
    await request(app)
      .post(`/posts/${postId}/unlock`)
      .set('Authorization', `Bearer ${buyerToken}`);

    // Second unlock — should be idempotent
    const res = await request(app)
      .post(`/posts/${postId}/unlock`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Already unlocked');
    expect(res.body.original_url).toBeDefined();

    // Verify balance was only deducted once
    const profileRes = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(profileRes.body.user.coin_balance).toBe(75); // 100 - 25, NOT 100 - 50

    // Assert audit log has EXACTLY one success and one already_unlocked
    const logs = await query('SELECT status FROM unlock_attempts_log WHERE user_id = $1 AND post_id = $2 ORDER BY created_at ASC', [buyerId, postId]);
    expect(logs.rows.length).toBe(2);
    expect(logs.rows[0].status).toBe('success');
    expect(logs.rows[1].status).toBe('already_unlocked');
  });

  it('should prevent owner from unlocking their own post', async () => {
    const res = await request(app)
      .post(`/posts/${postId}/unlock`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(400);
  });

  it('should log not_found for a nonexistent post', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .post(`/posts/${fakeId}/unlock`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(404);

    const logs = await query('SELECT * FROM unlock_attempts_log WHERE user_id = $1 AND post_id = $2', [buyerId, fakeId]);
    expect(logs.rows.length).toBe(1);
    expect(logs.rows[0].status).toBe('not_found');
  });

  it('should not leave a phantom success row if the transaction rolls back', async () => {
    const auditModel = require('../src/models/auditModel');
    const originalLogAttempt = auditModel.logAttempt;
    jest.spyOn(auditModel, 'logAttempt').mockImplementationOnce(async (userId, post_id, status, client) => {
      await originalLogAttempt(userId, post_id, status, client);
      if (status === 'success') {
        throw new Error('Crash immediately after logging success');
      }
    });

    const res = await request(app)
      .post(`/posts/${postId}/unlock`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(500);

    const logs = await query('SELECT * FROM unlock_attempts_log WHERE user_id = $1 AND post_id = $2', [buyerId, postId]);
    // The transaction rolled back, so the success log must have been rolled back too
    expect(logs.rows.length).toBe(0);

    auditModel.logAttempt.mockRestore();
  });
});

describe('Access control — locked content', () => {
  it('should NOT return original URL for a locked post (pre-unlock)', async () => {
    const res = await request(app)
      .get(`/posts/${postId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.post.preview_url).toBeDefined();
    expect(res.body.post.original_url).toBeUndefined(); // <-- The critical assertion
    expect(res.body.post.is_unlocked).toBe(false);
  });

  it('should return original URL AFTER unlocking', async () => {
    // Unlock first
    await request(app)
      .post(`/posts/${postId}/unlock`)
      .set('Authorization', `Bearer ${buyerToken}`);

    // Now view the post
    const res = await request(app)
      .get(`/posts/${postId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.post.original_url).toBeDefined(); // <-- Now it should be present
    expect(res.body.post.is_unlocked).toBe(true);
  });
});
