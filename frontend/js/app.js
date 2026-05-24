// ============================================================
//  Papelerías Tony — app.js
//  Conectado a la API REST en producción
// ============================================================

// URL dinámica según entorno
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : 'https://papelerias-tony-backend.onrender.com/api';

const BACKEND_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000' 
    : 'https://papelerias-tony-backend.onrender.com';

// ── ESTADO GLOBAL ──
let activeCategory   = 'Todo';
let isAdmin          = false;
let adminInitialized = false;
let currentToken     = null;
let products         = [];
let currentUserName  = '';
const BACKEND_URL_IMAGES = API_URL.replace('/api', '');

// ── UTILIDADES HTTP ──
function authHeaders(json = true) {
    const h = {};
    if (json) h['Content-Type'] = 'application/json';
    if (currentToken) h['Authorization'] = `Bearer ${currentToken}`;
    return h;
}

async function apiFetch(path, options = {}) {
    const res = await fetch(API_URL + path, {
        ...options,
        headers: options.headers ?? authHeaders()
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || res.statusText);
    }
    return res.json();
}

function normalize(str) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isDuplicateProductName(name, excludeId = null) {
    const normalizedName = normalize(name);
    return products.some(p => {
        if (excludeId !== null && p.id === excludeId) return false;
        return normalize(p.name) === normalizedName;
    });
}

function isStrongPassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (password.length < minLength) {
        alert(`❌ La contraseña debe tener al menos ${minLength} caracteres.`);
        return false;
    }
    if (!hasUpperCase) { alert('❌ Debe contener al menos una letra MAYÚSCULA.'); return false; }
    if (!hasLowerCase) { alert('❌ Debe contener al menos una letra minúscula.'); return false; }
    if (!hasNumbers) { alert('❌ Debe contener al menos un número.'); return false; }
    if (!hasSpecialChar) { alert('❌ Debe contener al menos un carácter especial (!@#$%^&*).'); return false; }
    return true;
}

function highlightMatch(text, term) {
    if (!term) return text;
    const normText = normalize(text);
    const normTerm = normalize(term);
    let result = '', i = 0;
    while (i < text.length) {
        if (normText.startsWith(normTerm, i)) {
            result += `<mark class="search-highlight">${text.slice(i, i + term.length)}</mark>`;
            i += term.length;
        } else {
            result += text[i++];
        }
    }
    return result;
}

// ============================================================
//  SUGERENCIAS Y BÚSQUEDA
// ============================================================
function showSuggestions() {
    const input = document.getElementById('searchInput');
    const searchTerm = normalize(input.value.trim());
    const suggestionsBox = document.getElementById('suggestionsBox');
    
    if (searchTerm === '') {
        suggestionsBox.style.display = 'none';
        return;
    }
    
    const matches = products.filter(p => 
        normalize(p.name).includes(searchTerm) ||
        normalize(p.category).includes(searchTerm)
    ).slice(0, 8);
    
    if (matches.length === 0) {
        suggestionsBox.style.display = 'none';
        return;
    }
    
    suggestionsBox.innerHTML = matches.map(p => `
        <div class="suggestion-item" onclick="selectSuggestion('${p.name.replace(/'/g, "\\'")}')">
            <strong>${p.name}</strong><br>
            <small>${p.category} - $${parseFloat(p.price).toFixed(2)}</small>
        </div>
    `).join('');
    suggestionsBox.style.display = 'block';
}

function selectSuggestion(productName) {
    document.getElementById('searchInput').value = productName;
    document.getElementById('suggestionsBox').style.display = 'none';
    activeCategory = 'Todo';
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent === 'Todo') btn.classList.add('active');
    });
    renderProducts();
}

// ============================================================
//  PRODUCTOS
// ============================================================
async function loadProducts() {
    try {
        products = await apiFetch('/products');
        return products;
    } catch (e) {
        console.error('Error cargando productos:', e);
        return [];
    }
}

function renderCategories() {
    const container = document.getElementById('categoriesContainer');
    container.innerHTML = '';
    const cats = ['Todo', ...new Set(products.map(p => p.category))];
    cats.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-btn' + (cat === activeCategory ? ' active' : '');
        btn.textContent = cat;
        btn.addEventListener('click', () => {
            activeCategory = cat;
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('searchInput').value = '';
            renderProducts();
        });
        container.appendChild(btn);
    });
}

