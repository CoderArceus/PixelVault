const request = require('supertest');
const app = require('../src/app');
const { setup, cleanDatabase, teardown } = require('./setup');

beforeAll(async () => {
  await setup();
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await cleanDatabase();
});

describe('POST /auth/register', () => {
  it('should register a new user with 100-coin balance', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.coin_balance).toBe(100);
    expect(res.body.user.id).toBeDefined();
  });

  it('should reject duplicate email', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'password456' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
  });

  it('should reject missing fields', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'login@example.com', password: 'password123' });
  });

  it('should return access and refresh tokens on valid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('login@example.com');
  });

  it('should reject invalid password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('should reject non-existent email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('should return a new access token with a valid refresh token', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'refresh@example.com', password: 'password123' });

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'refresh@example.com', password: 'password123' });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });
});

describe('GET /users/me', () => {
  it('should return user profile when authenticated', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'profile@example.com', password: 'password123' });

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'profile@example.com', password: 'password123' });

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('profile@example.com');
    expect(res.body.user.coin_balance).toBe(100);
  });

  it('should reject unauthenticated requests', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });
});
