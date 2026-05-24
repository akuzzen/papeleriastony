const Request = require('../models/Request');
const transporter = require('../config/mailer');

// Crear solicitud (público)
const createRequest = async (req, res) => {
    try {
        const { product_name, user_email } = req.body;
        const request = await Request.create({ product_name, user_email });

        // Correo 1 — Confirmación al cliente
        await transporter.sendMail({
            from: `"Papelerías Tony" <${process.env.EMAIL_USER}>`,
            to: user_email,
            subject: `📋 Solicitud recibida: ${product_name}`,
            html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0;">
                <div style="background:#c0392b;padding:28px 32px;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:1px;">PAPELERÍAS TONY</h1>
                    <p style="color:#f8d7d7;margin:6px 0 0;font-size:13px;">Tu tienda de confianza</p>
                </div>
                <div style="padding:32px;background:#fff;">
                    <h2 style="color:#2f2c79;margin-top:0;">¡Solicitud recibida! 📋</h2>
                    <p style="color:#444;font-size:15px;">Hola, registramos tu solicitud para el siguiente producto:</p>
                    <div style="background:#f9f9f9;border-left:4px solid #c0392b;padding:14px 18px;border-radius:6px;margin:20px 0;">
                        <p style="margin:0;font-size:16px;font-weight:bold;color:#2f2c79;">${product_name}</p>
                    </div>
                    <p style="color:#444;font-size:15px;">En cuanto tengamos existencia de este producto, te enviaremos un correo de aviso automáticamente.</p>
                    <p style="color:#444;font-size:15px;">¡Gracias por tu preferencia! 🎉</p>
                </div>
                <div style="background:#f5f5f5;padding:16px 32px;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#999;">© Papelerías Tony — Este es un mensaje automático, no respondas a este correo.</p>
                </div>
            </div>`
        });

        // Correo 2 — Aviso interno a los admins
        await transporter.sendMail({
            from: `"Papelerías Tony" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: `🛒 Nueva solicitud de producto: ${product_name}`,
            html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0;">
                <div style="background:#2f2c79;padding:28px 32px;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;">PANEL ADMIN</h1>
                    <p style="color:#c5c3f0;margin:6px 0 0;font-size:13px;">Papelerías Tony — Notificación interna</p>
                </div>
                <div style="padding:32px;background:#fff;">
                    <h2 style="color:#c0392b;margin-top:0;">🛒 Nueva solicitud de producto</h2>
                    <p style="color:#444;font-size:15px;">Un cliente ha solicitado un producto agotado:</p>
                    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                        <tr style="background:#f9f9f9;">
                            <td style="padding:12px 16px;font-weight:bold;color:#2f2c79;width:40%;border-bottom:1px solid #eee;">Producto</td>
                            <td style="padding:12px 16px;color:#444;border-bottom:1px solid #eee;">${product_name}</td>
                        </tr>
                        <tr>
                            <td style="padding:12px 16px;font-weight:bold;color:#2f2c79;width:40%;border-bottom:1px solid #eee;">Cliente</td>
                            <td style="padding:12px 16px;color:#444;border-bottom:1px solid #eee;">${user_email}</td>
                        </tr>
                        <tr style="background:#f9f9f9;">
                            <td style="padding:12px 16px;font-weight:bold;color:#2f2c79;width:40%;">Fecha</td>
                            <td style="padding:12px 16px;color:#444;">${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</td>
                        </tr>
                    </table>
                    <p style="color:#888;font-size:13px;">Puedes ver todas las solicitudes en el panel de administración.</p>
                </div>
                <div style="background:#f5f5f5;padding:16px 32px;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#999;">© Papelerías Tony — Notificación interna automática.</p>
                </div>
            </div>`
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
