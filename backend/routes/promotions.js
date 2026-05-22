const express = require('express');
const {
    getActivePromotions,
    getAllPromotions,
    createPromotion,
    updatePromotion,
    deletePromotion
} = require('../controllers/promotionController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Públicas
router.get('/active', getActivePromotions);

// Administrador
router.get('/', authMiddleware, adminMiddleware, getAllPromotions);
router.post('/', authMiddleware, adminMiddleware, createPromotion);
router.put('/:id', authMiddleware, adminMiddleware, updatePromotion);
router.delete('/:id', authMiddleware, adminMiddleware, deletePromotion);

module.exports = router; 
