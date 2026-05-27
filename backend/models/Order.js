const pool = require('../config/database');

const Order = {
    async create({ user_id, seller_id, total, notes, items }) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const orderRes = await client.query(
                'INSERT INTO orders (user_id, seller_id, total, notes) VALUES ($1, $2, $3, $4) RETURNING *',
                [user_id || null, seller_id, total, notes || null]
            );
            const order = orderRes.rows[0];
            for (const item of items) {
                await client.query(
                    'INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)',
                    [order.id, item.product_id, item.product_name, item.quantity, item.unit_price]
                );
                await client.query(
                    'UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2 AND stock >= $1',
                    [item.quantity, item.product_id]
                );
            }
            await client.query('COMMIT');
            return order;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    },

    async findAll({ seller_id } = {}) {
        let query = `SELECT o.*, u.name as customer_name, u.email as customer_email, s.name as seller_name,
                     json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id,
                     'product_name', oi.product_name, 'quantity', oi.quantity, 'unit_price', oi.unit_price)) as items
                     FROM orders o
                     LEFT JOIN users u ON o.user_id = u.id
                     LEFT JOIN users s ON o.seller_id = s.id
                     LEFT JOIN order_items oi ON o.id = oi.order_id`;
        const params = [];
        if (seller_id) {
            query += ' WHERE o.seller_id = $1';
            params.push(seller_id);
        }
        query += ' GROUP BY o.id, u.name, u.email, s.name ORDER BY o.created_at DESC';
        const res = await pool.query(query, params);
        return res.rows;
    },

    async findById(id) {
        const res = await pool.query(
            `SELECT o.*, u.name as customer_name, u.email as customer_email, s.name as seller_name,
             json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id,
             'product_name', oi.product_name, 'quantity', oi.quantity, 'unit_price', oi.unit_price)) as items
             FROM orders o
             LEFT JOIN users u ON o.user_id = u.id
             LEFT JOIN users s ON o.seller_id = s.id
             LEFT JOIN order_items oi ON o.id = oi.order_id
             WHERE o.id = $1
             GROUP BY o.id, u.name, u.email, s.name`,
            [id]
        );
        return res.rows[0];
    },

    async updateStatus(id, status) {
        const res = await pool.query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, id]
        );
        return res.rows[0];
    }
};

module.exports = Order;
