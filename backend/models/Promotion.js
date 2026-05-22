const pool = require('../config/database');

class Promotion {
    // Obtener todas las promociones activas
    static async findActive() {
        const query = `SELECT * FROM promotions 
                       WHERE is_active = true 
                       AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
                       AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
                       ORDER BY created_at DESC`;
        const result = await pool.query(query);
        return result.rows;
    }

    // Obtener todas (para admin)
    static async findAll() {
        const query = `SELECT * FROM promotions ORDER BY created_at DESC`;
        const result = await pool.query(query);
        return result.rows;
    }

    // Crear promoción
    static async create({ title, description, discount_percent, valid_from, valid_to, is_active = true }) {
        const query = `INSERT INTO promotions (title, description, discount_percent, valid_from, valid_to, is_active) 
                       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
        const values = [title, description, discount_percent, valid_from, valid_to, is_active];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    // Actualizar promoción
    static async update(id, { title, description, discount_percent, valid_from, valid_to, is_active }) {
        const query = `UPDATE promotions 
                       SET title = $1, description = $2, discount_percent = $3, valid_from = $4, valid_to = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP 
                       WHERE id = $7 RETURNING *`;
        const values = [title, description, discount_percent, valid_from, valid_to, is_active, id];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    // Eliminar promoción
    static async delete(id) {
        const query = `DELETE FROM promotions WHERE id = $1 RETURNING *`;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }
}

module.exports = Promotion;