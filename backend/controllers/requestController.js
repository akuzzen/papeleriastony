const Request = require('../models/Request');

// Crear solicitud (público)
const createRequest = async (req, res) => {
    try {
        const { product_name, user_email } = req.body;
        const request = await Request.create({ product_name, user_email });
        res.status(201).json({ message: 'Solicitud enviada correctamente', request });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al enviar solicitud' });
    }
};

// Obtener todas las solicitudes (admin)
const getAllRequests = async (req, res) => {
    try {
        const requests = await Request.findAll();
        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener solicitudes' });
    }
};

// Marcar como notificada (admin)
const markNotified = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await Request.markNotified(id);
        if (!request) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }
        res.json({ message: 'Solicitud marcada como notificada', request });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar solicitud' });
    }
};

module.exports = {
    createRequest,
    getAllRequests,
    markNotified
};