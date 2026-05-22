 const pool = require('../config/database');

class Favorite {
    // Agregar a favoritos
    static async add(userId, productId) {
        const query = `INSERT INTO favorites (user_id, product_id) 
                       VALUES ($1, $2) ON CONFLICT (user_id, product_id) DO NOTHING RETURNING *`;
        const result = await pool.query(query, [userId, productId]);
        return result.rows[0];
    }

    // Eliminar de favoritos
    static async remove(userId, productId) {
        const query = `DELETE FROM favorites WHERE user_id = $1 AND product_id = $2 RETURNING *`;
        const result = await pool.query(query, [userId, productId]);
        return result.rows[0];
    }

    // Obtener favoritos de un usuario
    static async findByUser(userId) {
        const query = `SELECT p.* FROM products p 
                       INNER JOIN favorites f ON p.id = f.product_id 
                       WHERE f.user_id = $1 ORDER BY f.created_at DESC`;
        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    // Verificar si ya es favorito
    static async isFavorite(userId, productId) {
        const query = `SELECT * FROM favorites WHERE user_id = $1 AND product_id = $2`;
        const result = await pool.query(query, [userId, productId]);
        return result.rows.length > 0;
    }
}

module.exports = Favorite;
