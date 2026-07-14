import apiClient from './client';

/**
 * GET /posts — Feed of all active posts with per-user lock status.
 * Each post: { id, owner_id, price, status, created_at, is_owner, is_unlocked, preview_url, original_url? }
 * @returns {{ posts: Array }}
 */
export async function getPosts() {
  const { data } = await apiClient.get('/posts');
  return data;
}

/**
 * GET /posts/:id — Detail view.
 * Returns original_url only if owner or unlocked.
 * @param {string} id - Post UUID
 * @returns {{ post: Object }}
 */
export async function getPost(id) {
  const { data } = await apiClient.get(`/posts/${id}`);
  return data;
}

/**
 * POST /posts — Upload image with price.
 * Sends as multipart/form-data for the image file.
 * @param {string} imageUri - Local file URI from image picker
 * @param {number} price - Positive integer (coins)
 * @returns {{ post: Object }}
 */
export async function createPost(imageUri, price) {
  const formData = new FormData();

  // Extract filename and infer MIME type from URI
  const filename = imageUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  formData.append('image', {
    uri: imageUri,
    name: filename,
    type,
  });
  formData.append('price', String(price));

  const { data } = await apiClient.post('/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * DELETE /posts/:id — Soft delete (owner only).
 * @param {string} id - Post UUID
 * @returns {{ post: { id, status, deleted_at } }}
 */
export async function deletePost(id) {
  const { data } = await apiClient.delete(`/posts/${id}`);
  return data;
}

/**
 * POST /posts/:id/unlock — Atomic unlock.
 * On success (201): { message, unlock, transaction, original_url }
 * On already unlocked (200): { message: 'Already unlocked', unlock, original_url }
 * On insufficient balance (402): { error, required, current_balance }
 * @param {string} id - Post UUID
 * @returns {Object}
 */
export async function unlockPost(id) {
  const { data } = await apiClient.post(`/posts/${id}/unlock`);
  return data;
}
