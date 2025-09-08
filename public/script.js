let savedData = { images: [], texts: [] };
let compositionImages = [null, null, null];
let uiConfig = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadUiConfig();
    loadSavedData();
    setupEventListeners();
    setupDragAndDrop();
    setupSlotClickUpload();
    setupSavedPanelToggle();
    setupCanvasCards();
    setupBackgroundPicker();
    // initial server ping and poll every 10s
    pingServer();
    setInterval(pingServer, 10000);
});

async function loadSavedData() {
    try {
        const response = await fetch('/api/saved');
        if (!response.ok) throw new Error('Failed');
        savedData = await response.json();
        renderSavedItems();
        setServerStatus(true);
    } catch (err) {
        setServerStatus(false);
        console.error(err);
    }
}

async function loadUiConfig() {
    try {
        const res = await fetch('/api/ui-config');
        uiConfig = await res.json();
        if (uiConfig?.panel?.height) {
            document.documentElement.style.setProperty('--saved-panel-height', uiConfig.panel.height);
        }
        if (uiConfig?.panel?.open) {
            const p = document.getElementById('side-panel');
            if (p) p.classList.add('open');
        }
        if (uiConfig?.background?.url) {
            document.documentElement.style.setProperty('--app-bg-url', `url('${uiConfig.background.url}')`);
        }
    } catch (_) {}
}

function renderSavedItems() {
    const imagesGrid = document.getElementById('saved-images-grid');
    const textsList = document.getElementById('saved-texts-list');
    
    imagesGrid.innerHTML = savedData.images.map(img => 
        `<div class="saved-item" draggable="true" data-id="${img.id}" data-type="image">
            <div class="grid-actions">
                <button class="icon-btn delete-btn" title="Delete" data-type="image" data-id="${img.id}">✕</button>
            </div>
            <img src="data:${img.mimeType};base64,${img.data}" alt="Saved">
            <input class="saved-name-input" data-type="image" data-id="${img.id}" value="${img.name || ''}" />
            ${img.caption ? `<div class="saved-caption">${(img.caption || '').substring(0,50)}${(img.caption||'').length>50?'...':''}</div>` : ''}
        </div>`
    ).join('');
    
    textsList.innerHTML = savedData.texts.map(txt => 
        `<div class="saved-text-item" draggable="true" data-id="${txt.id}" data-type="text">
            <div style="display:flex; justify-content: space-between; gap:6px;">
                <div class="saved-text-name-row" style="flex:1;">
                    <input class="saved-name-input" data-type="text" data-id="${txt.id}" value="${txt.name || ''}" />
                </div>
                <div class="grid-actions" style="position:static; opacity:1;">
                    <button class="icon-btn delete-btn" title="Delete" data-type="text" data-id="${txt.id}">✕</button>
                </div>
            </div>
            <div class="saved-text-preview">${txt.text.substring(0, 50)}${txt.text.length > 50 ? '...' : ''}</div>
        </div>`
    ).join('');

    attachNameEditors();
    attachItemActionHandlers();
    attachItemEditors();
}

// Open edit modals on single-click (avoid during drag)
function attachItemEditors() {
    document.querySelectorAll('.saved-text-item').forEach(el => {
        el.onclick = (e) => {
            if (e.target.closest('.icon-btn') || e.target.closest('.saved-name-input')) return;
            const id = el.getAttribute('data-id');
            const item = savedData.texts.find(t => t.id === id);
            if (item) openTextEditor(item);
        };
    });
    document.querySelectorAll('.saved-item').forEach(el => {
        el.onclick = (e) => {
            if (e.target.closest('.icon-btn') || e.target.closest('.saved-name-input')) return;
            const id = el.getAttribute('data-id');
            const item = savedData.images.find(i => i.id === id);
            if (item) openImageEditor(item);
        };
    });
}

