// Library of images and written text instructions (galapagOS + seafoam)

import { state, setSavedData, setUiConfig, subscribe } from './state.js';
import { saveImage, saveText, deleteImage, deleteText, putUiConfig } from './api.js';
import { openTextEditor } from './textEditor.js';
import { openImageEditor } from './imageEditor.js';
import { updateSlotsUsing } from './composition.js';

export function initFilesystem() {
  renderSavedItems();
  subscribe('savedData:change', renderSavedItems);
  setupAdders();
  setupViewToggle();
  applyInitialViewMode();
  setupDelegatedDeletion();
}

function getViewMode() {
  const cfg = state.uiConfig;
  const mode = (cfg && cfg.view && cfg.view.imagesMode) || localStorage.getItem('savedViewMode') || 'grid';
  return mode === 'list' ? 'list' : 'grid';
}

function setViewMode(mode) {
  const next = mode === 'list' ? 'list' : 'grid';
  localStorage.setItem('savedViewMode', next);
  const newCfg = {
    ...(state.uiConfig || {}),
    view: {
      ...(state.uiConfig && state.uiConfig.view ? state.uiConfig.view : {}),
      imagesMode: next,
      textsMode: next
    }
  };
  setUiConfig(newCfg);
  try { putUiConfig(newCfg); } catch (_) {}
}

function applyInitialViewMode() {
  const mode = getViewMode();
  const panel = document.getElementById('save-panel') || document.getElementById('side-panel');
  panel?.classList.toggle('list-view', mode === 'list');
  const toggle = document.getElementById('saved-view-toggle');
  if (toggle) {
    toggle.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  }
  renderSavedItems();
}

function setupViewToggle() {
  const toggle = document.getElementById('saved-view-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    const mode = btn.dataset.mode;
    setViewMode(mode);
    const panel = document.getElementById('save-panel') || document.getElementById('side-panel');
    panel?.classList.toggle('list-view', mode === 'list');
    toggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderSavedItems();
  });
}

