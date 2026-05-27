const express = require('express');
const { createOrder, getOrders, getOrderById, updateOrderStatus } = require('../controllers/orderController');
const { authMiddleware, sellerMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, sellerMiddleware, createOrder);
router.get('/', authMiddleware, sellerMiddleware, getOrders);
router.get('/:id', authMiddleware, sellerMiddleware, getOrderById);
router.put('/:id/status', authMiddleware, sellerMiddleware, updateOrderStatus);

module.exports = router;
