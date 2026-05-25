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
let activeCatInventory = 'Todos';
let activeCatEdit      = 'Todos';

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) { alert(message); return; }
    const colors = {
        success: { bg: '#2ecc71', icon: '✅' },
        error:   { bg: '#e74c3c', icon: '❌' },
        warning: { bg: '#f39c12', icon: '⚠️' },
        info:    { bg: '#3498db', icon: 'ℹ️' }
    };
    const { bg, icon } = colors[type] || colors.info;
    const toast = document.createElement('div');
    toast.style.cssText = `
        background:${bg}; color:#fff; padding:14px 20px; border-radius:12px;
        font-size:14px; font-weight:500; box-shadow:0 4px 16px rgba(0,0,0,0.2);
        display:flex; align-items:center; gap:10px; min-width:280px; max-width:380px;
        pointer-events:all; opacity:0; transform:translateX(40px);
        transition:opacity 0.3s ease, transform 0.3s ease;
    `;
    toast.innerHTML = `<span style="font-size:18px;">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; });
    setTimeout(() => {
        toast.style.opacity = '0'; toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

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
        showToast(`La contraseña debe tener al menos ${minLength} caracteres.`, 'error');
        return false;
    }
    if (!hasUpperCase) { showToast('Debe contener al menos una letra MAYÚSCULA.', 'error'); return false; }
    if (!hasLowerCase) { showToast('Debe contener al menos una letra minúscula.', 'error'); return false; }
    if (!hasNumbers) { showToast('Debe contener al menos un número.', 'error'); return false; }
    if (!hasSpecialChar) { showToast('Debe contener al menos un carácter especial (!@#$%^&*).', 'error'); return false; }
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
        showToast('Imagen actualizada correctamente', 'success');
    } catch (e) { 
        showToast('Error al actualizar imagen: ' + e.message, 'error'); 
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
            sessionStorage.setItem('papeleriastony_token', data.token);
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
        banner.innerHTML = promos.map(p => {
            const desde = p.valid_from ? new Date(p.valid_from).toLocaleDateString('es-MX', {day:'2-digit', month:'short', year:'numeric'}) : null;
            const hasta = p.valid_to   ? new Date(p.valid_to).toLocaleDateString('es-MX',   {day:'2-digit', month:'short', year:'numeric'}) : null;
            const vigencia = (desde && hasta) ? `<span style="font-size:12px;opacity:0.85;">📅 Vigencia: ${desde} – ${hasta}</span>` : '';
            return `<div><h3>🔥 ${p.title}</h3><p>${p.description || ''}${p.discount_percent ? ` — <strong>${p.discount_percent}% OFF</strong>` : ''}</p>${vigencia}</div>`;
        }).join('');
    } catch (e) { console.error('Promociones:', e); }
}

// ============================================================
//  PANEL ADMIN
// ============================================================
function refreshAdminTables() {
    const invBody = document.getElementById('inventoryBody');
    if (invBody) {
        invBody.innerHTML = products.map(p => `<tr data-category="${p.category}"><td>${p.image_url && p.image_url.startsWith('/assets/') ? '🖼️' : (p.image_url || '🛍️')} ${p.name}</td><td>${p.stock}</td><td><input type="number" class="stock-input" value="${p.stock}" min="0" data-id="${p.id}"></td></tr>`).join('');
    }
    const editBody = document.getElementById('editBody');
    if (editBody) {
        editBody.innerHTML = products.map(p => `
            <tr data-category="${p.category}">
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

function setCatFilterInventory(btn) {
    document.querySelectorAll('#categoryFilterInventory .cat-filter-btn')
        .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCatInventory = btn.dataset.cat;
    filterInventoryTable();
}

function setCatFilterEdit(btn) {
    document.querySelectorAll('#categoryFilterEdit .cat-filter-btn')
        .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCatEdit = btn.dataset.cat;
    filterEditTable();
}

