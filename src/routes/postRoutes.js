const { Router } = require('express');
const multer = require('multer');
const postController = require('../controllers/postController');
const unlockController = require('../controllers/unlockController');
const { authenticate } = require('../middleware/auth');
const { unlockLimiter } = require('../middleware/rateLimiter');

const router = Router();

// Multer: memory storage — file stays as Buffer for Sharp processing, no local disk temp files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max to accommodate uncompressed 4K camera photos before server optimization
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// All post routes require authentication
router.use(authenticate);

// POST /posts — upload image, set price, generates preview server-side
router.post('/', upload.single('image'), postController.createPost);

// GET /posts — feed: preview URL, price, locked/unlocked/owned flag per item
router.get('/', postController.getPosts);

// GET /posts/:id — detail view: preview always; original only if unlocked/owned
router.get('/:id', postController.getPostById);

// DELETE /posts/:id — soft delete, owner only
router.delete('/:id', postController.deletePost);

// POST /posts/:id/unlock — atomic: check balance → deduct → create unlock + transaction
// Rate limited per TRD §6
router.post('/:id/unlock', unlockLimiter, unlockController.unlockPost);

// NOTE: No PATCH /posts/:id — price and content are immutable by design

module.exports = router;
