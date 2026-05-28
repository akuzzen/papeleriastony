const express = require('express');
const pool = require('../config/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Obtener todos los administradores (solo usuarios con rol 'admin')
router.get('/admins', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, role, created_at FROM users WHERE role = $1 ORDER BY created_at DESC',
            ['admin']
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener administradores' });
    }
});

// Eliminar administrador
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar que existe y es admin
        const checkQuery = 'SELECT * FROM users WHERE id = $1 AND role = $2';
        const checkResult = await pool.query(checkQuery, [id, 'admin']);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Administrador no encontrado' });
        }
        
        // Eliminar
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'Administrador eliminado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al eliminar administrador' });
    }
});


// ── VENDEDORES ──────────────────────────────────────────────

// Listar todos los vendedores
router.get('/sellers', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, role, created_at FROM users WHERE role = $1 ORDER BY created_at DESC',
            ['seller']
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener vendedores' });
    }
});

// Eliminar vendedor
router.delete('/sellers/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const check = await pool.query('SELECT * FROM users WHERE id = $1 AND role = $2', [id, 'seller']);
        if (check.rows.length === 0) {
            return res.status(404).json({ message: 'Vendedor no encontrado' });
        }
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'Vendedor eliminado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al eliminar vendedor' });
    }
});

module.exports = router;
