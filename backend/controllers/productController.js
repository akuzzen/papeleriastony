const pool = require('../config/database');

// Obtener todos los productos
const getAllProducts = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener productos' });
    }
};

// Búsqueda por nombre (sin acentos con unaccent si está disponible, fallback ILIKE)
const searchProducts = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return getAllProducts(req, res);
        const result = await pool.query(
            'SELECT * FROM products WHERE LOWER(name) LIKE $1 ORDER BY id',
            [`%${q.toLowerCase()}%`]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en la búsqueda' });
    }
};

// Productos por categoría
const getProductsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const result = await pool.query(
            'SELECT * FROM products WHERE category = $1 ORDER BY id', [category]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener productos' });
    }
};

// Producto por ID
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        if (result.rows.length === 0)
            return res.status(404).json({ message: 'Producto no encontrado' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener producto' });
    }
};

// Productos con stock bajo (menor a 5) — debe ir ANTES de /:id en las rutas
const getLowStockProducts = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM products WHERE stock < 5 ORDER BY stock ASC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener productos con stock bajo' });
    }
};

const createProduct = async (req, res) => {
    try {
        const { name, price, category, stock, image_icon } = req.body;
        
        let image_url = null;
        if (req.file) {
            image_url = '/assets/images/' + req.file.filename;
            console.log('📸 Nueva imagen guardada:', image_url);
        }
        
        const query = `
            INSERT INTO products (name, price, category, stock, image_icon, image_url, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING *
        `;
        const values = [name, price, category, stock, image_icon, image_url];
        const result = await pool.query(query, values);
        
        console.log('✅ Producto creado:', result.rows[0].id);
        console.log('📷 URL guardada en BD:', result.rows[0].image_url);
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error en createProduct:', error);
        res.status(500).json({ message: 'Error al crear producto: ' + error.message });
    }
};

// Actualizar producto (admin)
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, category, stock, image_icon } = req.body;
        
        let image_url = null;
        
        // ✅ Si se subió una imagen, construir la URL
        if (req.file) {
            image_url = '/assets/images/' + req.file.filename;
            console.log('📸 Imagen recibida:', req.file.filename);
            console.log('📸 URL generada:', image_url);
        } else {
            console.log('⚠️ No se recibió imagen, manteniendo la actual');
            // Si no hay imagen nueva, mantener la existente
            const current = await pool.query('SELECT image_url FROM products WHERE id = $1', [id]);
            if (current.rows.length > 0) {
                image_url = current.rows[0].image_url;
            }
        }
        
        const query = `
            UPDATE products 
            SET name = $1, 
                price = $2, 
                category = $3, 
                stock = $4, 
                image_icon = $5, 
                image_url = $6, 
                updated_at = NOW()
            WHERE id = $7
            RETURNING *
        `;
        const values = [name, price, category, stock, image_icon, image_url, id];
        const result = await pool.query(query, values);
        
        console.log('✅ Producto actualizado. image_url guardada:', result.rows[0].image_url);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Error en updateProduct:', error);
        res.status(500).json({ message: 'Error al actualizar producto' });
    }
};

// Actualizar solo stock (admin)
const updateStock = async (req, res) => {
    try {
        const { id } = req.params;
        const { stock } = req.body;
        if (stock === undefined || isNaN(parseInt(stock)))
            return res.status(400).json({ message: 'Stock inválido' });

        const result = await pool.query(
            'UPDATE products SET stock=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
            [parseInt(stock), id]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ message: 'Producto no encontrado' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar stock' });
    }
};

// Eliminar producto (admin)
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'DELETE FROM products WHERE id=$1 RETURNING *', [id]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ message: 'Producto no encontrado' });
        res.json({ message: 'Producto eliminado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al eliminar producto' });
    }
};

module.exports = {
    getAllProducts,
    searchProducts,
    getProductsByCategory,
    getProductById,
    createProduct,
    updateProduct,
    updateStock,
    deleteProduct,
    getLowStockProducts
};
