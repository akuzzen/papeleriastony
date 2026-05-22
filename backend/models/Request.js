const pool = require('../config/database');

class Request {
    // Crear solicitud
    static async create({ product_name, user_email }) {
        const query = `INSERT INTO product_requests (product_name, user_email) 
                       VALUES ($1, $2) RETURNING *`;
        const result = await pool.query(query, [product_name, user_email]);
        return result.rows[0];
    }

    // Obtener todas las solicitudes (admin)
    static async findAll() {
        const query = `SELECT * FROM product_requests ORDER BY created_at DESC`;
        const result = await pool.query(query);
        return result.rows;
    }

    // Marcar como notificada
    static async markNotified(id) {
        const query = `UPDATE product_requests SET status = 'notified', notified_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    // Obtener por email de usuario
    static async findByEmail(email) {
        const query = `SELECT * FROM product_requests WHERE user_email = $1 ORDER BY created_at DESC`;
        const result = await pool.query(query, [email]);
        return result.rows;
    }
}

module.exports = Request; 