function renderProducts() {
    const grid = document.getElementById('productGrid');
    const searchTerm = normalize(document.getElementById('searchInput').value.trim());
    let filtered = activeCategory === 'Todo' ? products : products.filter(p => p.category === activeCategory);
    if (searchTerm !== '') {
        filtered = filtered.filter(p => normalize(p.name).includes(searchTerm) || normalize(p.category).includes(searchTerm));
    }
    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;">🔍 No se encontraron productos</div>`;
        return;
    }
    grid.innerHTML = filtered.map(p => {
        const stockLabel = p.stock === 0 ? `<span class="stock-alert stock-low">⚠ Agotado</span>` : p.stock <= 3 ? `<span class="stock-alert stock-low">⚠ Pocas piezas (${p.stock})</span>` : `<span class="stock-alert">✓ En existencia (${p.stock})</span>`;
        
        // IMAGEN CON URL ABSOLUTA
        let imageHtml = '';
        if (p.image_url && p.image_url !== 'null' && p.image_url.trim() !== '') {
            const imgSrc = p.image_url.startsWith('/assets/')
                ? BACKEND_URL + p.image_url
                : p.image_url;
            imageHtml = `<img src="${imgSrc}" alt="${p.name}" class="product-img" style="width:100%; height:100%; object-fit:cover; border-radius:18px;" onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<span class=product-img-fallback>${p.image_icon || '🛍️'}</span>';">`;
        } else {
            imageHtml = `<span class="product-img-fallback">${p.image_icon || '🛍️'}</span>`;
        }
        
        const changeImgBtn = isAdmin ? `<input type="file" accept="image/*" class="change-img-input" id="file-${p.id}" onchange="changeProductImage(${p.id}, this)"><button class="change-img-btn" onclick="document.getElementById('file-${p.id}').click()">📷 Cambiar imagen</button>` : '';
        
        return `<div class="product-card">
                    <div class="favorite-icon" data-id="${p.id}" onclick="toggleFavorite(${p.id},this)">♡</div>
                    <div class="product-image">${imageHtml}${changeImgBtn}</div>
                    <div class="product-name">${searchTerm ? highlightMatch(p.name, searchTerm) : p.name}</div>
                    <div class="product-price">${parseFloat(p.price).toFixed(2)}</div>
                    <div>${stockLabel}</div>
                </div>`;
    }).join('');
}

async function changeProductImage(productId, inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const formData = new FormData();
    formData.append('name', prod.name);
    formData.append('price', prod.price);
    formData.append('category', prod.category);
    formData.append('stock', prod.stock);
    formData.append('image', file);

    try {
        const res = await fetch(`${API_URL}/products/${productId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${currentToken}` },
            body: formData
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        const idx = products.findIndex(p => p.id === productId);
        if (idx !== -1) products[idx] = updated;
        renderProducts();
        alert('✅ Imagen actualizada correctamente');
    } catch (e) { 
        alert('Error: ' + e.message); 
    }
}

async function toggleFavorite(productId, btn) {
    try {
        const { isFavorite } = await apiFetch(`/favorites/check/${productId}`);
        if (isFavorite) {
            await apiFetch(`/favorites/${productId}`, { method: 'DELETE' });
            btn.textContent = '♡';
            btn.style.color = '';
        } else {
            await apiFetch(`/favorites/${productId}`, { method: 'POST' });
            btn.textContent = '♥';
            btn.style.color = '#E3000F';
        }
    } catch(e) {
        console.error('Error toggling favorite', e);
    }
}

function initSearch() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => { showSuggestions(); renderProducts(); });
    searchBtn.addEventListener('click', () => { document.getElementById('suggestionsBox').style.display = 'none'; renderProducts(); });
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { document.getElementById('suggestionsBox').style.display = 'none'; renderProducts(); } });
}

