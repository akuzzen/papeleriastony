const Order = require('../models/Order');

const createOrder = async (req, res) => {
    try {
        const { customer_name, customer_email, notes, items } = req.body;
        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'El pedido debe tener al menos un producto' });
        }
        const total = items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
        const order = await Order.create({
            user_id: null,
            seller_id: req.userId,
            total,
            notes: notes || (customer_name ? Cliente: ${customer_name}${customer_email ? ' — ' + customer_email : ''} : null),
            items
        });
        res.status(201).json({ message: 'Pedido creado correctamente', order });
    } catch (error) {
        console.error(error);
        if (error.message?.includes('stock')) {
            return res.status(400).json({ message: 'Stock insuficiente para uno o más productos' });
        }
        res.status(500).json({ message: 'Error al crear pedido' });
    }
};

const getOrders = async (req, res) => {
    try {
        const seller_id = req.user.role === 'admin' ? null : req.userId;
        const orders = await Order.findAll({ seller_id });
        res.json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener pedidos' });
    }
};

const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });
        if (req.user.role !== 'admin' && order.seller_id !== req.userId) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }
        res.json(order);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener pedido' });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pendiente', 'completado', 'cancelado'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Estado inválido' });
        }
        const order = await Order.updateStatus(req.params.id, status);
        if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });
        res.json({ message: 'Estado actualizado', order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar estado' });
    }
};

module.exports = { createOrder, getOrders, getOrderById, updateOrderStatus };
