-- Tabla de usuarios (tanto clientes como administradores)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user' o 'admin'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de productos
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de favoritos (relación usuario-producto)
CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

-- Tabla de promociones (gestionadas por admin)
CREATE TABLE promotions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    discount_percent INT,
    start_date DATE,
    end_date DATE,
    image_url VARCHAR(500),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de solicitudes de productos agotados (notificaciones)
CREATE TABLE requests (
    id SERIAL PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL,
    user_email VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'notified'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar usuario administrador por defecto (contraseña: admin123)
-- La contraseña deberá ser hasheada con bcrypt en la aplicación, aquí la dejamos en texto plano solo para ejemplo
INSERT INTO users (name, email, password, role) 
VALUES ('Administrador', 'admin@drfashion.com', 'admin123', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insertar usuario de prueba
INSERT INTO users (name, email, password, role) 
VALUES ('Usuario Demo', 'usuario@email.com', 'user123', 'user')
ON CONFLICT (email) DO NOTHING;

-- Insertar productos de ejemplo
INSERT INTO products (name, price, category, stock, image_url) VALUES
('Cámara digital', 299.99, 'Regalos', 3, '📷'),
('Camiseta algodón', 24.99, 'Boutique', 15, '👕'),
('Libro bestseller', 15.90, 'Papeleria', 2, '📚'),
('Lámpara LED', 45.50, 'Regalos', 8, '💡'),
('Auriculares', 89.99, 'Regalos', 1, '🎧'),
('Mochila', 55.00, 'Papeleria', 10, '🎒');

-- Insertar una promoción de ejemplo
INSERT INTO promotions (title, description, discount_percent, start_date, end_date, active) VALUES
('30% OFF en limpieza', 'Aprovecha el descuento en toda la categoría de limpieza', 30, CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days', true);