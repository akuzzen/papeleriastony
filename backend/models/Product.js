const pool = require('../config/database');

class Product {
    // Obtener todos los productos
    static async findAll() {
        const query = `SELECT id, name, price, category, stock, image_icon, image_url, created_at, updated_at FROM products ORDER BY id`;
        const result = await pool.query(query);
        return result.rows;
    }

    // Obtener por categoría
    static async findByCategory(category) {
        const query = `SELECT id, name, price, category, stock, image_icon, image_url FROM products WHERE category = $1 ORDER BY id`;
        const result = await pool.query(query, [category]);
        return result.rows;
    }

    // Obtener un producto por ID
    static async findById(id) {
        const query = `SELECT id, name, price, category, stock, image_icon, image_url FROM products WHERE id = $1`;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    // Crear producto
    static async create({ name, price, category, stock, image_icon }) {
        const query = `INSERT INTO products (name, price, category, stock, image_icon) 
                       VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const values = [name, price, category, stock, image_icon];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    // Actualizar producto
    static async update(id, { name, price, category, stock, image_icon }) {
        const query = `UPDATE products 
                       SET name = $1, price = $2, category = $3, stock = $4, image_icon = $5, updated_at = CURRENT_TIMESTAMP 
                       WHERE id = $6 RETURNING *`;
        const values = [name, price, category, stock, image_icon, id];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    // Actualizar stock
    static async updateStock(id, stock) {
        const query = `UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`;
        const result = await pool.query(query, [stock, id]);
        return result.rows[0];
    }

    // Eliminar producto
    static async delete(id) {
        const query = `DELETE FROM products WHERE id = $1 RETURNING *`;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }
}

module.exports = Product; 