function openTextEditor(item) {
    const modal = document.getElementById('text-editor-modal');
    const nameInput = document.getElementById('edit-text-name');
    const bodyTextarea = document.getElementById('edit-text-body');
    const saveBtn = document.getElementById('edit-text-save');
    const cancelBtn = document.getElementById('edit-text-cancel');
    nameInput.value = item.name || '';
    bodyTextarea.value = item.text || '';
    modal.style.display = 'flex';

    const onKey = (e) => {
        if (e.key === 'Escape') doCancel();
        if (e.key === 'Enter' && (e.target === nameInput || e.metaKey || e.ctrlKey)) doSave();
    };
    const doSave = async () => {
        const payload = { name: nameInput.value.trim(), text: bodyTextarea.value };
        await fetch(`/api/saved/text/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const target = savedData.texts.find(t => t.id === item.id);
        if (target) { target.name = payload.name; target.text = payload.text; }
        modal.style.display = 'none';
        document.removeEventListener('keydown', onKey);
        renderSavedItems();
    };
    const doCancel = () => {
        modal.style.display = 'none';
        document.removeEventListener('keydown', onKey);
    };
    saveBtn.onclick = doSave;
    cancelBtn.onclick = doCancel;
    setTimeout(() => nameInput.focus(), 0);
    document.addEventListener('keydown', onKey);
}

let cropState = { active: false, start: null, rect: null, image: null, mimeType: null };
function openImageEditor(item) {
    const modal = document.getElementById('image-editor-modal');
    const nameInput = document.getElementById('edit-image-name');
    const captionInput = document.getElementById('edit-image-caption');
    const canvas = document.getElementById('edit-image-canvas');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('crop-overlay');
    const replaceBtn = document.getElementById('replace-image-btn');
    const replaceInput = document.getElementById('replace-image-input');
    const cropToggle = document.getElementById('crop-toggle-btn');
    const cropApply = document.getElementById('crop-apply-btn');
    const cropCancel = document.getElementById('crop-cancel-btn');
    const saveBtn = document.getElementById('edit-image-save');
    const cancelBtn = document.getElementById('edit-image-cancel');

    nameInput.value = item.name || '';
    captionInput.value = item.caption || '';
    cropState = { active: false, start: null, rect: null, image: new Image(), mimeType: item.mimeType };
    cropState.image.onload = () => {
        drawImageToCanvas(cropState.image, canvas, ctx);
    };
    cropState.image.src = `data:${item.mimeType};base64,${item.data}`;
    overlay.style.display = 'none';
    modal.style.display = 'flex';

    const onKey = (e) => {
        if (e.key === 'Escape') doCancel();
        if (e.key === 'Enter' && (e.target === nameInput || e.target === captionInput || e.metaKey || e.ctrlKey)) doSave();
    };

    replaceBtn.onclick = () => replaceInput.click();
    replaceInput.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            cropState.mimeType = file.type;
            cropState.image = new Image();
            cropState.image.onload = () => drawImageToCanvas(cropState.image, canvas, ctx);
            cropState.image.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const onDown = (e) => {
        if (!cropState.active) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        cropState.start = { x, y };
        cropState.rect = { x, y, w: 0, h: 0 };
        overlay.style.display = 'block';
        positionOverlay(overlay, canvas, cropState.rect);
    };
    const onMove = (e) => {
        if (!cropState.active || !cropState.start) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        cropState.rect.w = x - cropState.start.x;
        cropState.rect.h = y - cropState.start.y;
        positionOverlay(overlay, canvas, cropState.rect);
    };
    const onUp = () => { cropState.start = null; };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp);

    cropToggle.onclick = () => {
        cropState.active = !cropState.active;
        cropApply.style.display = cropState.active ? 'inline-block' : 'none';
        cropCancel.style.display = cropState.active ? 'inline-block' : 'none';
        if (!cropState.active) { overlay.style.display = 'none'; cropState.rect = null; }
    };
    cropCancel.onclick = () => { cropState.rect = null; overlay.style.display = 'none'; };
    cropApply.onclick = () => {
        if (!cropState.rect) return;
        const abs = normalizeRect(cropState.rect);
        const temp = document.createElement('canvas');
        temp.width = abs.w; temp.height = abs.h;
        const tctx = temp.getContext('2d');
        tctx.drawImage(canvas, abs.x, abs.y, abs.w, abs.h, 0, 0, abs.w, abs.h);
        const dataUrl = temp.toDataURL(cropState.mimeType || 'image/png');
        cropState.image = new Image();
        cropState.image.onload = () => drawImageToCanvas(cropState.image, canvas, ctx);
        cropState.image.src = dataUrl;
        overlay.style.display = 'none';
        cropState.rect = null;
        cropState.active = false;
        cropApply.style.display = 'none';
        cropCancel.style.display = 'none';
    };

    const doSave = async () => {
        const dataUrl = canvas.toDataURL(cropState.mimeType || 'image/png');
        const base64 = dataUrl.split(',')[1];
        const payload = { name: nameInput.value.trim(), caption: captionInput.value, data: base64, mimeType: cropState.mimeType };
        await fetch(`/api/saved/image/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const target = savedData.images.find(i => i.id === item.id);
        if (target) { target.name = payload.name; target.caption = payload.caption; target.data = base64; target.mimeType = cropState.mimeType; }
        modal.style.display = 'none';
        cleanup();
        renderSavedItems();
        updateSlotsUsing(item.id);
    };
    const doCancel = () => { modal.style.display = 'none'; cleanup(); };
    function cleanup() {
        document.removeEventListener('keydown', onKey);
        canvas.removeEventListener('mousedown', onDown);
        canvas.removeEventListener('mousemove', onMove);
        canvas.removeEventListener('mouseup', onUp);
        canvas.removeEventListener('touchstart', onDown);
        canvas.removeEventListener('touchmove', onMove);
        canvas.removeEventListener('touchend', onUp);
    }

    saveBtn.onclick = doSave;
    cancelBtn.onclick = doCancel;
    document.addEventListener('keydown', onKey);
}

function drawImageToCanvas(img, canvas, ctx) {
    const cw = canvas.width, ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.min(cw / iw, ch / ih);
    const w = iw * scale, h = ih * scale;
    const x = (cw - w) / 2, y = (ch - h) / 2;
    ctx.drawImage(img, x, y, w, h);
}

function positionOverlay(overlay, canvas, r) {
    const rect = normalizeRect(r);
    overlay.style.left = rect.x + 'px';
    overlay.style.top = rect.y + 'px';
    overlay.style.width = rect.w + 'px';
    overlay.style.height = rect.h + 'px';
}

function normalizeRect(r) {
    const x = r.w < 0 ? r.x + r.w : r.x;
    const y = r.h < 0 ? r.y + r.h : r.y;
    const w = Math.abs(r.w);
    const h = Math.abs(r.h);
    return { x, y, w, h };
}

function attachNameEditors() {
    const inputs = document.querySelectorAll('.saved-name-input');
    inputs.forEach(input => {
        input.onchange = async (e) => {
            const id = e.target.getAttribute('data-id');
            const type = e.target.getAttribute('data-type');
            const name = e.target.value.trim();
            if (type === 'image') {
                await fetch(`/api/saved/image/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                const item = savedData.images.find(i => i.id === id);
                if (item) item.name = name || item.name;
            } else if (type === 'text') {
                await fetch(`/api/saved/text/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                const item = savedData.texts.find(t => t.id === id);
                if (item) item.name = name || item.name;
            }
        };
    });
}

function attachItemActionHandlers() {
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const id = e.currentTarget.getAttribute('data-id');
            const type = e.currentTarget.getAttribute('data-type');
            if (type === 'image') {
                await fetch(`/api/saved/image/${id}`, { method: 'DELETE' });
            } else {
                await fetch(`/api/saved/text/${id}`, { method: 'DELETE' });
            }
            loadSavedData();
        };
    });    
}

