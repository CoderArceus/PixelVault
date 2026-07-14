const request = require('supertest');
const app = require('../src/app');
const { setup, cleanDatabase, teardown } = require('./setup');

const TEST_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64'
);

let ownerToken;
let buyerToken;
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

  // Register buyer
  await request(app)
    .post('/auth/register')
    .send({ email: 'buyer@example.com', password: 'password123' });

  const buyerLogin = await request(app)
    .post('/auth/login')
    .send({ email: 'buyer@example.com', password: 'password123' });
  buyerToken = buyerLogin.body.accessToken;

  // Owner creates a post
  const createRes = await request(app)
    .post('/posts')
    .set('Authorization', `Bearer ${ownerToken}`)
    .field('price', '20')
    .attach('image', TEST_IMAGE, 'test.png');
  postId = createRes.body.post.id;
});

describe('GET /users/me/inventory', () => {
  it('should include unlocked posts in inventory', async () => {
    // Unlock the post
    await request(app)
      .post(`/posts/${postId}/unlock`)
      .set('Authorization', `Bearer ${buyerToken}`);

    const res = await request(app)
      .get('/users/me/inventory')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.inventory).toBeDefined();
    expect(res.body.inventory.length).toBe(1);
    expect(res.body.inventory[0].post.id).toBe(postId);
    expect(res.body.inventory[0].post.original_url).toBeDefined();
  });

  it('should retain unlocked posts in inventory after owner deletes the post', async () => {
    // Buyer unlocks the post
    await request(app)
      .post(`/posts/${postId}/unlock`)
      .set('Authorization', `Bearer ${buyerToken}`);

    // Owner soft-deletes the post
    await request(app)
      .delete(`/posts/${postId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // Deleted post should vanish from the public feed
    const feedRes = await request(app)
      .get('/posts')
      .set('Authorization', `Bearer ${buyerToken}`);
    const feedPostIds = feedRes.body.posts.map((p) => p.id);
    expect(feedPostIds).not.toContain(postId);

    // But the buyer's inventory should still include it
    const inventoryRes = await request(app)
      .get('/users/me/inventory')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(inventoryRes.body.inventory.length).toBe(1);
    expect(inventoryRes.body.inventory[0].post.id).toBe(postId);
    expect(inventoryRes.body.inventory[0].post.status).toBe('deleted');
    expect(inventoryRes.body.inventory[0].post.original_url).toBeDefined();
  });

  it('should return empty inventory for a user with no unlocks', async () => {
    const res = await request(app)
      .get('/users/me/inventory')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.inventory).toEqual([]);
  });
});

describe('GET /users/me/transactions', () => {
  it('should return transaction history after unlocking', async () => {
    // Unlock the post
    await request(app)
      .post(`/posts/${postId}/unlock`)
      .set('Authorization', `Bearer ${buyerToken}`);

    const res = await request(app)
      .get('/users/me/transactions')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.transactions.length).toBe(1);
    expect(res.body.transactions[0].amount).toBe(-20);
    expect(res.body.transactions[0].balance_after).toBe(80);
  });
});
