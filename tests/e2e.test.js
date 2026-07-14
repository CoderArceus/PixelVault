const request = require('supertest');
const app = require('../src/app');
const { setup, cleanDatabase, teardown } = require('./setup');
const { query } = require('../src/config/db');

// 1x1 pixel red PNG
const TEST_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64'
);

beforeAll(async () => {
  await setup();
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await cleanDatabase();
});

describe('E2E Requirements', () => {
  let userA, userB, userC, userD;

  const registerUser = async (email) => {
    await request(app).post('/auth/register').send({ email, password: 'password123' });
    const loginRes = await request(app).post('/auth/login').send({ email, password: 'password123' });
    return { email, id: loginRes.body.user.id, token: loginRes.body.accessToken, balance: loginRes.body.user.coin_balance };
  };

  beforeEach(async () => {
    userA = await registerUser('usera@e2e.com');
    userB = await registerUser('userb@e2e.com');
    userC = await registerUser('userc@e2e.com');
    userD = await registerUser('userd@e2e.com');
  });

  describe('1. Core end-to-end flow', () => {
    it('verifies the primary upload-unlock-inventory lifecycle', async () => {
      // Assert wallet balance === 100
      expect(userA.balance).toBe(100);
      expect(userB.balance).toBe(100);

      // User A: POST /posts
      const postRes = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${userA.token}`)
        .field('price', '25')
        .attach('image', TEST_IMAGE, 'test.png');
      expect(postRes.status).toBe(201);
      expect(postRes.body.post.status).toBe('active');
      const postId = postRes.body.post.id;

      // User B: GET /posts
      const feedRes = await request(app).get('/posts').set('Authorization', `Bearer ${userB.token}`);
      expect(feedRes.status).toBe(200);
      const feedPost = feedRes.body.posts.find(p => p.id === postId);
      expect(feedPost.is_unlocked).toBe(false);
      expect(feedPost.original_url).toBeUndefined();
      expect(JSON.stringify(feedRes.body)).not.toContain('originals/'); // no leak

      // User B: GET /posts/:id
      const detailRes = await request(app).get(`/posts/${postId}`).set('Authorization', `Bearer ${userB.token}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.post.is_unlocked).toBe(false);
      expect(detailRes.body.post.original_url).toBeUndefined();

      // User B: POST /posts/:id/unlock
      const unlockRes = await request(app).post(`/posts/${postId}/unlock`).set('Authorization', `Bearer ${userB.token}`);
      expect(unlockRes.status).toBe(201);
      expect(unlockRes.body.original_url).toContain('originals/');
      
      // Verify user B balance decreased by 25
      const loginB = await request(app).post('/auth/login').send({ email: 'userb@e2e.com', password: 'password123' });
      expect(loginB.body.user.coin_balance).toBe(75);

      // User B: GET /posts/:id again
      const detailRes2 = await request(app).get(`/posts/${postId}`).set('Authorization', `Bearer ${userB.token}`);
      expect(detailRes2.body.post.is_unlocked).toBe(true);
      expect(detailRes2.body.post.original_url).toContain('originals/');

      // User B: GET /users/me/transactions
      const txRes = await request(app).get('/users/me/transactions').set('Authorization', `Bearer ${userB.token}`);
      expect(txRes.status).toBe(200);
      expect(txRes.body.transactions.length).toBe(1);
      expect(txRes.body.transactions[0].amount).toBe(-25);
      expect(txRes.body.transactions[0].balance_after).toBe(75);

      // User A: GET /posts/:id (as owner)
      const ownerRes = await request(app).get(`/posts/${postId}`).set('Authorization', `Bearer ${userA.token}`);
      expect(ownerRes.body.post.original_url).toContain('originals/');
    });
  });

  describe('2. Duplicate/idempotency tests', () => {
    it('handles concurrent identical unlock requests gracefully', async () => {
      const postRes = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${userA.token}`)
        .field('price', '25')
        .attach('image', TEST_IMAGE, 'test.png');
      const postId = postRes.body.post.id;

      // Fire 2 unlocks concurrently
      const [r1, r2] = await Promise.all([
        request(app).post(`/posts/${postId}/unlock`).set('Authorization', `Bearer ${userB.token}`),
        request(app).post(`/posts/${postId}/unlock`).set('Authorization', `Bearer ${userB.token}`)
      ]);

      // Both should succeed or one succeed one fail, but balance must decrease EXACTLY ONCE
      const loginB = await request(app).post('/auth/login').send({ email: 'userb@e2e.com', password: 'password123' });
      expect(loginB.body.user.coin_balance).toBe(75); // Only one charge!
    });
  });

  describe('3. Insufficient balance', () => {
    it('prevents unlock when coin_balance < price', async () => {
      const postRes = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${userA.token}`)
        .field('price', '250') // Expensive!
        .attach('image', TEST_IMAGE, 'test.png');
      const postId = postRes.body.post.id;

      const unlockRes = await request(app).post(`/posts/${postId}/unlock`).set('Authorization', `Bearer ${userC.token}`);
      expect(unlockRes.status).toBe(402); // Payment Required

      const loginC = await request(app).post('/auth/login').send({ email: 'userc@e2e.com', password: 'password123' });
      expect(loginC.body.user.coin_balance).toBe(100); // Unchanged
    });
  });

  describe('4. Access control / security', () => {
    it('enforces rigorous 401s, 403s, and original URL redaction', async () => {
      const postRes = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${userA.token}`)
        .field('price', '25')
        .attach('image', TEST_IMAGE, 'test.png');
      const postId = postRes.body.post.id;
      
      // Unauthenticated GET
      const getUnauth = await request(app).get(`/posts/${postId}`);
      expect(getUnauth.status).toBe(401);

      // Unauthenticated POST unlock
      const unlockUnauth = await request(app).post(`/posts/${postId}/unlock`);
      expect(unlockUnauth.status).toBe(401);

      // User D tries GET, grep response text for leak
      const getD = await request(app).get(`/posts/${postId}`).set('Authorization', `Bearer ${userD.token}`);
      const bodyStr = JSON.stringify(getD.body);
      expect(bodyStr).not.toContain('originals/');
      expect(bodyStr).not.toContain('original_url');

      // Modifying signed URL (mocking this by altering the preview URL in fetch)
      const previewUrl = getD.body.post.preview_url;
      const hackedUrl = previewUrl.replace('previews', 'originals');
      const fetchRes = await fetch(hackedUrl);
      expect(fetchRes.status).toBe(403); // Signature Does Not Match!

      // User D tries to DELETE
      const deleteRes = await request(app).delete(`/posts/${postId}`).set('Authorization', `Bearer ${userD.token}`);
      expect(deleteRes.status).toBe(403);
    });
  });

  describe('5. Soft delete + inventory persistence', () => {
    it('maintains inventory access after soft delete but removes from feed', async () => {
      const postRes = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${userA.token}`)
        .field('price', '25')
        .attach('image', TEST_IMAGE, 'test.png');
      const postId = postRes.body.post.id;

      await request(app).post(`/posts/${postId}/unlock`).set('Authorization', `Bearer ${userB.token}`);

      const delRes = await request(app).delete(`/posts/${postId}`).set('Authorization', `Bearer ${userA.token}`);
      expect(delRes.status).toBe(200);

      // Feed check
      const feedRes = await request(app).get('/posts').set('Authorization', `Bearer ${userB.token}`);
      expect(feedRes.body.posts.find(p => p.id === postId)).toBeUndefined();

      // Inventory check
      const invRes = await request(app).get('/users/me/inventory').set('Authorization', `Bearer ${userB.token}`);
      const invPost = invRes.body.inventory.find(i => i.post.id === postId);
      expect(invPost).toBeDefined();
      expect(invPost.post.original_url).toContain('originals/');

      // Direct ID check
      const directRes = await request(app).get(`/posts/${postId}`).set('Authorization', `Bearer ${userB.token}`);
      expect(directRes.status).toBe(200);
      expect(directRes.body.post.original_url).toContain('originals/');
    });
  });

  describe('6. Signed URL expiry', () => {
    it('generates URLs with an expiry parameter and verifies fetch failure after expiry', async () => {
      // Temporarily override the expiry to 1 second
      const env = require('../src/config/env');
      const originalExpiry = env.SIGNED_URL_EXPIRY;
      env.SIGNED_URL_EXPIRY = 1; // 1 second

      const postRes = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${userA.token}`)
        .field('price', '25')
        .attach('image', TEST_IMAGE, 'test.png');
      const postId = postRes.body.post.id;

      const unlockRes = await request(app).post(`/posts/${postId}/unlock`).set('Authorization', `Bearer ${userB.token}`);
      const originalUrl = unlockRes.body.original_url;

      expect(originalUrl).toContain('X-Amz-Expires=1');

      // Wait 1.5 seconds for the URL to actually expire
      await new Promise(r => setTimeout(r, 1500));

      const fetchRes = await fetch(originalUrl);
      expect(fetchRes.status).toBe(403);
      const text = await fetchRes.text();
      expect(text).toContain('AccessDenied'); // Minio returns AccessDenied when expired

      // Restore original expiry
      env.SIGNED_URL_EXPIRY = originalExpiry;
    });
  });

  describe('7. Rate limiting', () => {
    it('blocks rapid login requests', async () => {
      // By default the app rate limit is 10 for login
      // Let's blast 12 requests
      let lastStatus = 200;
      for (let i = 0; i < 60; i++) {
        const res = await request(app).post('/auth/login').send({ email: 'usera@e2e.com', password: 'wrongpassword' });
        if (res.status === 429) {
          lastStatus = 429;
          break;
        }
      }
      expect(lastStatus).toBe(429);
    }, 15000);
  });
});
