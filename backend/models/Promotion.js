const pool = require('../config/database');

class Promotion {

    // Obtener todas las promociones activas (para usuario)
    // Si se pasa userId, filtra las que ese usuario ya agotó sus usos
    static async findActive(userId = null) {
        const query = `
            SELECT p.*,
                   COALESCE(my_uses.count, 0) AS user_uses_count
            FROM promotions p
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS count
                FROM promotion_uses pu
                WHERE pu.promotion_id = p.id
                  AND pu.user_id = $1
            ) my_uses ON true
            WHERE p.is_active = true
              AND (p.valid_from IS NULL OR p.valid_from <= CURRENT_DATE)
              AND (p.valid_to   IS NULL OR p.valid_to   >= CURRENT_DATE)
              -- Filtrar si el usuario ya agotó sus usos (uso único o limitado por usuario)
              AND NOT (
                p.usage_type = 'unico'
                AND COALESCE(my_uses.count, 0) >= 1
              )
              -- Filtrar si la promo global ya llegó a su límite
              AND NOT (
                p.usage_type = 'limitado'
                AND p.usage_limit IS NOT NULL
                AND p.uses_count >= p.usage_limit
              )
            ORDER BY p.created_at DESC`;
        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    // Para el vendedor al completar pedido: solo activas, sin filtro de usuario
    static async findActiveForSeller() {
        const query = `
            SELECT * FROM promotions
            WHERE is_active = true
              AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
              AND (valid_to   IS NULL OR valid_to   >= CURRENT_DATE)
              AND NOT (
                usage_type = 'limitado'
                AND usage_limit IS NOT NULL
                AND uses_count >= usage_limit
              )
            ORDER BY created_at DESC`;
        const result = await pool.query(query);
        return result.rows;
    }

    // Obtener todas (admin)
    static async findAll() {
        const query = `SELECT * FROM promotions ORDER BY created_at DESC`;
        const result = await pool.query(query);
        return result.rows;
    }

    // Crear promoción
    static async create({ title, description, discount_percent, valid_from, valid_to,
                          is_active = true, category = 'Todas',
                          usage_type = 'indefinido', usage_limit = null }) {
        const query = `
            INSERT INTO promotions
                (title, description, discount_percent, valid_from, valid_to,
                 is_active, category, usage_type, usage_limit, uses_count)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0)
            RETURNING *`;
        const values = [title, description, discount_percent, valid_from || null,
                        valid_to || null, is_active, category, usage_type,
                        usage_limit || null];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    // Actualizar promoción
    static async update(id, { title, description, discount_percent, valid_from, valid_to,
                               is_active, category = 'Todas',
                               usage_type = 'indefinido', usage_limit = null }) {
        const query = `
            UPDATE promotions
            SET title=$1, description=$2, discount_percent=$3,
                valid_from=$4, valid_to=$5, is_active=$6,
                category=$7, usage_type=$8, usage_limit=$9,
                updated_at=CURRENT_TIMESTAMP
            WHERE id=$10 RETURNING *`;
        const values = [title, description, discount_percent, valid_from || null,
                        valid_to || null, is_active, category, usage_type,
                        usage_limit || null, id];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    // Registrar uso de una promoción al completar/confirmar pedido
    static async registerUse(promotionId, userId, orderId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Insertar uso individual
            await client.query(
                `INSERT INTO promotion_uses (promotion_id, user_id, order_id) VALUES ($1,$2,$3)`,
                [promotionId, userId || null, orderId || null]
            );
            // Incrementar contador global
            await client.query(
                `UPDATE promotions SET uses_count = uses_count + 1 WHERE id = $1`,
                [promotionId]
            );
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    // Verificar si un usuario puede usar una promoción
    static async canUserUse(promotionId, userId) {
        const promoRes = await pool.query(`SELECT * FROM promotions WHERE id=$1`, [promotionId]);
        if (!promoRes.rows.length) return { allowed: false, reason: 'Promoción no encontrada' };
        const p = promoRes.rows[0];

        if (!p.is_active) return { allowed: false, reason: 'Promoción inactiva' };

        // Límite global
        if (p.usage_type === 'limitado' && p.usage_limit !== null && p.uses_count >= p.usage_limit) {
            return { allowed: false, reason: 'Promoción agotada' };
        }

        // Uso por usuario
        if (userId && p.usage_type === 'unico') {
            const usesRes = await pool.query(
                `SELECT COUNT(*) FROM promotion_uses WHERE promotion_id=$1 AND user_id=$2`,
                [promotionId, userId]
            );
            if (parseInt(usesRes.rows[0].count) >= 1) {
                return { allowed: false, reason: 'Ya usaste esta promoción' };
            }
        }

        return { allowed: true, promo: p };
    }

    // Eliminar promoción
    static async delete(id) {
        const result = await pool.query(`DELETE FROM promotions WHERE id=$1 RETURNING *`, [id]);
        return result.rows[0];
    }
}

module.exports = Promotion;
