const request = require('supertest');
const path = require('path');
const app = require('../src/app');
const { setup, cleanDatabase, teardown } = require('./setup');

// Create a minimal valid PNG buffer for testing uploads
// 1x1 pixel red PNG
const TEST_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64'
);

let accessToken;

beforeAll(async () => {
  await setup();
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await cleanDatabase();

  // Register and login a test user
  await request(app)
    .post('/auth/register')
    .send({ email: 'uploader@example.com', password: 'password123' });

  const loginRes = await request(app)
    .post('/auth/login')
    .send({ email: 'uploader@example.com', password: 'password123' });

  accessToken = loginRes.body.accessToken;
});

describe('POST /posts', () => {
  it('should create a post with image upload', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('price', '25')
      .attach('image', TEST_IMAGE, 'test.png');

    expect(res.status).toBe(201);
    expect(res.body.post).toBeDefined();
    expect(res.body.post.price).toBe(25);
    expect(res.body.post.status).toBe('active');
    expect(res.body.post.preview_url).toBeDefined();
    expect(res.body.post.original_url).toBeDefined(); // Owner sees original
  });

  it('should reject upload without image', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('price', '25');

    expect(res.status).toBe(400);
  });

  it('should reject upload with invalid price', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('price', '0')
      .attach('image', TEST_IMAGE, 'test.png');

    expect(res.status).toBe(400);
  });

  it('should reject unauthenticated upload', async () => {
    const res = await request(app)
      .post('/posts')
      .field('price', '25')
      .attach('image', TEST_IMAGE, 'test.png');

    expect(res.status).toBe(401);
  });
});

describe('GET /posts', () => {
  it('should return active posts in the feed', async () => {
    // Upload a post first
    await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('price', '25')
      .attach('image', TEST_IMAGE, 'test.png');

    const res = await request(app)
      .get('/posts')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.posts).toBeDefined();
    expect(res.body.posts.length).toBe(1);
    expect(res.body.posts[0].is_owner).toBe(true);
  });
});

describe('GET /posts/:id', () => {
  it('should return post detail with original URL for owner', async () => {
    const createRes = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('price', '25')
      .attach('image', TEST_IMAGE, 'test.png');

    const postId = createRes.body.post.id;

    const res = await request(app)
      .get(`/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.post.is_owner).toBe(true);
    expect(res.body.post.original_url).toBeDefined();
  });
});

describe('DELETE /posts/:id', () => {
  it('should soft-delete a post (owner only)', async () => {
    const createRes = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('price', '25')
      .attach('image', TEST_IMAGE, 'test.png');

    const postId = createRes.body.post.id;

    const res = await request(app)
      .delete(`/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.post.status).toBe('deleted');
    expect(res.body.post.deleted_at).toBeDefined();
  });

  it('should reject delete by non-owner', async () => {
    const createRes = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('price', '25')
      .attach('image', TEST_IMAGE, 'test.png');

    const postId = createRes.body.post.id;

    // Register a second user
    await request(app)
      .post('/auth/register')
      .send({ email: 'other@example.com', password: 'password123' });

    const otherLogin = await request(app)
      .post('/auth/login')
      .send({ email: 'other@example.com', password: 'password123' });

    const res = await request(app)
      .delete(`/posts/${postId}`)
      .set('Authorization', `Bearer ${otherLogin.body.accessToken}`);

    expect(res.status).toBe(403);
  });
});
