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

// Obtener carrito de usuario por email (para vendedores)
router.get('/user-cart', authMiddleware, async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ message: 'Correo requerido' });
        const user = await User.findByEmail(email);
        if (!user) return res.status(404).json({ message: 'No existe un usuario con ese correo' });
        // El carrito se almacena en sessionStorage en el cliente; el backend
        // solo valida que el usuario exista y devuelve su nombre.
        // El carrito real viene del sessionStorage del frontend via postCart.
        res.json({ userId: user.id, userName: user.name, cart: [] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error al buscar usuario' });
    }
});

module.exports = router;
