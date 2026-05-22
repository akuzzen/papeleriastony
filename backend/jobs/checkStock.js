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
                html: `<p>El producto "${req.product_name}" ha vuelto a estar en stock. ¡Corre a comprarlo!</p>`
            });
            await pool.query(`UPDATE product_requests SET status = 'notified', notified_at = NOW() WHERE id = $1`, [req.id]);
        }
    } catch (error) {
        console.error('Error en notificación de stock:', error);
    }
});