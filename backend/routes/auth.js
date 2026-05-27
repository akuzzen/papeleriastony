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

// Ruta protegida (requiere token)
router.get('/profile', authMiddleware, getProfile);

// Ruta protegida para admin
router.post('/register/admin', authMiddleware, registerAdmin);

module.exports = router;
