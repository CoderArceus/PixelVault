const request = require('supertest');
const app = require('../src/app');
const { setup, cleanDatabase, teardown } = require('./setup');
const feedCache = require('../src/config/feedCache');

const TEST_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64'
);

let ownerToken;
let buyerToken;

beforeAll(async () => {
  await setup();
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await cleanDatabase();
  feedCache.invalidateAll(); // Start each test with a cold cache

  // Register owner
  await request(app)
    .post('/auth/register')
    .send({ email: 'owner@cache.com', password: 'password123' });

  const ownerLogin = await request(app)
    .post('/auth/login')
    .send({ email: 'owner@cache.com', password: 'password123' });
  ownerToken = ownerLogin.body.accessToken;

  // Register buyer
  await request(app)
    .post('/auth/register')
    .send({ email: 'buyer@cache.com', password: 'password123' });

  const buyerLogin = await request(app)
    .post('/auth/login')
    .send({ email: 'buyer@cache.com', password: 'password123' });
  buyerToken = buyerLogin.body.accessToken;
});

describe('Feed cache — correctness', () => {
  it('should serve different locked/unlocked flags per user from cache', async () => {
    // Owner publishes a post
    const createRes = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('price', '10')
      .attach('image', TEST_IMAGE, 'test.png');

    const postId = createRes.body.post.id;

    // Buyer unlocks the post
    await request(app)
      .post(`/posts/${postId}/unlock`)
      .set('Authorization', `Bearer ${buyerToken}`);

    // Both users fetch the feed (populates cache for each)
    const ownerFeed = await request(app)
      .get('/posts')
      .set('Authorization', `Bearer ${ownerToken}`);

    const buyerFeed = await request(app)
      .get('/posts')
      .set('Authorization', `Bearer ${buyerToken}`);

    // Owner sees is_owner=true
    const ownerView = ownerFeed.body.posts.find(p => p.id === postId);
    expect(ownerView.is_owner).toBe(true);
    expect(ownerView.original_url).toBeDefined();

    // Buyer sees is_unlocked=true (not is_owner)
    const buyerView = buyerFeed.body.posts.find(p => p.id === postId);
    expect(buyerView.is_owner).toBe(false);
    expect(buyerView.is_unlocked).toBe(true);
    expect(buyerView.original_url).toBeDefined();

    // Second fetch for both should still return correct per-user state (from cache)
    const ownerFeed2 = await request(app)
      .get('/posts')
      .set('Authorization', `Bearer ${ownerToken}`);

    const buyerFeed2 = await request(app)
      .get('/posts')
      .set('Authorization', `Bearer ${buyerToken}`);

    const ownerView2 = ownerFeed2.body.posts.find(p => p.id === postId);
    expect(ownerView2.is_owner).toBe(true);

    const buyerView2 = buyerFeed2.body.posts.find(p => p.id === postId);
    expect(buyerView2.is_owner).toBe(false);
    expect(buyerView2.is_unlocked).toBe(true);
  });

  it('should immediately reflect unlock in the acting user feed (no stale locked state)', async () => {
    // Owner publishes
    await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('price', '10')
      .attach('image', TEST_IMAGE, 'test.png');

    // Buyer loads feed BEFORE unlocking — populate cache with locked view
    const feedBefore = await request(app)
      .get('/posts')
      .set('Authorization', `Bearer ${buyerToken}`);

    const post = feedBefore.body.posts[0];
    expect(post.is_unlocked).toBe(false);
    expect(post.original_url).toBeUndefined();

    // Buyer unlocks the post (this should invalidate their cache)
    await request(app)
      .post(`/posts/${post.id}/unlock`)
      .set('Authorization', `Bearer ${buyerToken}`);

    // Buyer loads feed AFTER unlocking — must be fresh, not stale cache
    const feedAfter = await request(app)
      .get('/posts')
      .set('Authorization', `Bearer ${buyerToken}`);

    const updatedPost = feedAfter.body.posts.find(p => p.id === post.id);
    expect(updatedPost.is_unlocked).toBe(true);
    expect(updatedPost.original_url).toBeDefined();
  });

  it('should immediately show a newly published post in the owner feed', async () => {
    // Owner fetches empty feed — populate cache
    const feedBefore = await request(app)
      .get('/posts')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(feedBefore.body.posts.length).toBe(0);

    // Owner publishes a post (this should flush all caches)
    await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('price', '10')
      .attach('image', TEST_IMAGE, 'test.png');

    // Owner fetches feed again — must see the new post, not stale empty cache
    const feedAfter = await request(app)
      .get('/posts')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(feedAfter.body.posts.length).toBe(1);
    expect(feedAfter.body.posts[0].is_owner).toBe(true);
  });

  it('should immediately remove a deleted post from feed', async () => {
    // Owner publishes
    const createRes = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('price', '10')
      .attach('image', TEST_IMAGE, 'test.png');

    const postId = createRes.body.post.id;

    // Owner fetches feed — populate cache
    const feedBefore = await request(app)
      .get('/posts')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(feedBefore.body.posts.length).toBe(1);

    // Owner deletes the post (this should flush all caches)
    await request(app)
      .delete(`/posts/${postId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // Owner fetches feed again — must be empty, not stale cache
    const feedAfter = await request(app)
      .get('/posts')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(feedAfter.body.posts.length).toBe(0);
  });
});
