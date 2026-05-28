const Order = require('../models/Order');
const User = require('../models/User');
const transporter = require('../config/mailer');

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
            notes: notes || (customer_name ? 'Cliente: ' + customer_name + (customer_email ? ' - ' + customer_email : '') : null),
            items
        });

        // Enviar comprobante por correo si se proporcionó email del cliente
        if (customer_email) {
            try {
                const seller = await User.findById(req.userId);
                const fecha = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
                const itemsHtml = items.map(i =>
                    `<tr>
                        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${i.product_name}</td>
                        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td>
                        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$${parseFloat(i.unit_price).toFixed(2)}</td>
                        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">$${(i.unit_price * i.quantity).toFixed(2)}</td>
                    </tr>`
                ).join('');

                await transporter.sendMail({
                    from: `"Papelerías Tony" <${process.env.EMAIL_USER}>`,
                    to: customer_email,
                    subject: `🧾 Comprobante de compra #${order.id} — Papelerías Tony`,
                    html: `
                    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #ddd;border-radius:12px;overflow:hidden;">
                        <div style="background:#2f2c79;padding:24px 28px;">
                            <h2 style="color:#fff;margin:0;font-size:22px;">Papelerías Tony</h2>
                            <p style="color:#ccc;margin:4px 0 0;font-size:14px;">Comprobante de compra</p>
                        </div>
                        <div style="padding:24px 28px;">
                            <p style="font-size:15px;">Hola, <strong>${customer_name || 'estimado cliente'}</strong>.</p>
                            <p style="font-size:14px;color:#555;">Tu compra fue registrada exitosamente el <strong>${fecha}</strong>. Aquí están los detalles:</p>

                            <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
                                <thead>
                                    <tr style="background:#f5f5f5;">
                                        <th style="padding:8px 12px;text-align:left;">Producto</th>
                                        <th style="padding:8px 12px;text-align:center;">Cant.</th>
                                        <th style="padding:8px 12px;text-align:right;">Precio</th>
                                        <th style="padding:8px 12px;text-align:right;">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>${itemsHtml}</tbody>
                            </table>

                            <div style="text-align:right;margin-top:16px;font-size:18px;font-weight:bold;color:#2f2c79;">
                                Total: $${parseFloat(total).toFixed(2)}
                            </div>

                            <hr style="margin:20px 0;border:none;border-top:1px solid #eee;">
                            <p style="font-size:12px;color:#888;">
                                Pedido #${order.id} &nbsp;|&nbsp; Atendido por: ${seller ? seller.name : 'Vendedor'}
                                ${notes ? `<br>Notas: ${notes}` : ''}
                            </p>
                            <p style="font-size:12px;color:#aaa;margin-top:8px;">Papelerías Tony — Gracias por tu compra.</p>
                        </div>
                    </div>`
                });
            } catch (mailErr) {
                console.error('Error enviando comprobante:', mailErr.message);
                // No interrumpir la respuesta si el correo falla
            }
        }

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