function setupEventListeners() {
    const addImageInput = document.getElementById('add-image');
    document.getElementById('add-image-btn').onclick = () => {
        addImageInput.click();
    };
    
    addImageInput.onchange = async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target.result.split(',')[1];
                await fetch('/api/save-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: base64, mimeType: file.type, name: file.name.replace(/\.[^/.]+$/, ''), size: file.size, createdAt: Date.now() })
                });
                loadSavedData();
            };
            reader.readAsDataURL(file);
        }
        // Reset input so selecting the same file again triggers change
        e.target.value = '';
    };
    
    document.getElementById('add-text-btn').onclick = () => {
        document.getElementById('text-input-modal').style.display = 'flex';
    };
    
    document.getElementById('text-save').onclick = async () => {
        const text = document.getElementById('new-text-input').value.trim();
        if (text) {
            try {
                const res = await fetch('/api/save-text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, name: `Snippet ${savedData.texts.length + 1}`, size: text.length, createdAt: Date.now() })
                });
                if (!res.ok) throw new Error('Failed');
                document.getElementById('new-text-input').value = '';
                document.getElementById('text-input-modal').style.display = 'none';
                loadSavedData();
            } catch (err) {
                setServerStatus(false);
                console.error(err);
            }
        }
    };
    
    document.getElementById('text-cancel').onclick = () => {
        document.getElementById('text-input-modal').style.display = 'none';
    };
    
    document.getElementById('preview-btn').onclick = showPreview;
    document.getElementById('generate-btn').onclick = generate;
    document.getElementById('modal-generate').onclick = generate;
    document.getElementById('modal-cancel').onclick = () => {
        document.getElementById('preview-modal').style.display = 'none';
    };
    
    document.getElementById('save-btn').onclick = async () => {
        const img = document.getElementById('generated-image');
        if (img.src) {
            const base64 = img.src.split(',')[1];
            const mimeType = img.src.match(/data:([^;]+);/)[1];
            try {
                await fetch('/api/save-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: base64, mimeType })
                });
                loadSavedData();
            } catch (err) {
                setServerStatus(false);
                console.error(err);
            }
        }
    };
    
    document.getElementById('download-btn').onclick = () => {
        const img = document.getElementById('generated-image');
        const link = document.createElement('a');
        link.href = img.src;
        link.download = `seafoam-${Date.now()}.png`;
        link.click();
    };
}

function setupDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
        if (e.target.closest('.icon-btn') || e.target.closest('.saved-name-input')) {
            e.preventDefault();
            return;
        }
        if (e.target.closest('.saved-item, .saved-text-item')) {
            const item = e.target.closest('.saved-item, .saved-text-item');
            e.dataTransfer.setData('text/plain', JSON.stringify({
                id: item.dataset.id,
                type: item.dataset.type
            }));
        }
    });
    
    const slots = document.querySelectorAll('.image-slot');
    slots.forEach(slot => {
        slot.ondragover = (e) => {
            e.preventDefault();
            slot.classList.add('dragover');
        };
        
        slot.ondragleave = () => {
            slot.classList.remove('dragover');
        };
        
        slot.ondrop = (e) => {
            e.preventDefault();
            slot.classList.remove('dragover');
            
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.type === 'image') {
                const img = savedData.images.find(i => i.id === data.id);
                if (img) {
                    const slotIndex = parseInt(slot.dataset.slot);
                    compositionImages[slotIndex] = img;
                    slot.innerHTML = `<img src="data:${img.mimeType};base64,${img.data}" alt="Composition">`;
                    slot.classList.add('filled');
                }
            }
        };
        
        slot.ondblclick = () => {
            const slotIndex = parseInt(slot.dataset.slot);
            compositionImages[slotIndex] = null;
            slot.innerHTML = '<span>Drop image here</span>';
            slot.classList.remove('filled');
        };
    });
    
    const textArea = document.getElementById('composition-text');
    textArea.ondragover = (e) => e.preventDefault();
    textArea.ondrop = (e) => {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.type === 'text') {
            const text = savedData.texts.find(t => t.id === data.id);
            if (text) {
                const currentText = textArea.value;
                const insert = text.name ? `[${text.name}]` : text.text;
                textArea.value = currentText ? `${currentText} ${insert}` : insert;
            }
        }
    };
}