// ============================================================
//  AUTENTICACIÓN
// ============================================================
function showView(role) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('userView').classList.remove('active');
    document.getElementById('adminView').classList.remove('active');
    document.getElementById('requestBtn').style.display = 'none';
    if (role === 'admin') {
        document.getElementById('adminView').classList.add('active');
        initAdminPanel();
        startInactivityTracking();
    } else if (role === 'user') {
        document.getElementById('userView').classList.add('active');
        document.getElementById('requestBtn').style.display = 'flex';
        loadProducts().then(() => { renderCategories(); renderProducts(); });
        if (currentUserName) {
            document.getElementById('helloUser').textContent = 'Hola, ' + currentUserName.split(' ')[0];
        }
        loadPromotions();
        startInactivityTracking();
    } else {
        document.getElementById('loginScreen').style.display = 'block';
        stopInactivityTracking();
    }
}

function logout() {
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('userView').classList.remove('active');
    document.getElementById('adminView').classList.remove('active');
    document.getElementById('requestBtn').style.display = 'none';
    activeCategory = 'Todo';
    isAdmin = false;
    adminInitialized = false;
    currentToken = null;
    products = [];
    sessionStorage.removeItem('papeleriastony_token');
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPass').value = '';
    stopInactivityTracking();
}

function initLogin() {
    const loginBtn = document.getElementById('loginBtn');
    const msgEl = document.getElementById('loginMessage');
    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPass').value.trim();
        msgEl.className = 'message';
        msgEl.textContent = '';
        if (!email || !pass) {
            msgEl.className = 'message error';
            msgEl.textContent = 'Por favor ingresa tu correo y contraseña.';
            return;
        }
        try {
            const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: pass }) });
            currentToken = data.token;
            sessionStorage.setItem('drfashion_token', data.token);
            isAdmin = data.user.role === 'admin';
            currentUserName = data.user.name;
            showView(data.user.role);
        } catch (e) {
            msgEl.className = 'message error';
            msgEl.textContent = e.message || 'Correo o contraseña incorrectos.';
        }
    });
    document.getElementById('loginPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn.click(); });
    document.getElementById('logoutUserBtn').addEventListener('click', logout);
    document.getElementById('logoutAdminBtn').addEventListener('click', logout);
}

// ============================================================
//  PROMOCIONES
// ============================================================
async function loadPromotions() {
    try {
        const promos = await apiFetch('/promotions/active');
        const banner = document.getElementById('promoBanner');
        if (!banner) return;
        if (!promos.length) { banner.style.display = 'none'; return; }
        banner.style.display = 'block';
        banner.innerHTML = promos.map(p => `<div><h3>🔥 ${p.title}</h3><p>${p.description || ''}${p.discount_percent ? ` — <strong>${p.discount_percent}% OFF</strong>` : ''}</p></div>`).join('');
    } catch (e) { console.error('Promociones:', e); }
}

// ============================================================
//  PANEL ADMIN
// ============================================================
function refreshAdminTables() {
    const invBody = document.getElementById('inventoryBody');
    if (invBody) {
        invBody.innerHTML = products.map(p => `<tr><td>${p.image_url && p.image_url.startsWith('/assets/') ? '🖼️' : (p.image_url || '🛍️')} ${p.name}</td><td>${p.stock}</td><td><input type="number" class="stock-input" value="${p.stock}" min="0" data-id="${p.id}"></td></tr>`).join('');
    }
    const editBody = document.getElementById('editBody');
    if (editBody) {
        editBody.innerHTML = products.map(p => `
            <tr>
                <td>${p.name}</td>
                <td>$${parseFloat(p.price).toFixed(2)}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span id="edit-img-preview-${p.id}">
                            ${p.image_url && p.image_url.startsWith('/assets/') 
                                ? `<img src="${BACKEND_URL}${p.image_url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px;">` 
                                : (p.image_url || '🛍️')}
                        </span>
                        <input type="file" id="edit-file-${p.id}" accept="image/*" style="display: none;" data-id="${p.id}">
                        <button class="btn-change-img" onclick="document.getElementById('edit-file-${p.id}').click()" style="background: #0033A0; color: white; border: none; border-radius: 8px; padding: 4px 8px; cursor: pointer;">📷 Cambiar</button>
                    </div>
                </div>
                </td>
                <td class="edit-actions">
                    <i class="fas fa-save" style="color: #0033A0; cursor: pointer; margin-right: 12px;" title="Guardar cambios" onclick="saveProductEdit(${p.id})"></i>
                    <i class="fas fa-trash" style="color: #c45d5d; cursor: pointer;" title="Eliminar" onclick="deleteProduct(${p.id})"></i>
                </div>
                </td>
            </tr>
        `).join('');
        
        products.forEach(p => {
            const fileInput = document.getElementById(`edit-file-${p.id}`);
            if (fileInput) {
                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const previewSpan = document.getElementById(`edit-img-preview-${p.id}`);
                        const reader = new FileReader();
                        reader.onload = (ev) => { previewSpan.innerHTML = `<img src="${ev.target.result}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px;">`; };
                        reader.readAsDataURL(file);
                    }
                });
            }
        });
    }
    if (typeof filterInventoryTable === 'function') filterInventoryTable();
    if (typeof filterEditTable === 'function') filterEditTable();
}

