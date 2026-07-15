const request = require('supertest');
const path = require('path');
const sharp = require('sharp');
const app = require('../src/app');
const { setup, cleanDatabase, teardown } = require('./setup');

// Create a minimal valid PNG buffer for testing uploads
// 1x1 pixel red PNG
const TEST_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Generate an oversized test image (4000×3000 red JPEG, ~large file).
 * Used to verify that the server-side optimization caps dimensions at 2048px.
 */
async function createOversizedTestImage() {
  return sharp({
    create: {
      width: 4000,
      height: 3000,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg({ quality: 95 })
    .toBuffer();
}

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

describe('POST /posts — server-side image optimization', () => {
  it('should cap oversized originals at 2048px longest side and reduce file size', async () => {
    // Generate a deliberately oversized image (4000×3000, ~large JPEG)
    const oversizedBuffer = await createOversizedTestImage();
    const inputSize = oversizedBuffer.length;
    const inputMeta = await sharp(oversizedBuffer).metadata();

    // Sanity: confirm the input is actually oversized
    expect(inputMeta.width).toBe(4000);
    expect(inputMeta.height).toBe(3000);

    // Upload via API
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('price', '10')
      .attach('image', oversizedBuffer, 'oversized.jpg');

    expect(res.status).toBe(201);

    // Fetch the stored original via its signed URL
    const originalUrl = res.body.post.original_url;
    expect(originalUrl).toBeDefined();

    const fetchRes = await fetch(originalUrl);
    expect(fetchRes.status).toBe(200);

    const storedBuffer = Buffer.from(await fetchRes.arrayBuffer());
    const storedMeta = await sharp(storedBuffer).metadata();

    // Assert dimensions are within the 2048px cap
    expect(storedMeta.width).toBeLessThanOrEqual(2048);
    expect(storedMeta.height).toBeLessThanOrEqual(2048);

    // Assert the longest side is exactly 2048 (since input was 4000×3000, width is the longest)
    expect(storedMeta.width).toBe(2048);

    // Aspect ratio preserved: 4000:3000 = 4:3, so 2048 × 1536
    expect(storedMeta.height).toBe(1536);

    // Assert file size reduction actually happened
    const storedSize = storedBuffer.length;
    expect(storedSize).toBeLessThan(inputSize);

    // Log the reduction for manual review
    console.log(
      `[Image Optimization] Input: ${inputMeta.width}×${inputMeta.height} (${(inputSize / 1024).toFixed(0)} KB)` +
      ` → Stored: ${storedMeta.width}×${storedMeta.height} (${(storedSize / 1024).toFixed(0)} KB)` +
      ` — ${((1 - storedSize / inputSize) * 100).toFixed(1)}% reduction`
    );
  });
});
