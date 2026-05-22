const pool = require('../config/database');
const crypto = require('crypto');

class PasswordReset {
    static async create(userId) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // expira en 1 hora
        
        const query = `
            INSERT INTO password_resets (user_id, token, expires_at) 
            VALUES ($1, $2, $3) 
            RETURNING *
        `;
        const result = await pool.query(query, [userId, token, expiresAt]);
        return result.rows[0];
    }

    static async findByToken(token) {
        const query = `
            SELECT * FROM password_resets 
            WHERE token = $1 AND expires_at > NOW()
        `;
        const result = await pool.query(query, [token]);
        return result.rows[0];
    }

    static async deleteByUserId(userId) {
        const query = `DELETE FROM password_resets WHERE user_id = $1`;
        await pool.query(query, [userId]);
    }
}

module.exports = PasswordReset;