function filterInventoryTable() {
    const searchTerm = normalize(document.getElementById('searchInventoryInput')?.value.trim() || '');
    const rows = document.querySelectorAll('#inventoryBody tr');
    rows.forEach(row => {
        const productName = normalize(row.cells[0]?.textContent || '');
        row.style.display = (searchTerm === '' || productName.includes(searchTerm)) ? '' : 'none';
    });
    const visibleRows = document.querySelectorAll('#inventoryBody tr:not([style*="display: none"])');
    const countSpan = document.getElementById('inventoryCount');
    if (countSpan) countSpan.textContent = `${visibleRows.length} de ${rows.length}`;
}

function filterEditTable() {
    const searchTerm = normalize(document.getElementById('searchEditInput')?.value.trim() || '');
    const rows = document.querySelectorAll('#editBody tr');
    rows.forEach(row => {
        const productName = normalize(row.cells[0]?.textContent || '');
        row.style.display = (searchTerm === '' || productName.includes(searchTerm)) ? '' : 'none';
    });
    const visibleRows = document.querySelectorAll('#editBody tr:not([style*="display: none"])');
    const countSpan = document.getElementById('editCount');
    if (countSpan) countSpan.textContent = `${visibleRows.length} de ${rows.length}`;
}

async function saveProductEdit(productId) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const fileInput = document.getElementById(`edit-file-${productId}`);
    const imageFile = fileInput ? fileInput.files[0] : null;
    const newName = prompt('Editar nombre:', prod.name);
    if (newName === null) return;
    if (isDuplicateProductName(newName.trim(), productId)) { alert(`❌ Ya existe otro producto con el nombre "${newName.trim()}"`); return; }
    const newPrice = parseFloat(prompt('Editar precio:', prod.price));
    if (isNaN(newPrice)) { alert('Precio inválido'); return; }
    const formData = new FormData();
    formData.append('name', newName.trim());
    formData.append('price', newPrice);
    formData.append('category', prod.category);
    formData.append('stock', prod.stock);
    if (imageFile) formData.append('image', imageFile);
    try {
        const res = await fetch(`${API_URL}/products/${productId}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${currentToken}` }, body: formData });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        const idx = products.findIndex(p => p.id === productId);
        if (idx !== -1) products[idx] = updated;
        refreshAdminTables();
        renderProducts();
        renderCategories();
        alert(`✅ Producto actualizado`);
    } catch (e) { alert('Error al actualizar'); }
}

async function deleteProduct(id) {
    const prod = products.find(p => p.id === id);
    if (!prod || !confirm(`¿Eliminar "${prod.name}"?`)) return;
    try {
        await apiFetch(`/products/${id}`, { method: 'DELETE' });
        products = products.filter(p => p.id !== id);
        refreshAdminTables();
        renderProducts();
    } catch (e) { alert('Error al eliminar'); }
}

async function loadAdminPromotions() {
    try {
        const promos = await apiFetch('/promotions');
        const list = document.getElementById('promosList');
        if (!list) return;
        list.innerHTML = promos.length === 0 ? '<p>No hay promociones.</p>' : promos.map(p => `<div style="background:#F5F5F5;border-radius:12px;padding:12px;margin-bottom:10px;border:1px solid #E0E0E0;"><div style="display:flex;justify-content:space-between;"><div><strong>${p.title}</strong> — ${p.discount_percent ?? 0}% OFF <span>${p.is_active ? '✅ Activa' : '⏸ Inactiva'}</span><div>${p.description || ''}</div></div><div><button onclick="openEditPromoModal(${p.id})" style="background:#0033A0;color:white;border:none;border-radius:20px;padding:4px 12px;margin-right:8px;cursor:pointer;">✏️ Editar</button><button onclick="deletePromotion(${p.id})" style="background:#E3000F;color:white;border:none;border-radius:20px;padding:4px 12px;cursor:pointer;">🗑️ Eliminar</button></div></div></div>`).join('');
    } catch (e) { console.error('Promociones admin:', e); }
}

