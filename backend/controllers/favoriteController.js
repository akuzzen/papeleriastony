const Favorite = require('../models/Favorite');

// Agregar a favoritos
const addFavorite = async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.userId;
        const favorite = await Favorite.add(userId, productId);
        if (!favorite) {
            return res.status(400).json({ message: 'El producto ya está en favoritos' });
        }
        res.status(201).json({ message: 'Producto agregado a favoritos', favorite });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al agregar favorito' });
    }
};

// Eliminar de favoritos
const removeFavorite = async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.userId;
        const favorite = await Favorite.remove(userId, productId);
        if (!favorite) {
            return res.status(404).json({ message: 'El producto no estaba en favoritos' });
        }
        res.json({ message: 'Producto eliminado de favoritos' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al eliminar favorito' });
    }
};

// Obtener favoritos del usuario
const getFavorites = async (req, res) => {
    try {
        const userId = req.userId;
        const favorites = await Favorite.findByUser(userId);
        res.json(favorites);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener favoritos' });
    }
};

// Verificar si es favorito
const checkFavorite = async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.userId;
        const isFav = await Favorite.isFavorite(userId, productId);
        res.json({ isFavorite: isFav });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al verificar favorito' });
    }
};

module.exports = {
    addFavorite,
    removeFavorite,
    getFavorites,
    checkFavorite
};