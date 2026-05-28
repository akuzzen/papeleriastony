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
const User = require('../models/User');

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

// Eliminar carrito de cliente por email (cuando venta se completa)
router.delete('/clear-customer-cart', authMiddleware, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Correo requerido' });
        const user = await User.findByEmail(email);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        await pool.query('DELETE FROM user_carts WHERE user_id = $1', [user.id]);
        res.json({ message: 'Carrito del cliente limpiado' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error al limpiar carrito' });
    }
});

// Subir foto de perfil (POST /auth/avatar)
const multer = require('multer');
const path = require('path');
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../frontend/assets/images')),
    filename: (req, file, cb) => cb(null, `avatar_${req.userId}_${Date.now()}${path.extname(file.originalname)}`)
});
const avatarUpload = multer({
    storage: avatarStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo imágenes'));
        cb(null, true);
    }
});

router.post('/avatar', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No se recibió imagen' });
        const avatar_url = `/assets/images/${req.file.filename}`;
        await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatar_url, req.userId]);
        res.json({ message: 'Avatar actualizado', avatar_url });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error al guardar avatar' });
    }
});

module.exports = router;
