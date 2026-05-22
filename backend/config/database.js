const { Pool } = require('pg');
require('dotenv').config();

// En Render, la variable DATABASE_URL es proporcionada automáticamente
// cuando creas un servicio de PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Requerido por Render
    }
});

module.exports = pool;