function filterInventoryTable() {
    const searchTerm = normalize(document.getElementById('searchInventoryInput')?.value.trim() || '');
    const rows = document.querySelectorAll('#inventoryBody tr');
    rows.forEach(row => {
        const productName = normalize(row.cells[0]?.textContent || '');
        const productCat = row.dataset.category || '';
        const matchSearch = searchTerm === '' || productName.includes(searchTerm);
        const matchCat = activeCatInventory === 'Todos' || productCat === activeCatInventory;
        row.style.display = (matchSearch && matchCat) ? '' : 'none';
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
        const productCat = row.dataset.category || '';
        const matchSearch = searchTerm === '' || productName.includes(searchTerm);
        const matchCat = activeCatEdit === 'Todos' || productCat === activeCatEdit;
        row.style.display = (matchSearch && matchCat) ? '' : 'none';
    });
    const visibleRows = document.querySelectorAll('#editBody tr:not([style*="display: none"])');
    const countSpan = document.getElementById('editCount');
    if (countSpan) countSpan.textContent = `${visibleRows.length} de ${rows.length}`;
}

async function saveProductEdit(productId) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    document.getElementById('editProductName').value = prod.name;
    document.getElementById('editProductPrice').value = prod.price;
    document.getElementById('editProductModal').classList.add('active');
    document.getElementById('editProductConfirmBtn').onclick = async () => {
        const newName = document.getElementById('editProductName').value.trim();
        const newPrice = parseFloat(document.getElementById('editProductPrice').value);
        if (!newName) { showToast('El nombre no puede estar vacío', 'warning'); return; }
        if (isDuplicateProductName(newName, productId)) { showToast(`Ya existe otro producto con el nombre "${newName}"`, 'error'); return; }
        if (isNaN(newPrice)) { showToast('Precio inválido', 'error'); return; }
        closeModal('editProductModal');
        const fileInput = document.getElementById(`edit-file-${productId}`);
        const imageFile = fileInput ? fileInput.files[0] : null;
        const formData = new FormData();
        formData.append('name', newName);
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
            showToast('Producto actualizado correctamente', 'success');
        } catch (e) { showToast('Error al actualizar producto', 'error'); }
    };
}

async function saveAllImages() {
    const fileInputs = document.querySelectorAll('#editBody input[type="file"]');
    const pending = Array.from(fileInputs).filter(f => f.files.length > 0);
    if (pending.length === 0) { showToast('No hay imágenes nuevas para guardar', 'warning'); return; }
    const btn = document.getElementById('saveAllImagesBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Guardando...';
    let ok = 0, fail = 0;
    for (const input of pending) {
        const productId = input.dataset.id;
        const formData = new FormData();
        const prod = products.find(p => p.id === parseInt(productId));
        if (!prod) continue;
        formData.append('name', prod.name);
        formData.append('price', prod.price);
        formData.append('category', prod.category);
        formData.append('stock', prod.stock);
        formData.append('image', input.files[0]);
        try {
            const res = await fetch(`${API_URL}/products/${productId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${currentToken}` },
                body: formData
            });
            if (!res.ok) throw new Error();
            const updated = await res.json();
            const idx = products.findIndex(p => p.id === parseInt(productId));
            if (idx !== -1) products[idx] = updated;
            ok++;
        } catch (e) { fail++; }
    }
    btn.disabled = false;
    btn.textContent = '💾 Guardar todas las imágenes';
    refreshAdminTables();
    renderProducts();
    showToast(fail === 0 ? `${ok} imagen(es) guardada(s) correctamente` : `${ok} guardadas, ${fail} con error`, fail === 0 ? 'success' : 'warning');
}

