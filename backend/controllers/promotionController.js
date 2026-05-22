const Promotion = require('../models/Promotion');

// Obtener promociones activas (público)
const getActivePromotions = async (req, res) => {
    try {
        const promotions = await Promotion.findActive();
        res.json(promotions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener promociones' });
    }
};

// Obtener todas las promociones (admin)
const getAllPromotions = async (req, res) => {
    try {
        const promotions = await Promotion.findAll();
        res.json(promotions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener promociones' });
    }
};

// Crear promoción (admin)
const createPromotion = async (req, res) => {
    try {
        const { title, description, discount_percent, valid_from, valid_to, is_active } = req.body;
        const promotion = await Promotion.create({ title, description, discount_percent, valid_from, valid_to, is_active });
        res.status(201).json(promotion);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al crear promoción' });
    }
};

// Actualizar promoción (admin)
const updatePromotion = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, discount_percent, valid_from, valid_to, is_active } = req.body;
        const promotion = await Promotion.update(id, { title, description, discount_percent, valid_from, valid_to, is_active });
        if (!promotion) {
            return res.status(404).json({ message: 'Promoción no encontrada' });
        }
        res.json(promotion);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar promoción' });
    }
};

// Eliminar promoción (admin)
const deletePromotion = async (req, res) => {
    try {
        const { id } = req.params;
        const promotion = await Promotion.delete(id);
        if (!promotion) {
            return res.status(404).json({ message: 'Promoción no encontrada' });
        }
        res.json({ message: 'Promoción eliminada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al eliminar promoción' });
    }
};

module.exports = {
    getActivePromotions,
    getAllPromotions,
    createPromotion,
    updatePromotion,
    deletePromotion
};