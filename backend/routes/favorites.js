const express = require('express');
const {
    addFavorite,
    removeFavorite,
    getFavorites,
    checkFavorite
} = require('../controllers/favoriteController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware); // Todas requieren autenticación

router.get('/', getFavorites);
router.post('/:productId', addFavorite);
router.delete('/:productId', removeFavorite);
router.get('/check/:productId', checkFavorite);

module.exports = router;
