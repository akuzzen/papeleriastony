const Request = require('../models/Request');
const transporter = require('../config/mailer');

// Crear solicitud (público)
const createRequest = async (req, res) => {
    try {
        const { product_name, user_email } = req.body;
        const request = await Request.create({ product_name, user_email });

        // Correo de confirmación al usuario
        await transporter.sendMail({
            from: `"Papelerías Tony" <${process.env.EMAIL_USER}>`,
            to: user_email,
            subject: `✅ Solicitud recibida: ${product_name}`,
            html: `
                <div style="font-family:Arial,sans-serif; max-width:500px; margin:auto; padding:24px; border:1px solid #eee; border-radius:10px;">
                    <h2 style="color:#c0392b;">Papelerías Tony</h2>
                    <p>Hola, recibimos tu solicitud para el producto:</p>
                    <h3 style="color:#2f2c79;">${product_name}</h3>
                    <p>Te avisaremos a este correo en cuanto haya existencia. ¡Gracias por tu preferencia!</p>
                    <hr>
                    <p style="font-size:12px; color:#888;">Papelerías Tony - Tu tienda de confianza</p>
                </div>
            `
        });

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