async function deleteProduct(productId) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    document.getElementById('confirmDeleteTitle').textContent = '¿Eliminar producto?';
    document.getElementById('confirmDeleteMsg').textContent = `Se eliminará "${prod.name}" permanentemente.`;
    document.getElementById('confirmDeleteModal').classList.add('active');
    document.getElementById('confirmDeleteBtn').onclick = async () => {
        closeModal('confirmDeleteModal');
        try {
            await apiFetch(`/products/${productId}`, { method: 'DELETE' });
            products = products.filter(p => p.id !== productId);
            refreshAdminTables();
            renderProducts();
        } catch (e) { showToast('Error al eliminar producto', 'error'); }
    };
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
    } catch (e) { showToast('Error al cargar promoción', 'error'); }
}

async function savePromotionEdit() {
    const id = document.getElementById('editPromoId').value;
    const title = document.getElementById('editPromoTitle').value.trim();
    const description = document.getElementById('editPromoDesc').value.trim();
    const discount_percent = parseInt(document.getElementById('editPromoDiscount').value) || 0;
    const valid_from = document.getElementById('editPromoValidFrom').value || null;
    const valid_to = document.getElementById('editPromoValidTo').value || null;
    const is_active = document.getElementById('editPromoActive').checked;
    if (!title) { showToast('El título es obligatorio', 'warning'); return; }
    try {
        await apiFetch(`/promotions/${id}`, { method: 'PUT', body: JSON.stringify({ title, description, discount_percent, valid_from, valid_to, is_active }) });
        showToast('Promoción actualizada correctamente', 'success');
        closeModal('editPromoModal');
        loadAdminPromotions();
        loadPromotions();
    } catch (e) { showToast('Error al actualizar promoción', 'error'); }
}

async function deletePromotion(id) {
    document.getElementById('confirmDeleteTitle').textContent = '¿Eliminar promoción?';
    document.getElementById('confirmDeleteMsg').textContent = 'Esta acción no se puede deshacer.';
    document.getElementById('confirmDeleteModal').classList.add('active');
    document.getElementById('confirmDeleteBtn').onclick = async () => {
        closeModal('confirmDeleteModal');
        try {
            await apiFetch(`/promotions/${id}`, { method: 'DELETE' });
            loadAdminPromotions();
        } catch (e) { showToast('Error al eliminar promoción', 'error'); }
    };
}

async function createPromotion() {
    document.getElementById('newPromoTitle').value = '';
    document.getElementById('newPromoDesc').value = '';
    document.getElementById('newPromoDiscount').value = '20';
    document.getElementById('newPromoFrom').value = '';
    document.getElementById('newPromoTo').value = '';
    document.getElementById('newPromoActive').checked = true;
    document.getElementById('createPromoModal').classList.add('active');
}

document.getElementById('createPromoConfirmBtn').addEventListener('click', async () => {
    const title = document.getElementById('newPromoTitle').value.trim();
    const description = document.getElementById('newPromoDesc').value.trim();
    const discount = document.getElementById('newPromoDiscount').value;
    const valid_from = document.getElementById('newPromoFrom').value || null;
    const valid_to = document.getElementById('newPromoTo').value || null;
    const isActive = document.getElementById('newPromoActive').checked;
    if (!title) { showToast('El título es obligatorio', 'warning'); return; }
    try {
        await apiFetch('/promotions', { method: 'POST', body: JSON.stringify({ title, description, discount_percent: parseInt(discount) || 0, valid_from, valid_to, is_active: isActive }) });
        showToast('Promoción creada correctamente', 'success');
        closeModal('createPromoModal');
        loadAdminPromotions();
        loadPromotions();
    } catch (e) { showToast('Error al crear promoción', 'error'); }
});

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
    if (!name || !email || !password) { showToast('Completa todos los campos', 'warning'); return; }
    if (!isStrongPassword(password)) return;
    try {
        await apiFetch('/auth/register/admin', { method: 'POST', body: JSON.stringify({ name, email, password }) });
        showToast(`Administrador "${name}" creado correctamente`, 'success');
        document.getElementById('newAdminName').value = '';
        document.getElementById('newAdminEmail').value = '';
        document.getElementById('newAdminPass').value = '';
        loadAdmins();
    } catch (e) { showToast('Error al crear administrador', 'error'); }
}

