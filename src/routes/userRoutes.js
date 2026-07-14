const { Router } = require('express');
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

const router = Router();

// All user routes require authentication
router.use(authenticate);

// GET /users/me — profile + coin balance
router.get('/me', userController.getProfile);

// GET /users/me/transactions — transaction history
router.get('/me/transactions', userController.getTransactions);

// GET /users/me/inventory — all unlocked posts, including deleted ones
router.get('/me/inventory', userController.getInventory);

module.exports = router;
