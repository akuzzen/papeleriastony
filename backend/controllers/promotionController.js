const Promotion = require('../models/Promotion');

// Obtener promociones activas (usuario - filtra por sus usos)
const getActivePromotions = async (req, res) => {
    try {
        const userId = req.userId || null;  // puede ser null si no está autenticado
        const promotions = await Promotion.findActive(userId);
        res.json(promotions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener promociones' });
    }
};

// Obtener promociones activas para vendedor (al completar pedido)
const getActivePromotionsForSeller = async (req, res) => {
    try {
        const promotions = await Promotion.findActiveForSeller();
        res.json(promotions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener promociones' });
    }
};

// Obtener todas (admin)
const getAllPromotions = async (req, res) => {
    try {
        const promotions = await Promotion.findAll();
        res.json(promotions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener promociones' });
    }
};

// Crear promoción
const createPromotion = async (req, res) => {
    try {
        const { title, description, discount_percent, valid_from, valid_to,
                is_active, category, usage_type, usage_limit } = req.body;
        const promotion = await Promotion.create({
            title, description, discount_percent, valid_from, valid_to,
            is_active, category, usage_type, usage_limit
        });
        res.status(201).json(promotion);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al crear promoción' });
    }
};

// Actualizar promoción
const updatePromotion = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, discount_percent, valid_from, valid_to,
                is_active, category, usage_type, usage_limit } = req.body;
        const promotion = await Promotion.update(id, {
            title, description, discount_percent, valid_from, valid_to,
            is_active, category, usage_type, usage_limit
        });
        if (!promotion) return res.status(404).json({ message: 'Promoción no encontrada' });
        res.json(promotion);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar promoción' });
    }
};

// Registrar uso de promoción (llamado al confirmar/completar pedido)
const applyPromotion = async (req, res) => {
    try {
        const { promotion_id, order_id } = req.body;
        const userId = req.userId;

        const check = await Promotion.canUserUse(promotion_id, userId);
        if (!check.allowed) {
            return res.status(400).json({ message: check.reason });
        }

        await Promotion.registerUse(promotion_id, userId, order_id);
        res.json({ message: 'Promoción aplicada', promo: check.promo });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al aplicar promoción' });
    }
};

// Eliminar promoción
const deletePromotion = async (req, res) => {
    try {
        const { id } = req.params;
        const promotion = await Promotion.delete(id);
        if (!promotion) return res.status(404).json({ message: 'Promoción no encontrada' });
        res.json({ message: 'Promoción eliminada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al eliminar promoción' });
    }
};

module.exports = {
    getActivePromotions,
    getActivePromotionsForSeller,
    getAllPromotions,
    createPromotion,
    updatePromotion,
    applyPromotion,
    deletePromotion
};