function setupSlotClickUpload() {
    const slotFileInput = document.getElementById('slot-file-input');
    const slots = document.querySelectorAll('.image-slot');
    let activeSlotIndex = null;

    slots.forEach(slot => {
        slot.onclick = () => {
            activeSlotIndex = parseInt(slot.dataset.slot);
            slotFileInput.click();
        };
    });

    slotFileInput.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file || activeSlotIndex === null) {
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target.result.split(',')[1];
            // Save to saved images first so it's available in the library too
            const resp = await fetch('/api/save-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: base64, mimeType: file.type, name: file.name.replace(/\.[^/.]+$/, '') })
            });
            const { id } = await resp.json();
            // Update local savedData immediately
            const newImage = { id, data: base64, mimeType: file.type, name: file.name.replace(/\.[^/.]+$/, '') };
            savedData.images.push(newImage);
            renderSavedItems();

            // Place image into the clicked slot
            compositionImages[activeSlotIndex] = newImage;
            const slotEl = document.querySelector(`.image-slot[data-slot="${activeSlotIndex}"]`);
            if (slotEl) {
                slotEl.innerHTML = `<img src="data:${newImage.mimeType};base64,${newImage.data}" alt="Composition">`;
                slotEl.classList.add('filled');
            }

            // Reset
            activeSlotIndex = null;
            e.target.value = '';
        };
        reader.readAsDataURL(file);
    };
}

function setupSavedPanelToggle() {
    const toggleBtn = document.getElementById('drawer-toggle') || document.getElementById('toggle-saved-btn');
    const panel = document.getElementById('save-panel');
    // restore open state and height
    const savedOpen = localStorage.getItem('savedPanelOpen');
    const savedHeight = localStorage.getItem('savedPanelHeight');
    if (savedHeight) {
        document.documentElement.style.setProperty('--saved-panel-height', savedHeight);
    }
    if (savedOpen === 'true') {
        panel.classList.add('open');
    }
    const openPanel = () => {
        panel.classList.add('open');
        localStorage.setItem('savedPanelOpen', 'true');
        if (toggleBtn && toggleBtn.id === 'drawer-toggle') toggleBtn.textContent = '▼';
    };
    const closePanel = () => {
        panel.classList.remove('open');
        localStorage.setItem('savedPanelOpen', 'false');
        if (toggleBtn && toggleBtn.id === 'drawer-toggle') toggleBtn.textContent = '▲';
    };
    if (toggleBtn) toggleBtn.onclick = () => {
        if (panel.classList.contains('open')) closePanel(); else openPanel();
    };
}

// Optional: allow resizing panel height with cmd/ctrl + mouse wheel over grabber
document.addEventListener('DOMContentLoaded', () => {
    const grabber = document.getElementById('panel-grabber');
    if (!grabber) return;
    let startY = 0;
    let startHeight = 0;
    const onMove = (e) => {
        const dy = startY - (e.touches ? e.touches[0].clientY : e.clientY);
        let newVh = Math.max(18, Math.min(60, ((startHeight + dy) / window.innerHeight) * 100));
        const value = newVh.toFixed(1) + 'vh';
        document.documentElement.style.setProperty('--saved-panel-height', value);
    };
    const onEnd = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchend', onEnd);
        const value = getComputedStyle(document.documentElement).getPropertyValue('--saved-panel-height').trim();
        if (value) localStorage.setItem('savedPanelHeight', value);
    };
    const onStart = (e) => {
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        const current = getComputedStyle(document.documentElement).getPropertyValue('--saved-panel-height').trim();
        const vh = current.endsWith('vh') ? parseFloat(current) : 28;
        startHeight = (vh / 100) * window.innerHeight;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
    };
    grabber.addEventListener('mousedown', onStart);
    grabber.addEventListener('touchstart', onStart, { passive: true });
});

