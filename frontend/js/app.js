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
let saleCart = [];
let sellerInitialized = false;
let currentUserId = null;

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
                    ${p.stock > 0 ? `<button onclick="addToUserCart({id:${p.id},name:'${p.name.replace(/'/g,"\\'")}',price:${p.price},stock:${p.stock}})" style="margin-top:8px;width:100%;background:#2f2c79;color:#fff;border:none;border-radius:10px;padding:7px 0;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">🛒 Agregar al carrito</button>` : ''}
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
//  VALIDACIONES DE CAMPOS
// ============================================================
function blockInvalidNumKey(e) {
    // Bloquea 'e', 'E', '+' en inputs numéricos
    if (e.key === 'e' || e.key === 'E' || e.key === '+') {
        e.preventDefault();
    }
}

function limitDigitsInName(input) {
    // Máximo 3 dígitos consecutivos en el nombre de producto
    const val = input.value;
    const fixed = val.replace(/(\d{4,})/g, (match) => match.slice(0, 3));
    if (fixed !== val) {
        input.value = fixed;
        showToast('El nombre no puede tener más de 3 dígitos consecutivos', 'warning');
    }
}

// ============================================================
//  AUTENTICACIÓN
// ============================================================
function showView(role) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('userView').classList.remove('active');
    document.getElementById('adminView').classList.remove('active');
    document.getElementById('sellerView').style.display = 'none';
    document.getElementById('requestBtn').style.display = 'none';
    if (role === 'admin') {
        document.getElementById('adminView').classList.add('active');
        const adminSpan = document.getElementById('adminNameSpan');
        if (adminSpan && currentUserName) adminSpan.textContent = '| ' + currentUserName.split(' ')[0];
        initAdminPanel();
        startInactivityTracking();
    } else if (role === 'seller') {
        document.getElementById('sellerView').style.display = 'block';
        document.getElementById('sellerName').textContent = '| ' + currentUserName.split(' ')[0];
        initSellerPanel();
        startInactivityTracking();
    } else if (role === 'user') {
        document.getElementById('userView').classList.add('active');
        document.getElementById('requestBtn').style.display = 'flex';
        loadUserCartFromStorage();
        loadUserAvatar();
        renderCartFloatingBtn();
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
    document.getElementById('sellerView').style.display = 'none';
    document.getElementById('requestBtn').style.display = 'none';
    activeCategory = 'Todo';
    isAdmin = false;
    adminInitialized = false;
    sellerInitialized = false;
    currentToken = null;
    currentUserId = null;
    saleCart = [];
    userCart = [];
    products = [];
    sessionStorage.removeItem('papeleriastony_token');
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPass').value = '';
    // Eliminar botón flotante de carrito del DOM al cerrar sesión
    const floatingBtn = document.getElementById('cartFloatingBtn');
    if (floatingBtn) floatingBtn.remove();
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
            currentUserId = data.user.id;
            showView(data.user.role);
        } catch (e) {
            msgEl.className = 'message error';
            msgEl.textContent = e.message || 'Correo o contraseña incorrectos.';
        }
    });
    document.getElementById('loginPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn.click(); });
    document.getElementById('logoutUserBtn').addEventListener('click', logout);
    document.getElementById('logoutAdminBtn').addEventListener('click', logout);
    document.getElementById('logoutSellerBtn').addEventListener('click', logout);
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
        if (isNaN(newPrice) || newPrice <= 0) { showToast('El precio debe ser mayor a 0', 'warning'); return; }
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
        const usageLabel = p => {
            if (p.usage_type === 'unico') return '1 uso por persona';
            if (p.usage_type === 'limitado') return `${p.uses_count || 0}/${p.usage_limit} usos`;
            return 'Indefinido';
        };
        list.innerHTML = promos.length === 0 ? '<p>No hay promociones.</p>' : promos.map(p => `
            <div style="background:#F5F5F5;border-radius:12px;padding:12px;margin-bottom:10px;border:1px solid #E0E0E0;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
                    <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <strong>${p.title}</strong>
                            <span style="background:#0033A0;color:#fff;border-radius:20px;padding:2px 10px;font-size:12px;">${p.discount_percent ?? 0}% OFF</span>
                            <span style="background:${p.is_active ? '#27ae60' : '#aaa'};color:#fff;border-radius:20px;padding:2px 10px;font-size:12px;">${p.is_active ? '✅ Activa' : '⏸ Inactiva'}</span>
                            <span style="background:#F39C12;color:#fff;border-radius:20px;padding:2px 10px;font-size:12px;">📂 ${p.category || 'Todas'}</span>
                            <span style="background:#8e44ad;color:#fff;border-radius:20px;padding:2px 10px;font-size:12px;">🔁 ${usageLabel(p)}</span>
                        </div>
                        <div style="font-size:13px;color:#555;margin-top:4px;">${p.description || ''}</div>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button onclick="openEditPromoModal(${p.id})" style="background:#0033A0;color:white;border:none;border-radius:20px;padding:4px 12px;cursor:pointer;">✏️ Editar</button>
                        <button onclick="deletePromotion(${p.id})" style="background:#E3000F;color:white;border:none;border-radius:20px;padding:4px 12px;cursor:pointer;">🗑️ Eliminar</button>
                    </div>
                </div>
            </div>`).join('');
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
        document.getElementById('editPromoCategory').value = promo.category || 'Todas';
        document.getElementById('editPromoUsageType').value = promo.usage_type || 'indefinido';
        document.getElementById('editPromoUsageLimit').value = promo.usage_limit || '';
        toggleEditUsageLimitVisibility();
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
    const category = document.getElementById('editPromoCategory').value || 'Todas';
    const usage_type = document.getElementById('editPromoUsageType').value || 'indefinido';
    const usage_limit = usage_type === 'limitado' ? (parseInt(document.getElementById('editPromoUsageLimit').value) || null) : null;
    if (!title) { showToast('El título es obligatorio', 'warning'); return; }
    try {
        await apiFetch(`/promotions/${id}`, { method: 'PUT', body: JSON.stringify({ title, description, discount_percent, valid_from, valid_to, is_active, category, usage_type, usage_limit }) });
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
        const newCategory = document.getElementById('newPromoCategory').value || 'Todas';
        const newUsageType = document.getElementById('newPromoUsageType').value || 'indefinido';
        const newUsageLimit = newUsageType === 'limitado' ? (parseInt(document.getElementById('newPromoUsageLimit').value) || null) : null;
        await apiFetch('/promotions', { method: 'POST', body: JSON.stringify({ title, description, discount_percent: parseInt(discount) || 0, valid_from, valid_to, is_active: isActive, category: newCategory, usage_type: newUsageType, usage_limit: newUsageLimit }) });
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
            ['add','inventory','edit','promos','admins','sellers'].forEach(tab => {
                const el = document.getElementById('tab-' + tab);
                if (el) el.style.display = (tab === item.dataset.tab) ? 'block' : 'none';
            });
            if (item.dataset.tab === 'inventory') refreshAdminTables();
            if (item.dataset.tab === 'edit') refreshAdminTables();
            if (item.dataset.tab === 'promos') loadAdminPromotions();
            if (item.dataset.tab === 'admins') loadAdmins();
            if (item.dataset.tab === 'sellers') loadSellers();
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
            if (price < 0) { showToast('El precio no puede ser negativo', 'warning'); return; }
            if (price === 0) { showToast('El precio debe ser mayor a 0', 'warning'); return; }
            if (stock <= 0) { showToast('El stock debe ser mayor a 0 para agregar el producto', 'warning'); return; }
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
    const createSellerBtn = document.getElementById('createSellerBtn');
    if (createSellerBtn) createSellerBtn.addEventListener('click', createSeller);
    adminInitialized = true;
}

function limpiarFormAgregar() {
    ['prodName','prodPrice','prodStock','prodIcon'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('prodImage').value = '';
}


// ============================================================
//  CARRITO PERSISTENTE DEL USUARIO
// ============================================================
let userCart = [];   // [{id, name, price, stock, quantity}]

function addToUserCart(product) {
    const existing = userCart.find(i => i.id === product.id);
    if (existing) {
        if (existing.quantity >= product.stock) { showToast('Stock máximo alcanzado', 'warning'); return; }
        existing.quantity++;
    } else {
        userCart.push({ ...product, quantity: 1 });
    }
    saveUserCartToStorage();
    updateCartBadge();
    showToast(`${product.name} añadido al carrito`, 'success');
}

async function saveUserCartToStorage() {
    // Persiste en BD via API; también en sessionStorage como caché local
    sessionStorage.setItem('userCart_' + currentUserId, JSON.stringify(userCart));
    try {
        await apiFetch('/auth/user-cart', { method: 'PUT', body: JSON.stringify({ cart: userCart }) });
    } catch (e) {
        console.warn('No se pudo sincronizar carrito con servidor:', e.message);
    }
}

async function loadUserAvatar() {
    try {
        const profile = await apiFetch('/auth/profile');
        if (profile.avatar_url) {
            const url = profile.avatar_url.startsWith('/assets/')
                ? BACKEND_URL + profile.avatar_url
                : profile.avatar_url;
            const iconEl = document.getElementById('profileIcon');
            if (iconEl) {
                iconEl.style.backgroundImage = `url(${url})`;
                iconEl.style.backgroundSize = 'cover';
                iconEl.style.backgroundPosition = 'center';
                iconEl.style.borderRadius = '50%';
                iconEl.className = '';
                iconEl.style.width = '32px';
                iconEl.style.height = '32px';
                iconEl.style.display = 'inline-block';
                iconEl.style.cursor = 'pointer';
            }
        }
    } catch (_) {}
}

async function loadUserCartFromStorage() {
    if (!currentUserId) return;
    // Primero cargar de sessionStorage para respuesta inmediata
    const cached = sessionStorage.getItem('userCart_' + currentUserId);
    userCart = cached ? JSON.parse(cached) : [];
    updateCartBadge();
    // Luego sincronizar con BD (fuente de verdad)
    try {
        const data = await apiFetch('/auth/user-cart');
        if (data.cart && Array.isArray(data.cart)) {
            userCart = data.cart;
            sessionStorage.setItem('userCart_' + currentUserId, JSON.stringify(userCart));
            updateCartBadge();
        }
    } catch (e) {
        console.warn('No se pudo cargar carrito desde servidor:', e.message);
    }
}

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const total = userCart.reduce((s, i) => s + i.quantity, 0);
    if (total > 0) {
        badge.textContent = total;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
    // Actualizar también el badge del botón flotante
    const floatBadge = document.getElementById('cartFloatBadge');
    if (floatBadge) {
        floatBadge.textContent = total;
        floatBadge.style.display = total > 0 ? 'flex' : 'none';
    }
}

function renderCartFloatingBtn() {
    // Inyectar botón flotante de carrito si no existe
    if (document.getElementById('cartFloatingBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'cartFloatingBtn';
    btn.className = 'cart-floating-btn';
    btn.innerHTML = `<i class="fas fa-shopping-cart"></i> <span class="cart-float-label">Mi Carrito</span><span id="cartFloatBadge" style="display:none;position:absolute;top:-6px;right:-6px;background:#E3000F;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:800;align-items:center;justify-content:center;">${userCart.reduce((s,i)=>s+i.quantity,0)}</span>`;
    btn.style.cssText = 'position:fixed;bottom:85px;right:25px;background:#2f2c79;color:#fff;border:none;border-radius:60px;padding:12px 22px;font-family:Montserrat,sans-serif;font-weight:700;font-size:0.88rem;cursor:pointer;display:flex;align-items:center;gap:8px;z-index:100;box-shadow:0 4px 20px rgba(0,0,0,0.2);transition:transform 0.2s,background 0.2s;';
    btn.addEventListener('click', openCartModal);
    btn.addEventListener('mouseenter', () => btn.style.transform = 'translateY(-2px)');
    btn.addEventListener('mouseleave', () => btn.style.transform = '');
    document.querySelector('.main-wrapper') ? document.querySelector('.main-wrapper').appendChild(btn) : document.body.appendChild(btn);
    updateCartBadge();
}

function openCartModal() {
    document.getElementById('userDropdown').classList.remove('open');
    const body = document.getElementById('cartModalBody');
    const totalEl = document.getElementById('cartModalTotal');
    document.getElementById('cartModal').classList.add('active');

    if (!userCart.length) {
        body.innerHTML = '<p style="text-align:center;color:#aaa;padding:30px 0;">Tu carrito está vacío. 🛒</p>';
        totalEl.textContent = '';
        return;
    }

    body.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="background:#f5f5f5;">
                <th style="padding:8px;text-align:left;">Producto</th>
                <th style="padding:8px;text-align:center;">Precio</th>
                <th style="padding:8px;text-align:center;">Cantidad</th>
                <th style="padding:8px;text-align:right;">Subtotal</th>
                <th style="padding:8px;"></th>
            </tr></thead>
            <tbody>${userCart.map((item, idx) => `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px;">${item.name}</td>
                    <td style="padding:8px;text-align:center;">$${item.price.toFixed(2)}</td>
                    <td style="padding:8px;text-align:center;">
                        <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
                            <button onclick="changeUserCartQty(${idx},-1)" style="background:#eee;border:none;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:16px;">−</button>
                            <span>${item.quantity}</span>
                            <button onclick="changeUserCartQty(${idx},1)" style="background:#eee;border:none;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:16px;">+</button>
                        </div>
                    </td>
                    <td style="padding:8px;text-align:right;font-weight:bold;">$${(item.price * item.quantity).toFixed(2)}</td>
                    <td style="padding:8px;text-align:center;"><button onclick="removeFromUserCart(${idx})" style="background:none;border:none;cursor:pointer;color:#e74c3c;font-size:16px;">🗑️</button></td>
                </tr>`).join('')}
            </tbody>
        </table>`;
    const total = userCart.reduce((s, i) => s + i.price * i.quantity, 0);
    totalEl.textContent = `Total: $${total.toFixed(2)}`;
}

function changeUserCartQty(idx, delta) {
    userCart[idx].quantity += delta;
    if (userCart[idx].quantity <= 0) userCart.splice(idx, 1);
    else if (userCart[idx].quantity > userCart[idx].stock) {
        userCart[idx].quantity = userCart[idx].stock;
        showToast('Stock máximo alcanzado', 'warning');
    }
    saveUserCartToStorage();
    updateCartBadge();
    openCartModal();
}

function removeFromUserCart(idx) {
    userCart.splice(idx, 1);
    saveUserCartToStorage();
    updateCartBadge();
    openCartModal();
}


// ============================================================
//  PERFIL DE USUARIO (foto de perfil)
// ============================================================
async function openProfileModal() {
    document.getElementById('userDropdown').classList.remove('open');
    try {
        const profile = await apiFetch('/auth/profile');
        document.getElementById('profileNameDisplay').textContent = profile.name;
        document.getElementById('profileEmailDisplay').textContent = profile.email;
        if (profile.avatar_url) {
            const avatarUrl = profile.avatar_url.startsWith('/assets/')
                ? BACKEND_URL + profile.avatar_url
                : profile.avatar_url;
            document.getElementById('profileAvatarImg').src = avatarUrl;
            document.getElementById('profileAvatarImg').style.display = 'block';
            document.getElementById('profileAvatarIcon').style.display = 'none';
        } else {
            document.getElementById('profileAvatarImg').style.display = 'none';
            document.getElementById('profileAvatarIcon').style.display = 'block';
        }
    } catch (e) { console.error(e); }
    document.getElementById('profileModal').classList.add('active');
}

async function saveProfileAvatar() {
    const file = document.getElementById('profileAvatarInput').files[0];
    if (!file) { showToast('Selecciona una imagen primero', 'warning'); return; }
    if (file.size > 2 * 1024 * 1024) { showToast('La imagen no debe superar 2MB', 'warning'); return; }
    const fd = new FormData();
    fd.append('avatar', file);
    try {
        const res = await fetch(`${API_URL}/auth/avatar`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${currentToken}` },
            body: fd
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        // Show preview immediately — ensure absolute URL
        const url = data.avatar_url.startsWith('/assets/')
            ? BACKEND_URL + data.avatar_url
            : data.avatar_url;
        document.getElementById('profileAvatarImg').src = url;
        document.getElementById('profileAvatarImg').style.display = 'block';
        document.getElementById('profileAvatarIcon').style.display = 'none';
        // Also update profile icon in header
        const iconEl = document.getElementById('profileIcon');
        if (iconEl) {
            iconEl.style.backgroundImage = `url(${url})`;
            iconEl.style.backgroundSize = 'cover';
            iconEl.style.backgroundPosition = 'center';
            iconEl.style.borderRadius = '50%';
            iconEl.className = '';
            iconEl.style.width = '32px';
            iconEl.style.height = '32px';
            iconEl.style.display = 'inline-block';
        }
        showToast('Foto de perfil actualizada', 'success');
    } catch (e) { showToast('Error al guardar foto de perfil', 'error'); }
}

// ============================================================
//  PANEL VENDEDOR
// ============================================================

// ============================================================
//  PROMOCIONES — helpers UI
// ============================================================
function toggleEditUsageLimitVisibility() {
    const type = document.getElementById('editPromoUsageType') ? document.getElementById('editPromoUsageType').value : '';
    const wrap = document.getElementById('editPromoUsageLimitWrap');
    if (wrap) wrap.style.display = type === 'limitado' ? 'block' : 'none';
}
function toggleNewUsageLimitVisibility() {
    const type = document.getElementById('newPromoUsageType') ? document.getElementById('newPromoUsageType').value : '';
    const wrap = document.getElementById('newPromoUsageLimitWrap');
    if (wrap) wrap.style.display = type === 'limitado' ? 'block' : 'none';
}

// Selector de promoción en venta del vendedor
let selectedPromoForSale = null;
async function loadSellerPromos() {
    try {
        const promos = await apiFetch('/promotions/active-seller');
        const sel = document.getElementById('salePromoSelect');
        if (!sel) return;
        sel.innerHTML = '<option value="">— Sin promoción —</option>' +
            promos.map(p => {
                const catLabel = p.category && p.category !== 'Todas' ? ` [${p.category}]` : '';
                const usageLabel = p.usage_type === 'unico' ? ' (uso único)' :
                                   p.usage_type === 'limitado' ? ` (${p.uses_count}/${p.usage_limit} usos)` : '';
                return `<option value="${p.id}" data-discount="${p.discount_percent}" data-category="${p.category || 'Todas'}">${p.title} — ${p.discount_percent}% OFF${catLabel}${usageLabel}</option>`;
            }).join('');
        sel.onchange = () => {
            const opt = sel.options[sel.selectedIndex];
            if (!opt.value) {
                selectedPromoForSale = null;
            } else {
                selectedPromoForSale = {
                    id: parseInt(opt.value),
                    discount: parseFloat(opt.dataset.discount) || 0,
                    category: opt.dataset.category || 'Todas'
                };
            }
            renderCart();
        };
    } catch(e) { console.error('loadSellerPromos:', e); }
}

async function initSellerPanel() {
    if (sellerInitialized) { loadSellerOrders(); return; }
    sellerInitialized = true;

    await loadProducts();

    // Buscador de productos
    document.getElementById('saleProductSearch').addEventListener('input', function () {
        const term = normalize(this.value.trim());
        const list = document.getElementById('saleProductSuggestions');
        if (!term) { list.style.display = 'none'; return; }
        const found = products.filter(p => p.stock > 0 && normalize(p.name).includes(term)).slice(0, 10);
        if (!found.length) { list.style.display = 'none'; return; }
        list.innerHTML = found.map(p => `
            <li data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-stock="${p.stock}"
                style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:14px;display:flex;justify-content:space-between;">
                <span>${p.name}</span>
                <span style="color:#2f2c79;font-weight:bold;">$${parseFloat(p.price).toFixed(2)} <small style="color:#888;">(${p.stock} disponibles)</small></span>
            </li>`).join('');
        list.style.display = 'block';
        list.querySelectorAll('li').forEach(li => {
            li.addEventListener('mouseenter', () => li.style.background = '#f5f5f5');
            li.addEventListener('mouseleave', () => li.style.background = '#fff');
            li.addEventListener('click', () => {
                addToCart({ id: parseInt(li.dataset.id), name: li.dataset.name, price: parseFloat(li.dataset.price), stock: parseInt(li.dataset.stock) });
                document.getElementById('saleProductSearch').value = '';
                list.style.display = 'none';
            });
        });
    });

    document.getElementById('confirmSaleBtn').addEventListener('click', confirmSale);
    loadSellerOrders();
    loadSellerPromos();
}

function addToCart(product) {
    const existing = saleCart.find(i => i.id === product.id);
    if (existing) {
        if (existing.quantity >= product.stock) { showToast('Stock máximo alcanzado', 'warning'); return; }
        existing.quantity++;
    } else {
        saleCart.push({ ...product, quantity: 1 });
    }
    renderCart();
}

function renderCart() {
    const container = document.getElementById('saleCart');
    if (!saleCart.length) {
        container.innerHTML = '<p style="color:#aaa;font-size:14px;">No hay productos en el carrito.</p>';
        document.getElementById('saleTotal').textContent = '0.00';
        return;
    }
    container.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="background:#f5f5f5;">
                <th style="padding:8px;text-align:left;">Producto</th>
                <th style="padding:8px;text-align:center;">Precio</th>
                <th style="padding:8px;text-align:center;">Cantidad</th>
                <th style="padding:8px;text-align:right;">Subtotal</th>
                <th style="padding:8px;"></th>
            </tr></thead>
            <tbody>${saleCart.map((item, idx) => `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px;">${item.name}</td>
                    <td style="padding:8px;text-align:center;">$${item.price.toFixed(2)}</td>
                    <td style="padding:8px;text-align:center;">
                        <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
                            <button onclick="changeCartQty(${idx},-1)" style="background:#eee;border:none;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:16px;">−</button>
                            <span>${item.quantity}</span>
                            <button onclick="changeCartQty(${idx},1)" style="background:#eee;border:none;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:16px;">+</button>
                        </div>
                    </td>
                    <td style="padding:8px;text-align:right;font-weight:bold;">$${(item.price * item.quantity).toFixed(2)}</td>
                    <td style="padding:8px;text-align:center;"><button onclick="removeFromCart(${idx})" style="background:none;border:none;cursor:pointer;color:#e74c3c;font-size:16px;">🗑️</button></td>
                </tr>`).join('')}
            </tbody>
        </table>`;
    const subtotal = saleCart.reduce((s, i) => s + i.price * i.quantity, 0);
    let discount = 0;
    let discountLabel = '';
    if (selectedPromoForSale) {
        // Calcular descuento: si la promo aplica a categoría específica, solo en esos productos
        if (selectedPromoForSale.category === 'Todas') {
            discount = subtotal * (selectedPromoForSale.discount / 100);
            discountLabel = `— ${selectedPromoForSale.discount}% OFF (todas las categorías)`;
        } else {
            const catItems = saleCart.filter(i => (i.category || '') === selectedPromoForSale.category);
            const catSubtotal = catItems.reduce((s, i) => s + i.price * i.quantity, 0);
            discount = catSubtotal * (selectedPromoForSale.discount / 100);
            discountLabel = `— ${selectedPromoForSale.discount}% OFF en ${selectedPromoForSale.category}`;
        }
    }
    const total = subtotal - discount;
    const saleTotalEl = document.getElementById('saleTotal');
    if (saleTotalEl) {
        if (discount > 0) {
            saleTotalEl.innerHTML = `<span style="text-decoration:line-through;color:#aaa;font-size:13px;">$${subtotal.toFixed(2)}</span> <span style="color:#27ae60;font-weight:800;">$${total.toFixed(2)}</span> <span style="font-size:12px;color:#27ae60;">${discountLabel}</span>`;
        } else {
            saleTotalEl.textContent = total.toFixed(2);
        }
    }
}

function changeCartQty(idx, delta) {
    saleCart[idx].quantity += delta;
    if (saleCart[idx].quantity <= 0) saleCart.splice(idx, 1);
    else if (saleCart[idx].quantity > saleCart[idx].stock) { saleCart[idx].quantity = saleCart[idx].stock; showToast('Stock máximo alcanzado', 'warning'); }
    renderCart();
}

function removeFromCart(idx) {
    saleCart.splice(idx, 1);
    renderCart();
}

async function loadCustomerCart() {
    const email = document.getElementById('saleCustomerEmail').value.trim();
    if (!email) { showToast('Ingresa el correo del cliente', 'warning'); return; }
    try {
        const result = await apiFetch(`/auth/customer-cart?email=${encodeURIComponent(email)}`);
        if (!result.cart || !result.cart.length) {
            showToast('Este cliente no tiene productos en su carrito', 'info'); return;
        }
        // Merge con carrito actual del vendedor
        result.cart.forEach(item => {
            const existing = saleCart.find(i => i.id === item.id);
            if (existing) {
                existing.quantity = Math.min(existing.quantity + item.quantity, item.stock);
            } else {
                saleCart.push({ id: item.id, name: item.name, price: item.price, stock: item.stock, quantity: item.quantity });
            }
        });
        renderCart();
        showToast(`Carrito de ${result.userName} cargado (${result.cart.length} producto${result.cart.length > 1 ? 's' : ''})`, 'success');
    } catch (e) {
        showToast(e.message || 'No se encontró el usuario o no tiene carrito', 'error');
    }
}

async function confirmSale() {
    if (!saleCart.length) { showToast('Agrega al menos un producto', 'warning'); return; }
    const customer_name = document.getElementById('saleCustomerName').value.trim();
    const customer_email = document.getElementById('saleCustomerEmail').value.trim();
    const notes = document.getElementById('saleNotes').value.trim();

    // Calcular totales con descuento
    const subtotal = saleCart.reduce((s, i) => s + i.price * i.quantity, 0);
    let finalTotal = subtotal;
    let promoNotes = '';
    if (selectedPromoForSale) {
        let discount = 0;
        if (selectedPromoForSale.category === 'Todas') {
            discount = subtotal * (selectedPromoForSale.discount / 100);
            promoNotes = `Promo aplicada: ${selectedPromoForSale.discount}% OFF`;
        } else {
            const catItems = saleCart.filter(i => (i.category || '') === selectedPromoForSale.category);
            discount = catItems.reduce((s, i) => s + i.price * i.quantity, 0) * (selectedPromoForSale.discount / 100);
            promoNotes = `Promo aplicada: ${selectedPromoForSale.discount}% OFF en ${selectedPromoForSale.category}`;
        }
        finalTotal = subtotal - discount;
    }

    const items = saleCart.map(i => ({ product_id: i.id, product_name: i.name, quantity: i.quantity, unit_price: i.price }));
    const fullNotes = [notes, promoNotes].filter(Boolean).join(' | ');

    try {
        const order = await apiFetch('/orders', { method: 'POST', body: JSON.stringify({
            customer_name, customer_email, notes: fullNotes, items, total_override: finalTotal
        })});
        // Registrar uso de promoción si se aplicó
        if (selectedPromoForSale && order && order.id) {
            try {
                await apiFetch('/promotions/apply', { method: 'POST', body: JSON.stringify({
                    promotion_id: selectedPromoForSale.id,
                    order_id: order.id
                })});
            } catch(e) { console.warn('No se pudo registrar uso de promo:', e.message); }
        }
        showToast('Venta registrada correctamente', 'success');
        if (customer_email) showToast('Comprobante enviado al correo del cliente', 'info');
        saleCart = [];
        selectedPromoForSale = null;
        const promoSel = document.getElementById('salePromoSelect');
        if (promoSel) promoSel.value = '';
        renderCart();
        document.getElementById('saleCustomerName').value = '';
        document.getElementById('saleCustomerEmail').value = '';
        document.getElementById('saleNotes').value = '';
        await loadProducts();
        loadSellerOrders();
    } catch (e) { showToast(e.message || 'Error al registrar venta', 'error'); }
}

async function loadSellerOrders() {
    const container = document.getElementById('sellerOrdersList');
    try {
        const orders = await apiFetch('/orders');
        if (!orders.length) { container.innerHTML = '<p style="color:#aaa;font-size:14px;">No hay ventas registradas aún.</p>'; return; }
        container.innerHTML = orders.map(o => {
            // customer_email viene directo del JOIN en el modelo Order.findAll()
            const clientEmail = (o.customer_email || '').replace(/'/g, "\'");
            return `
            <div style="border:1px solid #eee;border-radius:12px;padding:16px;margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                    <div>
                        <span style="font-weight:bold;color:#2f2c79;">Pedido #${o.id}</span>
                        <span style="margin-left:12px;font-size:13px;color:#888;">${new Date(o.created_at).toLocaleString('es-MX')}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-weight:bold;color:#2f2c79;">$${parseFloat(o.total).toFixed(2)}</span>
                        <select onchange="updateOrderStatus(${o.id}, this.value, '${clientEmail}')" style="border:1px solid #ddd;border-radius:8px;padding:4px 8px;font-size:13px;">
                            ${['pendiente','completado','cancelado'].map(s => `<option value="${s}" ${o.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                ${o.notes ? `<p style="font-size:13px;color:#666;margin:8px 0 0;">${o.notes}</p>` : ''}
                <div style="margin-top:10px;font-size:13px;">
                    ${(o.items||[]).map(i => `<span style="display:inline-block;background:#f5f5f5;border-radius:6px;padding:3px 8px;margin:2px;">${i.product_name} x${i.quantity}</span>`).join('')}
                </div>
            </div>`;
        }).join('');
    } catch (e) { container.innerHTML = '<p style="color:#e74c3c;">Error al cargar ventas.</p>'; }
}

async function updateOrderStatus(orderId, status, clientEmail = '') {
    try {
        await apiFetch(`/orders/${orderId}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
        showToast('Estado actualizado', 'success');
        // Si la venta se marca como completada, limpiar el carrito del cliente
        if (status === 'completado' && clientEmail) {
            try {
                await apiFetch('/auth/clear-customer-cart', { method: 'DELETE', body: JSON.stringify({ email: clientEmail }) });
                showToast('Carrito del cliente limpiado', 'info');
            } catch (_) { /* silencioso si falla */ }
        }
    } catch (e) { showToast('Error al actualizar estado', 'error'); }
}


// ============================================================
//  GESTIÓN DE VENDEDORES (admin)
// ============================================================
async function loadSellers() {
    try {
        const sellers = await apiFetch('/admin/sellers');
        const tbody = document.getElementById('sellersListBody');
        if (!tbody) return;
        if (!sellers.length) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#aaa;padding:20px;">No hay vendedores registrados aún.</td></tr>';
            return;
        }
        tbody.innerHTML = sellers.map(s => `
            <tr>
                <td>${s.name}</td>
                <td>${s.email}</td>
                <td>${new Date(s.created_at).toLocaleDateString('es-MX')}</td>
                <td><button onclick="deleteSeller(${s.id}, '${s.name.replace(/'/g, "\'")}')" style="background:#E3000F;color:white;border:none;border-radius:20px;padding:4px 12px;cursor:pointer;">🗑️ Eliminar</button></td>
            </tr>`).join('');
    } catch (e) { console.error('Error cargando vendedores:', e); }
}

async function createSeller() {
    const name = document.getElementById('newSellerName').value.trim();
    const email = document.getElementById('newSellerEmail').value.trim();
    const password = document.getElementById('newSellerPass').value.trim();
    if (!name || !email || !password) { showToast('Completa todos los campos', 'warning'); return; }
    if (!isStrongPassword(password)) return;
    try {
        await apiFetch('/auth/register/seller', { method: 'POST', body: JSON.stringify({ name, email, password }) });
        showToast(`Vendedor "${name}" creado correctamente`, 'success');
        document.getElementById('newSellerName').value = '';
        document.getElementById('newSellerEmail').value = '';
        document.getElementById('newSellerPass').value = '';
        loadSellers();
    } catch (e) { showToast('Error al crear vendedor: ' + (e.message || ''), 'error'); }
}

async function deleteSeller(sellerId, sellerName) {
    document.getElementById('confirmDeleteTitle').textContent = '¿Eliminar vendedor?';
    document.getElementById('confirmDeleteMsg').textContent = `Se eliminará a "${sellerName}" del sistema. Sus ventas registradas se conservarán.`;
    document.getElementById('confirmDeleteModal').classList.add('active');
    document.getElementById('confirmDeleteBtn').onclick = async () => {
        closeModal('confirmDeleteModal');
        try {
            await apiFetch(`/admin/sellers/${sellerId}`, { method: 'DELETE' });
            showToast('Vendedor eliminado', 'success');
            loadSellers();
        } catch (e) { showToast('Error al eliminar: ' + e.message, 'error'); }
    };
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
        if (!isStrongPassword(newPass)) return;
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
    const openProfileBtn = document.getElementById('openProfileBtn');
    if (openProfileBtn) openProfileBtn.addEventListener('click', openProfileModal);
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfileAvatar);
    document.getElementById('openCartBtn').addEventListener('click', () => {
        document.getElementById('userDropdown').classList.remove('open');
        openCartModal();
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
