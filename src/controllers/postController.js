const { v4: uuidv4 } = require('uuid');
const path = require('path');
const postModel = require('../models/postModel');
const unlockModel = require('../models/unlockModel');
const { uploadToS3, getSignedDownloadUrl } = require('../config/s3');
const { generatePreview } = require('../utils/imageProcessor');

/**
 * POST /posts
 * Upload image, set price, generate blurred preview server-side.
 * File received via multer (memory storage) → Sharp → S3.
 */
async function createPost(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const { price } = req.body;
    const priceInt = parseInt(price, 10);

    if (!price || isNaN(priceInt) || priceInt <= 0) {
      return res.status(400).json({ error: 'Price must be a positive integer' });
    }

    const postId = uuidv4();
    const ext = path.extname(req.file.originalname) || '.jpg';

    // S3 keys: separate prefixes for original and preview
    const storageKeyOriginal = `originals/${postId}${ext}`;
    const storageKeyPreview = `previews/${postId}.jpg`; // Preview is always JPEG

    // Upload original to S3
    await uploadToS3(storageKeyOriginal, req.file.buffer, req.file.mimetype);

    // Generate blurred preview via Sharp and upload as distinct S3 object
    const previewBuffer = await generatePreview(req.file.buffer);
    await uploadToS3(storageKeyPreview, previewBuffer, 'image/jpeg');

    // Insert post record
    const post = await postModel.create(
      req.user.id,
      priceInt,
      storageKeyOriginal,
      storageKeyPreview
    );

    // Owner always sees their own content as unlocked — return original URL
    const originalUrl = await getSignedDownloadUrl(storageKeyOriginal, req.hostname);
    const previewUrl = await getSignedDownloadUrl(storageKeyPreview, req.hostname);

    res.status(201).json({
      post: {
        id: post.id,
        owner_id: post.owner_id,
        price: post.price,
        status: post.status,
        created_at: post.created_at,
        preview_url: previewUrl,
        original_url: originalUrl,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /posts
 * Feed — returns preview URL, price, and locked/unlocked/owned flag per item
 * relative to the requesting user. Only active posts.
 */
async function getPosts(req, res, next) {
  try {
    const posts = await postModel.findAllActive(req.user.id);

    const feed = await Promise.all(
      posts.map(async (post) => {
        const isOwner = post.is_owner;
        const isUnlocked = post.is_unlocked;
        const canSeeOriginal = isOwner || isUnlocked;

        const result = {
          id: post.id,
          owner_id: post.owner_id,
          price: post.price,
          status: post.status,
          created_at: post.created_at,
          is_owner: isOwner,
          is_unlocked: isUnlocked,
          preview_url: await getSignedDownloadUrl(post.storage_key_preview, req.hostname),
        };

        // Only include original URL if owner or unlocked
        if (canSeeOriginal) {
          result.original_url = await getSignedDownloadUrl(post.storage_key_original, req.hostname);
        }

        return result;
      })
    );

    res.json({ posts: feed });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /posts/:id
 * Detail view — preview URL always; original URL only if unlocked/owned.
 * Per TRD §6: every call checks ownership/unlock status server-side.
 */
async function getPostById(req, res, next) {
  try {
    const post = await postModel.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Even deleted posts can be viewed by ID if the user has an unlock (for inventory links),
    // but the feed won't show them. For non-owners of deleted posts without unlocks, return 404.
    const isOwner = post.owner_id === req.user.id;

    let isUnlocked = false;
    if (!isOwner) {
      const unlock = await unlockModel.findByUserAndPost(req.user.id, post.id);
      isUnlocked = !!unlock;

      // If post is deleted and user hasn't unlocked it, treat as not found
      if (post.status === 'deleted' && !isUnlocked) {
        return res.status(404).json({ error: 'Post not found' });
      }
    }

    const canSeeOriginal = isOwner || isUnlocked;

    const result = {
      id: post.id,
      owner_id: post.owner_id,
      price: post.price,
      status: post.status,
      created_at: post.created_at,
      is_owner: isOwner,
      is_unlocked: isUnlocked,
      preview_url: await getSignedDownloadUrl(post.storage_key_preview, req.hostname),
    };

    if (canSeeOriginal) {
      result.original_url = await getSignedDownloadUrl(post.storage_key_original, req.hostname);
    }

    res.json({ post: result });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /posts/:id
 * Soft delete — owner only. Sets status='deleted', deleted_at=NOW().
 * Per TRD §5: never removes the row or S3 objects.
 */
async function deletePost(req, res, next) {
  try {
    const post = await postModel.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Owner-only check per TRD §6
    if (post.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the owner can delete this post' });
    }

    if (post.status === 'deleted') {
      return res.status(400).json({ error: 'Post is already deleted' });
    }

    const deleted = await postModel.softDelete(post.id);

    res.json({
      post: {
        id: deleted.id,
        status: deleted.status,
        deleted_at: deleted.deleted_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createPost, getPosts, getPostById, deletePost };
