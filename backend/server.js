const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ SERVIR IMÁGENES (debe ir ANTES de las rutas API)
const imagesPath = process.env.RENDER_DISK_PATH || path.join(__dirname, '../frontend/assets/images');
app.use('/assets/images', express.static(imagesPath));
console.log(`📁 Sirviendo imágenes estáticas desde: ${imagesPath}`);

// ✅ También servir la carpeta assets completa por si acaso
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));

// Rutas de la API
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const favoriteRoutes = require('./routes/favorites');
const promotionRoutes = require('./routes/promotions');
const requestRoutes = require('./routes/requests');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);

// Ruta de salud
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.json({ 
        message: 'Papelerías Tony API funcionando correctamente',
        status: 'online',
        endpoints: {
            products: '/api/products',
            auth: '/api/auth',
            favorites: '/api/favorites',
            promotions: '/api/promotions'
        }
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});

// ✅ Cron job de stock (si existe)
try {
    require('./jobs/checkStock');
    console.log('✅ Cron job de stock activado');
} catch (err) {
    console.log('⚠️ checkStock.js no encontrado');
}