function showPreview() {
    const rawText = document.getElementById('composition-text').value;
    const expandedText = expandSnippetNames(rawText);
    const activeImages = compositionImages.filter(img => img !== null);

    const requestPreview = buildGeminiRequestPreview(expandedText, activeImages);
    const jsonStr = JSON.stringify(requestPreview, null, 2);
    const jsonEl = document.getElementById('preview-json');
    if (jsonEl) jsonEl.textContent = jsonStr;

    document.getElementById('preview-modal').style.display = 'flex';
}

async function generate() {
    const rawText = document.getElementById('composition-text').value;
    const text = expandSnippetNames(rawText);
    const activeImages = compositionImages.filter(img => img !== null);
    
    if (!text.trim()) return;
    
    document.getElementById('preview-modal').style.display = 'none';
    setLoading('generate-btn', true);
    
    const formData = new FormData();
    formData.append('prompt', text);
    
    const captions = [];
    for (const img of activeImages) {
        const blob = await fetch(`data:${img.mimeType};base64,${img.data}`).then(r => r.blob());
        formData.append('images', blob);
        captions.push(img.caption || '');
    }
    formData.append('captions', JSON.stringify(captions));
    
    const response = await fetch('/api/compose', {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    displayImage(data.image);
    setLoading('generate-btn', false);
}

function displayImage(imageData) {
    const img = document.getElementById('generated-image');
    img.src = `data:${imageData.mimeType};base64,${imageData.data}`;
    
    document.getElementById('image-placeholder').style.display = 'none';
    document.getElementById('image-result').style.display = 'block';
}

function setLoading(buttonId, loading) {
    const btn = document.getElementById(buttonId);
    btn.disabled = loading;
    btn.querySelector('.btn-text').style.display = loading ? 'none' : 'block';
    btn.querySelector('.btn-loading').style.display = loading ? 'flex' : 'none';
}

async function pingServer() {
    try {
        const res = await fetch('/health');
        const ok = res.ok;
        setServerStatus(ok);
        return ok;
    } catch (_) {
        setServerStatus(false);
        return false;
    }
}

function setServerStatus(isOnline) {
    const pill = document.getElementById('server-status');
    if (!pill) return;
    pill.textContent = isOnline ? 'Online' : 'Offline';
    pill.classList.toggle('status-online', !!isOnline);
    pill.classList.toggle('status-offline', !isOnline);
}

function setupBackgroundPicker() {
    const input = document.getElementById('bg-input');
    if (!input) return;
    input.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUrl = event.target.result;
            // Persist background to ui config as a data URL for simplicity
            const payload = {
                ...(uiConfig || {}),
                background: { url: dataUrl }
            };
            uiConfig = payload;
            document.documentElement.style.setProperty('--app-bg-url', `url('${dataUrl}')`);
            try {
                await fetch('/api/ui-config', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (_) {}
        };
        reader.readAsDataURL(file);
    };
}

function expandSnippetNames(input) {
    // Replace [name] with the actual text snippet content if a matching name exists
    return input.replace(/\[(.+?)\]/g, (match, name) => {
        const found = savedData.texts.find(t => (t.name || '').toLowerCase() === name.toLowerCase());
        return found ? found.text : match;
    });
}

function setupCanvasCards() {
    const defaults = {
        composition: { x: 40, y: 120, w: 460, h: 360 },
        output: { x: 560, y: 120, w: 520, h: 420 }
    };
    const applyLayout = (key, el) => {
        const cfg = (uiConfig && uiConfig.layout && uiConfig.layout.cards && uiConfig.layout.cards[key]) || defaults[key];
        el.style.left = (cfg.x || 0) + 'px';
        el.style.top = (cfg.y || 0) + 'px';
        el.style.width = (cfg.w || 400) + 'px';
        el.style.height = (cfg.h || 300) + 'px';
    };
    const composition = document.querySelector('.canvas-card[data-card="composition"]');
    const output = document.querySelector('.canvas-card[data-card="output"]');
    if (composition) applyLayout('composition', composition);
    if (output) applyLayout('output', output);

    const saveLayout = async () => {
        const toRect = (el) => ({
            x: parseInt(el.style.left || '0'),
            y: parseInt(el.style.top || '0'),
            w: parseInt(el.style.width || el.offsetWidth),
            h: parseInt(el.style.height || el.offsetHeight)
        });
        const payload = {
            ...(uiConfig || {}),
            layout: {
                ...(uiConfig && uiConfig.layout ? uiConfig.layout : {}),
                cards: {
                    composition: toRect(composition),
                    output: toRect(output)
                }
            }
        };
        uiConfig = payload;
        try {
            await fetch('/api/ui-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (_) {}
    };

    const enableDrag = (card) => {
        const handle = card.querySelector('.card-drag-handle') || card;
        let dragging = false; let startX = 0; let startY = 0; let baseLeft = 0; let baseTop = 0;
        const onMove = (e) => {
            if (!dragging) return;
            const x = e.touches ? e.touches[0].clientX : e.clientX;
            const y = e.touches ? e.touches[0].clientY : e.clientY;
            const dx = x - startX; const dy = y - startY;
            card.style.left = baseLeft + dx + 'px';
            card.style.top = baseTop + dy + 'px';
        };
        const onEnd = () => {
            if (!dragging) return;
            dragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchend', onEnd);
            saveLayout();
        };
        const onStart = (e) => {
            if ((e.target && e.target.closest('.card-resize-handle')) || (e.button && e.button !== 0)) return;
            dragging = true;
            startX = e.touches ? e.touches[0].clientX : e.clientX;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            baseLeft = parseInt(card.style.left || '0');
            baseTop = parseInt(card.style.top || '0');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('mouseup', onEnd);
            document.addEventListener('touchend', onEnd);
        };
        handle.addEventListener('mousedown', onStart);
        handle.addEventListener('touchstart', onStart, { passive: true });
    };

    const enableResize = (card) => {
        const handle = card.querySelector('.card-resize-handle');
        if (!handle) return;
        let resizing = false; let startX = 0; let startY = 0; let baseW = 0; let baseH = 0;
        const onMove = (e) => {
            if (!resizing) return;
            const x = e.touches ? e.touches[0].clientX : e.clientX;
            const y = e.touches ? e.touches[0].clientY : e.clientY;
            const dx = x - startX; const dy = y - startY;
            card.style.width = Math.max(320, baseW + dx) + 'px';
            card.style.height = Math.max(240, baseH + dy) + 'px';
        };
        const onEnd = () => {
            if (!resizing) return;
            resizing = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchend', onEnd);
            saveLayout();
        };
        const onStart = (e) => {
            e.stopPropagation();
            resizing = true;
            startX = e.touches ? e.touches[0].clientX : e.clientX;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            baseW = parseInt(card.style.width || card.offsetWidth);
            baseH = parseInt(card.style.height || card.offsetHeight);
            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('mouseup', onEnd);
            document.addEventListener('touchend', onEnd);
        };
        handle.addEventListener('mousedown', onStart);
        handle.addEventListener('touchstart', onStart, { passive: true });
    };

    if (composition) { enableDrag(composition); enableResize(composition); }
    if (output) { enableDrag(output); enableResize(output); }
}

function buildGeminiRequestPreview(text, images) {
    // Mirrors server structure: [prompt, image parts...]
    const contents = [text];
    for (const img of images) {
        contents.push({
            inlineData: {
                data: `[${img.name || 'temp image'}]`,
                mimeType: img.mimeType
            }
        });
        if (img.caption && img.caption.trim()) contents.push(img.caption.trim());
    }
    return {
        model: 'gemini-2.5-flash-image-preview',
        contents
    };
}

function updateSlotsUsing(imageId) {
    document.querySelectorAll('.image-slot').forEach((slot, idx) => {
        const current = compositionImages[idx];
        if (current && current.id === imageId) {
            slot.innerHTML = `<img src="data:${current.mimeType};base64,${current.data}" alt="Composition">`;
            slot.classList.add('filled');
        }
    });
}
