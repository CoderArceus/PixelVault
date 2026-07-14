import apiClient from './client';

/**
 * POST /auth/register
 * @param {string} email
 * @param {string} password
 * @returns {{ user: { id, email, coin_balance, created_at } }}
 */
export async function register(email, password) {
  const { data } = await apiClient.post('/auth/register', { email, password });
  return data;
}

/**
 * POST /auth/login
 * @param {string} email
 * @param {string} password
 * @returns {{ accessToken, refreshToken, user: { id, email, coin_balance } }}
 */
export async function login(email, password) {
  const { data } = await apiClient.post('/auth/login', { email, password });
  return data;
}

/**
 * POST /auth/refresh
 * @param {string} refreshToken
 * @returns {{ accessToken }}
 */
export async function refresh(refreshToken) {
  const { data } = await apiClient.post('/auth/refresh', { refreshToken });
  return data;
}
