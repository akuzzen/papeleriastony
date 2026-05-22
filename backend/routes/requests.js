const express = require('express');
const {
    createRequest,
    getAllRequests,
    markNotified
} = require('../controllers/requestController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Pública (para enviar solicitud)
router.post('/', createRequest);

// Admin
router.get('/', authMiddleware, adminMiddleware, getAllRequests);
router.patch('/:id/notify', authMiddleware, adminMiddleware, markNotified);

module.exports = router; 
