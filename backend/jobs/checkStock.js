const cron = require('node-cron');
const pool = require('../config/database');
const transporter = require('../config/mailer');

// Cada 5 minutos verifica productos que antes estaban agotados y ahora tienen stock
cron.schedule('*/5 * * * *', async () => {
    try {
        // Obtener solicitudes pendientes de productos que ahora tienen stock > 0
        const query = `
            SELECT pr.*, p.stock, p.name as product_name 
            FROM product_requests pr 
            JOIN products p ON LOWER(p.name) = LOWER(pr.product_name)
            WHERE pr.status = 'pending' AND p.stock > 0
        `;
        const requests = await pool.query(query);
        for (const req of requests.rows) {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: req.user_email,
                subject: `Producto "${req.product_name}" disponible nuevamente`,
                html: `
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0;">
                    <div style="background:#c0392b;padding:28px 32px;text-align:center;">
                        <h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:1px;">PAPELERÍAS TONY</h1>
                        <p style="color:#f8d7d7;margin:6px 0 0;font-size:13px;">Tu tienda de confianza</p>
                    </div>
                    <div style="padding:32px;background:#fff;">
                        <h2 style="color:#2f2c79;margin-top:0;">¡Ya hay existencia! 🎉</h2>
                        <p style="color:#444;font-size:15px;">El producto que solicitaste ya está disponible:</p>
                        <div style="background:#f9f9f9;border-left:4px solid #c0392b;padding:14px 18px;border-radius:6px;margin:20px 0;">
                            <p style="margin:0;font-size:16px;font-weight:bold;color:#2f2c79;">${req.product_name}</p>
                        </div>
                        <p style="color:#444;font-size:15px;">¡Date prisa antes de que se agote de nuevo! 🚀</p>
                        <div style="text-align:center;margin:28px 0;">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}" style="background:#c0392b;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-size:15px;font-weight:bold;">Ver tienda →</a>
                        </div>
                    </div>
                    <div style="background:#f5f5f5;padding:16px 32px;text-align:center;">
                        <p style="margin:0;font-size:12px;color:#999;">© Papelerías Tony — Este es un mensaje automático, no respondas a este correo.</p>
                    </div>
                </div>`
            });
            await pool.query(`UPDATE product_requests SET status = 'notified', notified_at = NOW() WHERE id = $1`, [req.id]);
        }
    } catch (error) {
        console.error('Error en notificación de stock:', error);
    }
});