async function openEditPromoModal(promoId) {
    try {
        const promos = await apiFetch('/promotions');
        const promo = promos.find(p => p.id === promoId);
        if (!promo) return;
        document.getElementById('editPromoId').value = promo.id;
        document.getElementById('editPromoTitle').value = promo.title || '';
        document.getElementById('editPromoDesc').value = promo.description || '';
        document.getElementById('editPromoDiscount').value = promo.discount_percent || 0;
        document.getElementById('editPromoValidFrom').value = promo.valid_from ? new Date(promo.valid_from).toISOString().split('T')[0] : '';
        document.getElementById('editPromoValidTo').value = promo.valid_to ? new Date(promo.valid_to).toISOString().split('T')[0] : '';
        document.getElementById('editPromoActive').checked = promo.is_active === true;
        document.getElementById('editPromoModal').classList.add('active');
    } catch (e) { alert('Error al cargar promoción'); }
}

async function savePromotionEdit() {
    const id = document.getElementById('editPromoId').value;
    const title = document.getElementById('editPromoTitle').value.trim();
    const description = document.getElementById('editPromoDesc').value.trim();
    const discount_percent = parseInt(document.getElementById('editPromoDiscount').value) || 0;
    const valid_from = document.getElementById('editPromoValidFrom').value || null;
    const valid_to = document.getElementById('editPromoValidTo').value || null;
    const is_active = document.getElementById('editPromoActive').checked;
    if (!title) { alert('El título es obligatorio'); return; }
    try {
        await apiFetch(`/promotions/${id}`, { method: 'PUT', body: JSON.stringify({ title, description, discount_percent, valid_from, valid_to, is_active }) });
        alert('✅ Promoción actualizada');
        closeModal('editPromoModal');
        loadAdminPromotions();
        loadPromotions();
    } catch (e) { alert('Error al actualizar'); }
}

async function deletePromotion(id) {
    if (!confirm('¿Eliminar esta promoción?')) return;
    try {
        await apiFetch(`/promotions/${id}`, { method: 'DELETE' });
        loadAdminPromotions();
    } catch (e) { alert('Error al eliminar'); }
}

async function createPromotion() {
    const title = prompt('📢 Título de la promoción:');
    if (!title) return;
    const description = prompt('📝 Descripción:');
    if (description === null) return;
    const discount = prompt('💰 Porcentaje de descuento (0-100):', '20');
    if (discount === null) return;
    const isActive = confirm('¿Activar esta promoción?');
    try {
        await apiFetch('/promotions', { method: 'POST', body: JSON.stringify({ title: title.trim(), description: description.trim(), discount_percent: parseInt(discount) || 0, valid_from: null, valid_to: null, is_active: isActive }) });
        alert('✅ Promoción creada');
        loadAdminPromotions();
        loadPromotions();
    } catch (e) { alert('Error al crear'); }
}

async function loadAdmins() {
    try {
        const admins = await apiFetch('/admin/admins');
        const tbody = document.getElementById('adminsListBody');
        if (!tbody) return;
        tbody.innerHTML = admins.map(admin => `<tr><td>${admin.name}</td><td>${admin.email}</td><td>${new Date(admin.created_at).toLocaleDateString('es-MX')}</td><td><button onclick="deleteAdmin(${admin.id})" style="background:#E3000F;color:white;border:none;border-radius:20px;padding:4px 12px;cursor:pointer;">🗑️ Eliminar</button></td></tr>`).join('');
    } catch (e) { console.error('Error cargando admins:', e); }
}

