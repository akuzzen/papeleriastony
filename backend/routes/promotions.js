const express = require('express');
const {
    getActivePromotions,
    getActivePromotionsForSeller,
    getAllPromotions,
    createPromotion,
    updatePromotion,
    applyPromotion,
    deletePromotion
} = require('../controllers/promotionController');
const { authMiddleware, adminMiddleware, sellerMiddleware } = require('../middleware/auth');

const router = express.Router();

// Públicas / usuario autenticado
router.get('/active', authMiddleware, getActivePromotions);
// Para vendedor al completar pedido
router.get('/active-seller', authMiddleware, getActivePromotionsForSeller);
// Aplicar promoción a un pedido
router.post('/apply', authMiddleware, applyPromotion);

// Administrador
router.get('/', authMiddleware, adminMiddleware, getAllPromotions);
router.post('/', authMiddleware, adminMiddleware, createPromotion);
router.put('/:id', authMiddleware, adminMiddleware, updatePromotion);
router.delete('/:id', authMiddleware, adminMiddleware, deletePromotion);

module.exports = router;
