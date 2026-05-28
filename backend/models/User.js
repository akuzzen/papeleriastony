const pool = require('../config/database');
const bcrypt = require('bcrypt');

class User {
    // Crear usuario (para registro normal y admin)
    static async create({ name, email, password, role = 'user', security_question = null, security_answer = null }) {
        const hashedPassword = await bcrypt.hash(password, 10);
        let hashedAnswer = null;
        if (security_answer) {
            hashedAnswer = await bcrypt.hash(security_answer.toLowerCase(), 10);
        }
        const query = `INSERT INTO users (name, email, password, role, security_question, security_answer) 
                       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, security_question, created_at`;
        const values = [name, email, hashedPassword, role, security_question, hashedAnswer];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    // Buscar por email (incluyendo seguridad)
    static async findByEmail(email) {
        const query = `SELECT id, name, email, password, role, security_question, security_answer, created_at FROM users WHERE email = $1`;
        const result = await pool.query(query, [email]);
        return result.rows[0];
    }

    // Verificar contraseña
    static async comparePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    // Obtener usuario por ID
    static async findById(id) {
        const query = `SELECT id, name, email, role, avatar_url, security_question, created_at FROM users WHERE id = $1`;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }
}

module.exports = User;
