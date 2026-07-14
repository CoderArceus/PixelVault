import apiClient from './client';

/**
 * GET /users/me — Profile + coin balance.
 * @returns {{ user: { id, email, coin_balance, created_at } }}
 */
export async function getProfile() {
  const { data } = await apiClient.get('/users/me');
  return data;
}

/**
 * GET /users/me/transactions — Transaction history.
 * Each tx: { id, user_id, unlock_id, amount, balance_after, created_at, post_id, post_price }
 * @returns {{ transactions: Array }}
 */
export async function getTransactions() {
  const { data } = await apiClient.get('/users/me/transactions');
  return data;
}

/**
 * GET /users/me/inventory — All unlocked posts including deleted.
 * Each item: { unlock_id, price_paid, unlocked_at, post: { id, owner_id, price, status, created_at, preview_url, original_url } }
 * @returns {{ inventory: Array }}
 */
export async function getInventory() {
  const { data } = await apiClient.get('/users/me/inventory');
  return data;
}
