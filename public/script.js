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
            document.getElementById('side-panel').classList.add('open');
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
    const panel = document.getElementById('side-panel');
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
    
    for (const img of activeImages) {
        const blob = await fetch(`data:${img.mimeType};base64,${img.data}`).then(r => r.blob());
        formData.append('images', blob);
    }
    
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
    }
    return {
        model: 'gemini-2.5-flash-image-preview',
        contents
    };
}