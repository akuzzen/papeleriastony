const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ruta del disco persistente o carpeta local
const STORAGE_PATH = process.env.RENDER_DISK_PATH || path.join(__dirname, '../../frontend/assets/images');

// Crear carpeta si no existe
if (!fs.existsSync(STORAGE_PATH)) {
    fs.mkdirSync(STORAGE_PATH, { recursive: true });
    console.log(`📁 Carpeta creada: ${STORAGE_PATH}`);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, STORAGE_PATH);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

module.exports = upload;