async function createAdmin() {
    const name = document.getElementById('newAdminName').value.trim();
    const email = document.getElementById('newAdminEmail').value.trim();
    const password = document.getElementById('newAdminPass').value.trim();
    if (!name || !email || !password) { alert('❌ Completa todos los campos'); return; }
    if (!isStrongPassword(password)) return;
    try {
        await apiFetch('/auth/register/admin', { method: 'POST', body: JSON.stringify({ name, email, password }) });
        alert(`✅ Administrador "${name}" creado`);
        document.getElementById('newAdminName').value = '';
        document.getElementById('newAdminEmail').value = '';
        document.getElementById('newAdminPass').value = '';
        loadAdmins();
    } catch (e) { alert('Error al crear administrador'); }
}

async function deleteAdmin(adminId) {
    try {
        const currentUser = await apiFetch('/auth/profile');
        if (currentUser.id === adminId) { alert('❌ No puedes eliminarte a ti mismo.'); return; }
    } catch (e) { console.error(e); }
    if (!confirm('¿Eliminar este administrador?')) return;
    try {
        await apiFetch(`/admin/users/${adminId}`, { method: 'DELETE' });
        alert('✅ Administrador eliminado');
        loadAdmins();
    } catch (e) { alert('Error al eliminar: ' + e.message); }
}

let addProductEventAttached = false;

