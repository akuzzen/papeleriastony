const express = require('express');
const { 
    register, 
    login, 
    getProfile, 
    forgotPassword, 
    resetPassword, 
    registerAdmin,
    registerSeller,
    getSecurityQuestion,
    resetWithSecurity
} = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const pool = require('../config/database');

const router = express.Router();

// Rutas públicas
router.post('/register', register);
router.post('/login', login);
router.post('/forgot', forgotPassword);
router.post('/reset', resetPassword);
router.post('/get-security-question', getSecurityQuestion);
router.post('/reset-with-security', resetWithSecurity);
router.get('/profile', authMiddleware, getProfile);
router.post('/register/admin', authMiddleware, registerAdmin);
router.post('/register/seller', authMiddleware, registerSeller);

// ── CARRITO PERSISTENTE ──────────────────────────────────────────────

// Guardar carrito del usuario logueado (PUT /auth/user-cart)
router.put('/user-cart', authMiddleware, async (req, res) => {
    try {
        const { cart } = req.body;
        if (!Array.isArray(cart)) return res.status(400).json({ message: 'Formato de carrito inválido' });
        await pool.query(
            `INSERT INTO user_carts (user_id, cart_data, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_id)
             DO UPDATE SET cart_data = $2, updated_at = NOW()`,
            [req.userId, JSON.stringify(cart)]
        );
        res.json({ message: 'Carrito guardado' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error al guardar carrito' });
    }
});

// Obtener carrito del usuario logueado (GET /auth/user-cart — sin parámetros)
router.get('/user-cart', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT cart_data FROM user_carts WHERE user_id = $1',
            [req.userId]
        );
        const cart = result.rows.length ? result.rows[0].cart_data : [];
        res.json({ cart });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error al obtener carrito' });
    }
});

// Obtener carrito de un usuario por email (para vendedores — requiere auth)
router.get('/customer-cart', authMiddleware, async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ message: 'Correo requerido' });
        const user = await User.findByEmail(email);
        if (!user || user.role !== 'user') {
            return res.status(404).json({ message: 'No existe un cliente registrado con ese correo' });
        }
        const result = await pool.query(
            'SELECT cart_data FROM user_carts WHERE user_id = $1',
            [user.id]
        );
        const cart = result.rows.length ? result.rows[0].cart_data : [];
        res.json({ userId: user.id, userName: user.name, cart });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error al buscar carrito del cliente' });
    }
});

module.exports = router;