async function deleteAdmin(adminId) {
    try {
        const currentUser = await apiFetch('/auth/profile');
        if (currentUser.id === adminId) { showToast('No puedes eliminarte a ti mismo', 'error'); return; }
    } catch (e) { console.error(e); }
    document.getElementById('confirmDeleteTitle').textContent = '¿Eliminar administrador?';
    document.getElementById('confirmDeleteMsg').textContent = 'Se eliminará este administrador del sistema.';
    document.getElementById('confirmDeleteModal').classList.add('active');
    document.getElementById('confirmDeleteBtn').onclick = async () => {
        closeModal('confirmDeleteModal');
        try {
            await apiFetch(`/admin/users/${adminId}`, { method: 'DELETE' });
            showToast('Administrador eliminado', 'success');
            loadAdmins();
        } catch (e) { showToast('Error al eliminar: ' + e.message, 'error'); }
    };
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
            if (!name || isNaN(price)) { showToast('Completa nombre y precio', 'warning'); return; }
            if (isDuplicateProductName(name)) { showToast(`Ya existe un producto con el nombre "${name}"`, 'error'); return; }
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
                showToast(`Producto "${name}" agregado correctamente`, 'success');
                limpiarFormAgregar();
            } catch (e) { showToast('Error: ' + e.message, 'error'); }
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
                showToast('Stock actualizado correctamente', 'success'); refreshAdminTables();
            } catch (e) { showToast('Error al actualizar stock', 'error'); }
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
    document.getElementById('showForgotBtn').addEventListener('click', () => {
        document.getElementById('forgotStep1').style.display = 'block';
        document.getElementById('forgotStep2').style.display = 'none';
        document.getElementById('forgotEmail').value = '';
        document.getElementById('forgotModal').classList.add('active');
    });
    
    document.getElementById('sendResetEmailBtn').addEventListener('click', async () => {
        const email = document.getElementById('forgotEmail').value.trim();
        if (!email) { showToast('Ingresa tu correo', 'warning'); return; }
        try {
            const res = await fetch(`${API_URL}/auth/forgot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (res.ok) {
                document.getElementById('forgotStep1').style.display = 'none';
                document.getElementById('forgotStep2').style.display = 'block';
            } else {
                showToast(data.message || 'Error al enviar correo', 'error');
            }
        } catch (e) { showToast('Error de conexión', 'error'); }
    });
    
    document.getElementById('requestBtn').addEventListener('click', async () => {
        document.getElementById('requestModal').classList.add('active');
        document.getElementById('requestProduct').value = '';
        document.getElementById('requestSuggestions').style.display = 'none';
        try {
            const user = await apiFetch('/auth/profile');
            document.getElementById('requestEmail').value = user.email;
        } catch (e) {}
    });

    document.getElementById('registerConfirmBtn').addEventListener('click', async () => {
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const pass = document.getElementById('regPass').value.trim();
        const security_question = document.getElementById('regSecurityQuestion').value;
        const security_answer = document.getElementById('regSecurityAnswer').value.trim();
        if (!name || !email || !pass) { showToast('Completa todos los campos obligatorios', 'warning'); return; }
        if (!security_question || !security_answer) { showToast('Selecciona una pregunta de seguridad y escribe la respuesta', 'warning'); return; }
        if (!isStrongPassword(pass)) return;
        try {
            await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password: pass, security_question, security_answer }) });
            showToast('Registro exitoso. ¡Bienvenido!', 'success');
            closeModal('registerModal');
            document.getElementById('regName').value = '';
            document.getElementById('regEmail').value = '';
            document.getElementById('regPass').value = '';
            document.getElementById('regSecurityAnswer').value = '';
        } catch (e) { showToast('Error: ' + e.message, 'error'); }
    });

        // Buscador de productos agotados en el modal de solicitud
    document.getElementById('requestProduct').addEventListener('input', function () {
        const term = normalize(this.value.trim());
        const list = document.getElementById('requestSuggestions');
        if (!term) { list.style.display = 'none'; return; }
        const agotados = products.filter(p => p.stock === 0 && normalize(p.name).includes(term));
        if (agotados.length === 0) { list.style.display = 'none'; return; }
        list.innerHTML = agotados.map(p => `<li data-name="${p.name}" style="padding:10px 14px; cursor:pointer; border-bottom:1px solid #f0f0f0; font-size:14px;">${p.name}</li>`).join('');
        list.style.display = 'block';
        list.querySelectorAll('li').forEach(li => {
            li.addEventListener('mouseenter', () => li.style.background = '#f5f5f5');
            li.addEventListener('mouseleave', () => li.style.background = '#fff');
            li.addEventListener('click', () => {
                document.getElementById('requestProduct').value = li.dataset.name;
                list.style.display = 'none';
            });
        });
    });
    
    document.getElementById('submitRequestBtn').addEventListener('click', async () => {
        const prod = document.getElementById('requestProduct').value.trim();
        const email = document.getElementById('requestEmail').value.trim();
        if (!prod || !email) { showToast('Completa todos los campos', 'warning'); return; }
        const existe = products.some(p => p.stock === 0 && p.name === prod);
        if (!existe) { alert('Por favor selecciona un producto de la lista.'); return; }
        try {
            await apiFetch('/requests', { method: 'POST', body: JSON.stringify({ product_name: prod, user_email: email }) });
            showToast('Solicitud registrada. Te avisaremos cuando haya existencia', 'success');
            closeModal('requestModal');
        } catch (e) { showToast('Error: ' + e.message, 'error'); }
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
        if (!email) { showToast('Ingresa tu correo', 'warning'); return; }
        try {
            const res = await fetch(`${API_URL}/auth/get-security-question`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
            const data = await res.json();
            if (res.ok) {
                document.getElementById('displaySecurityQuestion').innerHTML = `<strong>${data.question}</strong>`;
                document.getElementById('securityStep1').style.display = 'none';
                document.getElementById('securityStep2').style.display = 'block';
                window.recoveryEmail = email;
            } else { showToast(data.message, data.success ? 'success' : 'error'); }
        } catch (e) { showToast('Error: ' + e.message, 'error'); }
    });

    document.getElementById('resetWithSecurityBtn').addEventListener('click', async () => {
        const answer = document.getElementById('securityAnswer').value.trim();
        const newPass = document.getElementById('newPasswordRecovery').value;
        const confirmPass = document.getElementById('confirmPasswordRecovery').value;
        if (newPass !== confirmPass) { showToast('Las contraseñas no coinciden', 'error'); return; }
        try {
            const res = await fetch(`${API_URL}/auth/reset-with-security`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: window.recoveryEmail, answer, newPassword: newPass }) });
            const data = await res.json();
            if (res.ok) {
                document.getElementById('securityStep2').style.display = 'none';
                document.getElementById('securityStep3').style.display = 'block';
            } else { showToast(data.message, data.success ? 'success' : 'error'); }
        } catch (e) { showToast('Error: ' + e.message, 'error'); }
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
        if (currentToken) { showToast('Sesión expirada por inactividad', 'warning'); logout(); }
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
    const savedToken = sessionStorage.getItem('papeleriastony_token');
    if (savedToken) {
        currentToken = savedToken;
        apiFetch('/auth/profile').then(user => { isAdmin = user.role === 'admin'; currentUserName = user.name; showView(user.role); }).catch(() => { sessionStorage.removeItem('papeleriastony_token'); showView(null); });
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
window.openFavoritesModal = async function() {
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

window.removeFavoriteFromModal = async function(productId, btn) {
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
        showToast('Error al quitar favorito', 'error');
    }
}

});
