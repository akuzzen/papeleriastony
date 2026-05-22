const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const transporter = require('../config/mailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
require('dotenv').config();

// Validar que la contraseña sea segura
function isStrongPassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (password.length < minLength) return false;
    if (!hasUpperCase) return false;
    if (!hasLowerCase) return false;
    if (!hasNumbers) return false;
    if (!hasSpecialChar) return false;
    
    return true;
}

// Solicitar restablecimiento de contraseña
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        console.log('📧 1. Email recibido:', email);
        
        // Buscar usuario
        const user = await User.findByEmail(email);
        console.log('👤 2. Usuario encontrado:', user ? user.id : 'NO EXISTE');
        
        if (!user) {
            return res.status(404).json({ message: 'No existe una cuenta con este correo electrónico.' });
        }
        
        // Eliminar tokens anteriores
        await PasswordReset.deleteByUserId(user.id);
        console.log('🗑️ 3. Tokens anteriores eliminados');
        
        // Crear nuevo token
        const resetRecord = await PasswordReset.create(user.id);
        console.log('🔑 4. Token generado:', resetRecord.token);
        console.log('⏰ 5. Expira en:', resetRecord.expires_at);
        
        // Generar enlace de recuperación
        const resetLink = `http://localhost:8080/reset-password.html?token=${resetRecord.token}`;
        console.log('🔗 6. ENLACE COMPLETO:', resetLink);
        
        // ✅ ENVÍO DE CORREO REAL (activado)
        const mailOptions = {
            from: `"D&R Fashion" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Recuperación de contraseña - D&R Fashion',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h2 style="color: #2f2c79;">D&R Fashion</h2>
                    <p>Hola <strong>${user.name}</strong>,</p>
                    <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente botón:</p>
                    <a href="${resetLink}" style="display: inline-block; background-color: #2f2c79; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">Restablecer contraseña</a>
                    <p>Si no solicitaste esto, ignora este mensaje.</p>
                    <p><strong>Este enlace expirará en 1 hora.</strong></p>
                    <hr>
                    <p style="font-size: 12px; color: #888;">D&R Fashion - Tu tienda de confianza</p>
                </div>
            `
        };

        // Intentar enviar el correo
        try {
            await transporter.sendMail(mailOptions);
            console.log('✅ Correo enviado correctamente a:', email);
            res.json({ message: 'Se ha enviado un enlace de recuperación a tu correo electrónico.' });
        } catch (mailError) {
            console.error('❌ Error al enviar correo:', mailError);
            // Si falla el envío, igual devolvemos el enlace en consola para depuración
            res.json({ 
                message: '✅ Revisa la consola del servidor para obtener el enlace de recuperación.',
                debug_link: resetLink
            });
        }
        
    } catch (error) {
        console.error('❌ Error en forgotPassword:', error);
        res.status(500).json({ message: 'Error al procesar la solicitud.' });
    }
};

// Restablecer contraseña
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        if (!token) {
            return res.status(400).json({ message: 'Token no proporcionado.' });
        }
        
        // Buscar token válido en la base de datos
        const resetRecord = await PasswordReset.findByToken(token);
        
        if (!resetRecord) {
            return res.status(400).json({ message: 'El enlace ha expirado o no es válido. Solicita un nuevo restablecimiento.' });
        }
        
        // Encriptar nueva contraseña
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Actualizar contraseña del usuario
        const query = `UPDATE users SET password = $1 WHERE id = $2`;
        await pool.query(query, [hashedPassword, resetRecord.user_id]);
        
        // Eliminar el token usado
        await PasswordReset.deleteByUserId(resetRecord.user_id);
        
        res.json({ message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
        
    } catch (error) {
        console.error('Error en resetPassword:', error);
        res.status(500).json({ message: 'Error al restablecer la contraseña.' });
    }
};


const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

const register = async (req, res) => {
    try {
        const { name, email, password, security_question, security_answer } = req.body;
        
        console.log('📝 Registro - Datos recibidos:', { name, email, security_question, security_answer: security_answer ? '✅' : '❌' });
        
        // Validar campos obligatorios
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Nombre, email y contraseña son obligatorios' });
        }
        
        if (!security_question || !security_answer) {
            return res.status(400).json({ message: 'Pregunta y respuesta de seguridad son obligatorias' });
        }
        
        // Verificar si el email ya existe
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'El email ya está registrado' });
        }

        // Crear usuario usando el modelo
        const newUser = await User.create({ 
            name, 
            email, 
            password, 
            role: 'user',
            security_question,
            security_answer
        });
        
        // Generar token
        const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        console.log('✅ Usuario registrado con pregunta:', newUser.security_question);
        
        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error('❌ Error en register:', error);
        res.status(500).json({ message: 'Error en el servidor: ' + error.message });
    }
};

// Registrar administrador (solo accesible por admin)
const registerAdmin = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Verificar si el email ya existe
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'El email ya está registrado' });
        }
        
        // ✅ Validar contraseña segura
        if (!isStrongPassword(password)) {
            return res.status(400).json({ 
                message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial (!@#$%^&*)' 
            });
        }

        const user = await User.create({ name, email, password, role: 'admin' });
        
        res.status(201).json({
            message: 'Administrador creado exitosamente',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findByEmail(email);
        if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });
        const isMatch = await User.comparePassword(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Credenciales inválidas' });
        const token = generateToken(user.id);
        res.json({
            message: 'Inicio de sesión exitoso',
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        res.json({ id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Obtener pregunta de seguridad de un usuario
const getSecurityQuestion = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findByEmail(email);
        
        if (!user) {
            return res.status(404).json({ message: 'No existe una cuenta con este correo electrónico.' });
        }
        
        if (!user.security_question) {
            return res.status(400).json({ message: 'Este usuario no tiene configurada una pregunta de seguridad. Contacta al administrador.' });
        }
        
        res.json({ question: user.security_question });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener la pregunta de seguridad.' });
    }
};

// Restablecer contraseña mediante pregunta de seguridad
const resetWithSecurity = async (req, res) => {
    try {
        const { email, answer, newPassword } = req.body;
        const user = await User.findByEmail(email);
        
        if (!user) {
            return res.status(404).json({ message: 'No existe una cuenta con este correo electrónico.' });
        }
        
        // Verificar respuesta de seguridad
        const isAnswerCorrect = await bcrypt.compare(answer.toLowerCase(), user.security_answer);
        
        if (!isAnswerCorrect) {
            return res.status(401).json({ message: 'Respuesta de seguridad incorrecta.' });
        }
        
        // Encriptar y actualizar contraseña
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const query = `UPDATE users SET password = $1 WHERE id = $2`;
        await pool.query(query, [hashedPassword, user.id]);
        
        res.json({ message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al restablecer la contraseña.' });
    }
};


module.exports = { 
    register, 
    login, 
    getProfile, 
    forgotPassword, 
    resetPassword,
    registerAdmin,
    getSecurityQuestion,
    resetWithSecurity
};