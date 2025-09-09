// Library of images and written text instructions (galapagOS + Seafoam)

import { state, setSavedData, subscribe } from './state.js';
import { saveImage, saveText, deleteImage, deleteText } from './libraryAPI.js';
import { putUiConfig } from './galapagOS/api/uiConfig.js';
import { setUiConfigState, getUiConfigState } from './galapagOS/state/uiState.js';
import { createCollectionBrowser } from './galapagOS/components/collectionBrowser.js';
import { readAsBase64 } from './galapagOS/files.js';
import { openTextEditor } from './textEditor.js';
import { openImageEditor } from './imageEditor.js';
import { formatFileSize, formatDate, escapeHtml } from './galapagOS/utils/format.js';
import { enableDelegatedDrag } from './galapagOS/dnd.js';
import { updateSlotsUsing } from './composer.js';

// format helpers moved to galapagOS/utils/format.js

/**
 * [Seafoam] Initialize library panel: renderers, adders, view toggle, and deletion.
 */
export function initFilesystem() {
  setupAdders();

  const panel = document.getElementById('library-panel') || document.getElementById('save-panel') || document.getElementById('side-panel');
  const toggle = document.getElementById('saved-view-toggle');
  const imagesGrid = document.getElementById('saved-images-grid');
  const textsList = document.getElementById('saved-texts-list');

  const getMode = () => {
    const cfg = getUiConfigState();
    const mode = (cfg && cfg.view && cfg.view.imagesMode) || localStorage.getItem('savedViewMode') || 'grid';
    return mode === 'list' ? 'list' : 'grid';
  };
  const setMode = (mode) => {
    const nextMode = mode === 'list' ? 'list' : 'grid';
    localStorage.setItem('savedViewMode', nextMode);
    const curr = getUiConfigState();
    const newCfg = {
      ...(curr || {}),
      view: {
        ...(curr && curr.view ? curr.view : {}),
        imagesMode: nextMode,
        textsMode: nextMode
      }
    };
    setUiConfigState(newCfg);
    try { putUiConfig(newCfg); } catch (_) {}
  };

  const browser = createCollectionBrowser({
    panelEl: panel,
    toggleEl: toggle,
    getMode,
    setMode,
    sections: [
      {
        key: 'images',
        gridContainerEl: imagesGrid,
        listContainerEl: imagesGrid,
        addBtnEl: document.getElementById('add-image-btn'),
        onAdd: () => { document.getElementById('add-image')?.click(); },
        listHeaderHtml: `
          <div class="list-header">
            <div class="row-thumb"></div>
            <div class="row-name">Name</div>
            <div class="row-date">Date Added</div>
            <div class="row-size">Size</div>
            <div class="row-kind">Kind</div>
            <div class="row-actions"></div>
          </div>`,
        getItems: () => state.savedData.images,
        renderGridItem: (img) => `
          <div class="saved-tile" draggable="true" data-id="${img.id}" data-section="images">
            <div class="grid-actions"><button class="icon-btn delete-btn" title="Delete" aria-label="Delete ${escapeHtml(img.name || 'image')}" data-id="${img.id}">✕</button></div>
            <div class="tile-thumb"><img loading="lazy" decoding="async" width="256" height="256" src="data:${img.mimeType};base64,${img.data}" alt="Saved"></div>
            <div class="tile-body">
              <div class="tile-name" title="${escapeHtml(img.name || '')}">${escapeHtml(img.name || '')}</div>
              ${img.caption ? `<div class=\"tile-caption\">${escapeHtml((img.caption || '').substring(0,50))}${(img.caption||'').length>50?'...':''}</div>` : '<div class=\"tile-caption\"></div>'}
            </div>
          </div>`,
        renderGridExtras: () => `
          <div class="saved-tile" data-action="add-image">
            <div class="tile-thumb"><div class="add-tile"><div class="add-icon">➕</div><div class="add-label">Upload Image</div></div></div>
            <div class="tile-body"></div>
          </div>`,
        renderListRow: (img) => `
          <div class="list-row" draggable="true" data-id="${img.id}" data-section="images">
            <div class="row-thumb"><img loading="lazy" decoding="async" width="48" height="48" src="data:${img.mimeType};base64,${img.data}" alt="Saved"></div>
            <div class="row-name" title="${escapeHtml(img.name || '')}">${escapeHtml(img.name || '')}</div>
            <div class="row-date">${formatDate(img.createdAt || Date.now())}</div>
            <div class="row-size">${formatFileSize(img.size || 0)}</div>
            <div class="row-kind">Image</div>
            <div class="row-actions"><button class="icon-btn delete-btn" title="Delete" aria-label="Delete ${escapeHtml(img.name || 'image')}" data-id="${img.id}">✕</button></div>
          </div>`,
        onItemClick: (item) => openImageEditor(item, updateSlotsUsing),
        onDelete: async (item) => {
          await deleteImage(item.id);
          state.savedData.images = state.savedData.images.filter(i => i.id !== item.id);
          updateSlotsUsing(item.id);
          const fresh = await (await fetch('/api/saved')).json();
          setSavedData(fresh);
        }
      },
      {
        key: 'texts',
        gridContainerEl: textsList,
        listContainerEl: textsList,
        addBtnEl: document.getElementById('add-text-btn'),
        onAdd: () => { const m = document.getElementById('text-input-modal'); if (m) m.style.display = 'flex'; },
        listHeaderHtml: `
          <div class="list-header">
            <div class="row-thumb"></div>
            <div class="row-name">Name</div>
            <div class="row-date">Date Added</div>
            <div class="row-size">Size</div>
            <div class="row-kind">Kind</div>
            <div class="row-actions"></div>
          </div>`,
        getItems: () => state.savedData.texts,
        renderGridItem: (txt) => `
          <div class="saved-tile" draggable="true" data-id="${txt.id}" data-section="texts">
            <div class="grid-actions"><button class="icon-btn delete-btn" title="Delete" aria-label="Delete ${escapeHtml(txt.name || 'text')}" data-id="${txt.id}">✕</button></div>
            <div class="tile-body">
              <div class="tile-name" title="${escapeHtml(txt.name || '')}">${escapeHtml(txt.name || '')}</div>
              <div class="tile-preview">${escapeHtml((txt.text || '').substring(0, 80))}${(txt.text || '').length > 80 ? '...' : ''}</div>
            </div>
          </div>`,
        renderGridExtras: () => `
          <div class="saved-tile" data-action="add-text">
            <div class="tile-thumb"><div class="add-tile"><div class="add-icon">➕</div><div class="add-label">Write Instruction</div></div></div>
            <div class="tile-body"></div>
          </div>`,
        renderListRow: (txt) => `
          <div class="list-row" draggable="true" data-id="${txt.id}" data-section="texts">
            <div class="row-thumb text"></div>
            <div class="row-name" title="${escapeHtml(txt.name || '')}">${escapeHtml(txt.name || '')}</div>
            <div class="row-date">${formatDate(txt.createdAt || Date.now())}</div>
            <div class="row-size">${txt.size || 0} chars</div>
            <div class="row-kind">Text</div>
            <div class="row-actions"><button class="icon-btn delete-btn" title="Delete" aria-label="Delete ${escapeHtml(txt.name || 'text')}" data-id="${txt.id}">✕</button></div>
          </div>`,
        onItemClick: (item) => openTextEditor(item),
        onDelete: async (item) => {
          await deleteText(item.id);
          state.savedData.texts = state.savedData.texts.filter(t => t.id !== item.id);
          const fresh = await (await fetch('/api/saved')).json();
          setSavedData(fresh);
        }
      }
    ]
  });

  browser.init();
  subscribe('savedData:change', () => browser.render());
  attachAddHandlers();

  // Robust delegated wiring for header add buttons (list mode)
  if (panel) {
    const onPanelClick = (e) => {
      const imgBtn = e.target.closest('#add-image-btn');
      if (imgBtn) { e.preventDefault(); document.getElementById('add-image')?.click(); return; }
      const txtBtn = e.target.closest('#add-text-btn');
      if (txtBtn) { e.preventDefault(); const m = document.getElementById('text-input-modal'); if (m) m.style.display = 'flex'; return; }
    };
    panel.addEventListener('click', onPanelClick, true);
  }

  // Platformized DnD: enable delegated drag for tiles and rows
  if (panel) {
    enableDelegatedDrag({
      containerEl: panel,
      itemSelector: '.saved-tile, .list-row',
      buildPayload: (el) => {
        const section = el.getAttribute('data-section') || (el.getAttribute('data-type') === 'text' ? 'texts' : 'images');
        const type = section === 'texts' ? 'text' : 'image';
        return { id: el.getAttribute('data-id') || '', type };
      }
    });
  }
}

/**
 * [Seafoam] Wire upload/add-new buttons for images and texts.
 */
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

/**
 * [Seafoam] Wire grid add tiles to trigger uploads/editor open.
 */
function attachAddHandlers() {
  const cfg = getUiConfigState();
  const mode = (cfg && cfg.view && cfg.view.imagesMode) || localStorage.getItem('savedViewMode') || 'grid';
  if (mode === 'grid') {
    const addImageTile = document.querySelector('.saved-tile[data-action="add-image"]');
    const addTextTile = document.querySelector('.saved-tile[data-action="add-text"]');
    if (addImageTile) addImageTile.onclick = () => document.getElementById('add-image')?.click();
    if (addTextTile) addTextTile.onclick = () => {
      document.getElementById('text-input-modal').style.display = 'flex';
    };
  } else {
    // Buttons are the existing add buttons in the header area (list view)
  }
}
