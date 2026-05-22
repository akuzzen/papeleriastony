const express = require('express');
const {
    getAllProducts,
    getProductsByCategory,
    getProductById,
    createProduct,
    updateProduct,
    updateStock,
    deleteProduct,
    searchProducts,
    getLowStockProducts
} = require('../controllers/productController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// ── Rutas específicas PRIMERO (antes de /:id para que Express no las confunda) ──
router.get('/search',    searchProducts);
router.get('/low-stock', authMiddleware, adminMiddleware, getLowStockProducts);
router.get('/category/:category', getProductsByCategory);

// ── Rutas con parámetro dinámico ──
router.get('/:id', getProductById);

// ── Rutas públicas base ──
router.get('/', getAllProducts);

// ── Rutas protegidas solo admin ──
router.post('/',           authMiddleware, adminMiddleware, upload.single('image'), createProduct);
router.put('/:id',         authMiddleware, adminMiddleware, upload.single('image'), updateProduct);
router.patch('/:id/stock', authMiddleware, adminMiddleware, updateStock);
router.delete('/:id',      authMiddleware, adminMiddleware, deleteProduct);

module.exports = router;