function renderSavedItems() {
  const imagesGrid = document.getElementById('saved-images-grid');
  const textsList = document.getElementById('saved-texts-list');
  if (!imagesGrid || !textsList) return;

  const mode = getViewMode();
  if (mode === 'grid') {
    imagesGrid.classList.add('saved-grid');
    textsList.classList.add('saved-grid');
    const tiles = state.savedData.images.map(img => `
      <div class="saved-tile" draggable="true" data-id="${img.id}" data-type="image">
        <div class="grid-actions"><button class="icon-btn delete-btn" title="Delete" data-type="image" data-id="${img.id}">✕</button></div>
        <div class="tile-thumb"><img src="data:${img.mimeType};base64,${img.data}" alt="Saved"></div>
        <div class="tile-body">
          <div class="tile-name" title="${img.name || ''}">${img.name || ''}</div>
          ${img.caption ? `<div class=\"tile-caption\">${(img.caption || '').substring(0,50)}${(img.caption||'').length>50?'...':''}</div>` : '<div class=\"tile-caption\"></div>'}
        </div>
      </div>`).join('');
    const addTile = `
      <div class="saved-tile" data-action="add-image">
        <div class="tile-thumb"><div class="add-tile"><div class="add-icon">➕</div><div class="add-label">Upload Image</div></div></div>
        <div class="tile-body"></div>
      </div>`;
    imagesGrid.innerHTML = tiles + addTile;

    const textTiles = state.savedData.texts.map(txt => `
      <div class="saved-tile" draggable="true" data-id="${txt.id}" data-type="text">
        <div class="grid-actions"><button class="icon-btn delete-btn" title="Delete" data-type="text" data-id="${txt.id}">✕</button></div>
        <div class="tile-body">
          <div class="tile-name" title="${txt.name || ''}">${txt.name || ''}</div>
          <div class="tile-preview">${txt.text.substring(0, 80)}${txt.text.length > 80 ? '...' : ''}</div>
        </div>
      </div>`).join('');
    const addTextTile = `
      <div class="saved-tile" data-action="add-text">
        <div class="tile-thumb"><div class="add-tile"><div class="add-icon">➕</div><div class="add-label">Write Instruction</div></div></div>
        <div class="tile-body"></div>
      </div>`;
    textsList.innerHTML = textTiles + addTextTile;
  } else { // assumes that List view is the alternative to Grid view
    imagesGrid.classList.remove('saved-grid');
    textsList.classList.remove('saved-grid');
    imagesGrid.innerHTML = `
      <div class="list-section">
        <div class="list-rows">
          ${state.savedData.images.map(img => `
            <div class="list-row" draggable="true" data-id="${img.id}" data-type="image">
              <div class="row-thumb"><img src="data:${img.mimeType};base64,${img.data}" alt="Saved"></div>
              <div class="row-name" title="${img.name || ''}">${img.name || ''}</div>
              <div class="row-actions"><button class="icon-btn delete-btn" title="Delete" data-type="image" data-id="${img.id}">✕</button></div>
            </div>
          `).join('')}
        </div>
      </div>`;
    textsList.innerHTML = `
      <div class="list-section">
        <div class="list-rows">
          ${state.savedData.texts.map(txt => `
            <div class="list-row" draggable="true" data-id="${txt.id}" data-type="text">
              <div class="row-thumb text">📄</div>
              <div class="row-name" title="${txt.name || ''}">${txt.name || ''}</div>
              <div class="row-actions"><button class="icon-btn delete-btn" title="Delete" data-type="text" data-id="${txt.id}">✕</button></div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }
  attachItemEditors();
  attachAddHandlers();
}

function setupDelegatedDeletion() {
  const panel = document.getElementById('save-panel') || document.getElementById('side-panel');
  if (!panel || panel.__hasDeleteDelegation) return;
  panel.__hasDeleteDelegation = true;
  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-btn');
    if (!btn || !panel.contains(btn)) return;
    e.stopPropagation();
    const id = btn.getAttribute('data-id');
    const type = btn.getAttribute('data-type');
    try {
      if (type === 'image') {
        await deleteImage(id);
        state.savedData.images = state.savedData.images.filter(i => i.id !== id);
        updateSlotsUsing(id);
      } else if (type === 'text') {
        await deleteText(id);
        state.savedData.texts = state.savedData.texts.filter(t => t.id !== id);
      }
    } finally {
      // Refresh from server for authoritative state
      const fresh = await (await fetch('/api/saved')).json();
      setSavedData(fresh);
    }
  });
}

function attachItemEditors() {
  document.querySelectorAll('[data-type="text"]').forEach(el => {
    el.onclick = (e) => {
      if (!el.getAttribute('data-id')) return; // ignore add tiles
      if (e.target.closest('.icon-btn')) return;
      const id = el.getAttribute('data-id');
      const item = state.savedData.texts.find(t => t.id === id);
      if (item) openTextEditor(item);
    };
  });
  document.querySelectorAll('[data-type="image"]').forEach(el => {
    el.onclick = (e) => {
      if (!el.getAttribute('data-id')) return; // ignore add tiles
      if (e.target.closest('.icon-btn')) return;
      const id = el.getAttribute('data-id');
      const item = state.savedData.images.find(i => i.id === id);
      if (item) openImageEditor(item, updateSlotsUsing);
    };
  });
}

function setupAdders() {
  const addImageInput = document.getElementById('add-image');
  const addImageBtn = document.getElementById('add-image-btn');
  if (addImageBtn && addImageInput) {
    addImageBtn.onclick = () => addImageInput.click();
    addImageInput.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        const base64 = await readAsBase64(file);
        await saveImage({ data: base64, mimeType: file.type, name: file.name.replace(/\.[^/.]+$/, ''), size: file.size, createdAt: Date.now() });
      }
      e.target.value = '';
      const fresh = await (await fetch('/api/saved')).json();
      setSavedData(fresh);
    };
  }

  const addTextBtn = document.getElementById('add-text-btn');
  if (addTextBtn) {
    addTextBtn.onclick = () => {
      document.getElementById('text-input-modal').style.display = 'flex';
    };
  }

  const textSave = document.getElementById('text-save');
  const textCancel = document.getElementById('text-cancel');
  if (textSave && textCancel) {
    textSave.onclick = async () => {
      const textarea = document.getElementById('new-text-input');
      const titleInput = document.getElementById('new-text-title');
      const text = textarea.value.trim();
      const title = (titleInput?.value || '').trim();
      if (text) {
        const defaultName = `Instruction ${state.savedData.texts.length + 1}`;
        await saveText({ text, name: title || defaultName, size: text.length, createdAt: Date.now() });
        textarea.value = '';
        if (titleInput) titleInput.value = '';
        document.getElementById('text-input-modal').style.display = 'none';
        const fresh = await (await fetch('/api/saved')).json();
        setSavedData(fresh);
      }
    };
    textCancel.onclick = () => {
      const textarea = document.getElementById('new-text-input');
      const titleInput = document.getElementById('new-text-title');
      if (textarea) textarea.value = '';
      if (titleInput) titleInput.value = '';
      document.getElementById('text-input-modal').style.display = 'none';
    };
  }
}

function attachAddHandlers() {
  const mode = getViewMode();
  if (mode === 'grid') {
    const addImageTile = document.querySelector('.saved-tile[data-action="add-image"]');
    const addTextTile = document.querySelector('.saved-tile[data-action="add-text"]');
    if (addImageTile) addImageTile.onclick = () => document.getElementById('add-image')?.click();
    if (addTextTile) addTextTile.onclick = () => {
      document.getElementById('text-input-modal').style.display = 'flex';
    };
  } else {
    // Buttons are the existing add buttons, now positioned at top-right by CSS (??? IS THIS A TODO OR IS THIS A COMMENT OF EXISTING BEHAVIOR???)
  }
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