function initAdminPanel() {
    loadProducts().then(() => { refreshAdminTables(); });
    loadAdminPromotions();
    if (adminInitialized) return;
    document.querySelectorAll('.admin-menu-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.admin-menu-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            ['add','inventory','edit','promos','admins'].forEach(tab => {
                const el = document.getElementById('tab-' + tab);
                if (el) el.style.display = (tab === item.dataset.tab) ? 'block' : 'none';
            });
            if (item.dataset.tab === 'inventory') refreshAdminTables();
            if (item.dataset.tab === 'edit') refreshAdminTables();
            if (item.dataset.tab === 'promos') loadAdminPromotions();
            if (item.dataset.tab === 'admins') loadAdmins();
        });
    });
    const addBtn = document.getElementById('addProductBtn');
    if (addBtn && !addProductEventAttached) {
        addProductEventAttached = true;
        addBtn.addEventListener('click', async () => {
            const name = document.getElementById('prodName').value.trim();
            const price = parseFloat(document.getElementById('prodPrice').value);
            const category = document.getElementById('prodCategory').value;
            const stock = parseInt(document.getElementById('prodStock').value) || 0;
            const icon = document.getElementById('prodIcon').value.trim();
            const imageFile = document.getElementById('prodImage').files[0];
            if (!name || isNaN(price)) { alert('Completa nombre y precio.'); return; }
            if (isDuplicateProductName(name)) { alert(`❌ Ya existe un producto con el nombre "${name}"`); return; }
            const fd = new FormData();
            fd.append('name', name); fd.append('price', price);
            fd.append('category', category); fd.append('stock', stock);
            if (icon) fd.append('image_icon', icon);
            if (imageFile) fd.append('image', imageFile);
            try {
                const res = await fetch(`${API_URL}/products`, { method: 'POST', headers: { 'Authorization': `Bearer ${currentToken}` }, body: fd });
                if (!res.ok) throw new Error();
                const nuevo = await res.json();
                products.push(nuevo);
                refreshAdminTables();
                renderCategories();
                renderProducts();
                alert(`✅ Producto "${name}" agregado.`);
                limpiarFormAgregar();
            } catch (e) { alert('Error: ' + e.message); }
        });
    }
    const updateBtn = document.getElementById('updateInventoryBtn');
    if (updateBtn) {
        updateBtn.addEventListener('click', async () => {
            try {
                await Promise.all([...document.querySelectorAll('.stock-input')].map(async input => {
                    const id = parseInt(input.dataset.id), val = parseInt(input.value);
                    if (isNaN(val)) return;
                    const updated = await apiFetch(`/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ stock: val }) });
                    const idx = products.findIndex(p => p.id === id);
                    if (idx !== -1) products[idx].stock = updated.stock;
                }));
                alert('✅ Stock actualizado.'); refreshAdminTables();
            } catch (e) { alert('Error al actualizar stock'); }
        });
    }
    const createPromoBtn = document.getElementById('createPromoBtn');
    if (createPromoBtn) {
        createPromoBtn.removeEventListener('click', createPromotion);
        createPromoBtn.addEventListener('click', createPromotion);
    }
    const searchInventoryInput = document.getElementById('searchInventoryInput');
    if (searchInventoryInput) searchInventoryInput.addEventListener('input', filterInventoryTable);
    const searchEditInput = document.getElementById('searchEditInput');
    if (searchEditInput) searchEditInput.addEventListener('input', filterEditTable);
    const createAdminBtn = document.getElementById('createAdminBtn');
    if (createAdminBtn) createAdminBtn.addEventListener('click', createAdmin);
    adminInitialized = true;
}

function limpiarFormAgregar() {
    ['prodName','prodPrice','prodStock','prodIcon'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('prodImage').value = '';
}

// ============================================================
//  MODALES
// ============================================================
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

function initModals() {
    document.getElementById('showRegisterBtn').addEventListener('click', () => document.getElementById('registerModal').classList.add('active'));
    document.getElementById('showForgotBtn').addEventListener('click', () => document.getElementById('forgotModal').classList.add('active'));
    document.getElementById('requestBtn').addEventListener('click', () => document.getElementById('requestModal').classList.add('active'));

    document.getElementById('registerConfirmBtn').addEventListener('click', async () => {
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const pass = document.getElementById('regPass').value.trim();
        const security_question = document.getElementById('regSecurityQuestion').value;
        const security_answer = document.getElementById('regSecurityAnswer').value.trim();
        if (!name || !email || !pass) { alert('❌ Completa todos los campos obligatorios.'); return; }
        if (!security_question || !security_answer) { alert('❌ Selecciona una pregunta de seguridad y escribe la respuesta.'); return; }
        if (!isStrongPassword(pass)) return;
        try {
            await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password: pass, security_question, security_answer }) });
            alert('✅ Registro exitoso');
            closeModal('registerModal');
            document.getElementById('regName').value = '';
            document.getElementById('regEmail').value = '';
            document.getElementById('regPass').value = '';
            document.getElementById('regSecurityAnswer').value = '';
        } catch (e) { alert('Error: ' + e.message); }
    });

    document.getElementById('submitRequestBtn').addEventListener('click', async () => {
        const prod = document.getElementById('requestProduct').value.trim();
        const email = document.getElementById('requestEmail').value.trim();
        if (!prod || !email) { alert('Completa todos los campos.'); return; }
        try {
            await apiFetch('/requests', { method: 'POST', body: JSON.stringify({ product_name: prod, user_email: email }) });
            alert(`✅ Solicitud registrada.`);
            closeModal('requestModal');
        } catch (e) { alert('Error: ' + e.message); }
    });

    document.getElementById('showSecurityRecoveryBtn').addEventListener('click', () => {
        closeModal('forgotModal');
        document.getElementById('securityStep1').style.display = 'block';
        document.getElementById('securityStep2').style.display = 'none';
        document.getElementById('securityStep3').style.display = 'none';
        document.getElementById('securityRecoveryModal').classList.add('active');
    });

    document.getElementById('getSecurityQuestionBtn').addEventListener('click', async () => {
        const email = document.getElementById('recoveryEmail').value.trim();
        if (!email) { alert('Ingresa tu correo'); return; }
        try {
            const res = await fetch(`${API_URL}/auth/get-security-question`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
            const data = await res.json();
            if (res.ok) {
                document.getElementById('displaySecurityQuestion').innerHTML = `<strong>${data.question}</strong>`;
                document.getElementById('securityStep1').style.display = 'none';
                document.getElementById('securityStep2').style.display = 'block';
                window.recoveryEmail = email;
            } else { alert(data.message); }
        } catch (e) { alert('Error: ' + e.message); }
    });

    document.getElementById('resetWithSecurityBtn').addEventListener('click', async () => {
        const answer = document.getElementById('securityAnswer').value.trim();
        const newPass = document.getElementById('newPasswordRecovery').value;
        const confirmPass = document.getElementById('confirmPasswordRecovery').value;
        if (newPass !== confirmPass) { alert('❌ Las contraseñas no coinciden'); return; }
        try {
            const res = await fetch(`${API_URL}/auth/reset-with-security`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: window.recoveryEmail, answer, newPassword: newPass }) });
            const data = await res.json();
            if (res.ok) {
                document.getElementById('securityStep2').style.display = 'none';
                document.getElementById('securityStep3').style.display = 'block';
            } else { alert(data.message); }
        } catch (e) { alert('Error: ' + e.message); }
    });

    const savePromoBtn = document.getElementById('savePromoEditBtn');
    if (savePromoBtn) {
        savePromoBtn.removeEventListener('click', savePromotionEdit);
        savePromoBtn.addEventListener('click', savePromotionEdit);
    }

    ['registerModal', 'requestModal', 'forgotModal', 'securityRecoveryModal', 'editPromoModal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal(id);
            });
        }
    });
}

// ============================================================
//  INACTIVIDAD
// ============================================================
let inactivityTimer;
function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (!currentToken) return;
    inactivityTimer = setTimeout(() => {
        if (currentToken) { alert('⚠️ Sesión expirada por inactividad'); logout(); }
    }, 30 * 60 * 1000);
}
function startInactivityTracking() {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(event => { document.addEventListener(event, resetInactivityTimer); });
    resetInactivityTimer();
}
function stopInactivityTracking() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(event => { document.removeEventListener(event, resetInactivityTimer); });
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const savedToken = sessionStorage.getItem('drfashion_token');
    if (savedToken) {
        currentToken = savedToken;
        apiFetch('/auth/profile').then(user => { isAdmin = user.role === 'admin'; currentUserName = user.name; showView(user.role); }).catch(() => { sessionStorage.removeItem('drfashion_token'); showView(null); });
    } else { showView(null); }
    initLogin();
    initSearch();
    initModals();
document.getElementById('profileIcon').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('userDropdown').classList.toggle('open');
});
document.addEventListener('click', () => {
    document.getElementById('userDropdown')?.classList.remove('open');
});
document.getElementById('openFavoritesBtn').addEventListener('click', () => {
    document.getElementById('userDropdown').classList.remove('open');
    openFavoritesModal();
});

// ── FAVORITOS ────────────────────────────────────────────────
async function openFavoritesModal() {
    const grid = document.getElementById('favoritesGrid');
    const empty = document.getElementById('favoritesEmpty');
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#888;padding:20px;">Cargando...</p>';
    document.getElementById('favoritesModal').classList.add('active');

    try {
        const favs = await apiFetch('/favorites');
        grid.innerHTML = '';

        if (!favs.length) {
            grid.innerHTML = '<p id="favoritesEmpty" style="grid-column:1/-1;text-align:center;color:#888;padding:30px 0;">No tienes productos favoritos aún. 💙</p>';
            return;
        }

        favs.forEach(p => {
            const imgSrc = p.image_url?.startsWith('/assets')
                ? BACKEND_URL_IMAGES + p.image_url
                : p.image_url;
            const imgHtml = (imgSrc && !imgSrc.startsWith('http') === false && imgSrc.match(/\.(jpg|jpeg|png|webp|avif|gif)$/i))
                ? `<img src="${imgSrc}" alt="${p.name}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;background:#F5F5F5;">`
                : `<div class="fav-emoji">${p.image_url || '🛍️'}</div>`;

            const card = document.createElement('div');
            card.className = 'fav-card';
            card.innerHTML = `
                ${imgHtml}
                <div class="fav-name">${p.name}</div>
                <div class="fav-price">$${parseFloat(p.price).toFixed(2)}</div>
                <button class="fav-remove" onclick="removeFavoriteFromModal(${p.id}, this)">
                    ✕ Quitar de favoritos
                </button>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#c00;padding:20px;">Error al cargar favoritos.</p>';
    }
}

async function removeFavoriteFromModal(productId, btn) {
    try {
        await apiFetch(`/favorites/${productId}`, { method: 'DELETE' });

        // Quitar tarjeta del modal con animación
        const card = btn.closest('.fav-card');
        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => {
            card.remove();
            const grid = document.getElementById('favoritesGrid');
            if (!grid.querySelector('.fav-card')) {
                grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#888;padding:30px 0;">No tienes productos favoritos aún. 💙</p>';
            }
        }, 300);

        // Actualizar corazón en la grid de productos
        const heartBtn = document.querySelector(`.favorite-icon[data-id="${productId}"]`);
        if (heartBtn) {
            heartBtn.textContent = '♡';
            heartBtn.style.color = '';
        }
    } catch(e) {
        alert('Error al quitar favorito');
    }
}

});
