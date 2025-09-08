import { state, setSavedData, subscribe } from './state.js';
import { saveImage, saveText, deleteImage, deleteText, patchImage, patchText } from './api.js';
import { openTextEditor, openImageEditor } from './modals.js';
import { updateSlotsUsing } from './composition.js';

export function initFilesystem() {
  // Initial render and subscribe to changes
  renderSavedItems();
  subscribe('savedData:change', renderSavedItems);
  setupAdders();
}

function renderSavedItems() {
  const imagesGrid = document.getElementById('saved-images-grid');
  const textsList = document.getElementById('saved-texts-list');
  if (!imagesGrid || !textsList) return;

  imagesGrid.innerHTML = state.savedData.images.map(img => `
    <div class="saved-item" draggable="true" data-id="${img.id}" data-type="image">
      <div class="grid-actions">
        <button class="icon-btn delete-btn" title="Delete" data-type="image" data-id="${img.id}">✕</button>
      </div>
      <img src="data:${img.mimeType};base64,${img.data}" alt="Saved">
      <input class="saved-name-input" data-type="image" data-id="${img.id}" value="${img.name || ''}" />
      ${img.caption ? `<div class="saved-caption">${(img.caption || '').substring(0,50)}${(img.caption||'').length>50?'...':''}</div>` : ''}
    </div>
  `).join('');

  textsList.innerHTML = state.savedData.texts.map(txt => `
    <div class="saved-text-item" draggable="true" data-id="${txt.id}" data-type="text">
      <div style="display:flex; justify-content: space-between; gap:6px;">
        <div class="saved-text-name-row" style="flex:1;">
          <input class="saved-name-input" data-type="text" data-id="${txt.id}" value="${txt.name || ''}" />
        </div>
        <div class="grid-actions" style="position:static; opacity:1;">
          <button class="icon-btn delete-btn" title="Delete" data-type="text" data-id="${txt.id}">✕</button>
        </div>
      </div>
      <div class="saved-text-preview">${txt.text.substring(0, 50)}${txt.text.length > 50 ? '...' : ''}</div>
    </div>
  `).join('');

  attachNameEditors();
  attachItemActionHandlers();
  attachItemEditors();
}

function attachNameEditors() {
  const inputs = document.querySelectorAll('.saved-name-input');
  inputs.forEach(input => {
    input.onchange = async (e) => {
      const id = e.target.getAttribute('data-id');
      const type = e.target.getAttribute('data-type');
      const name = e.target.value.trim();
      if (type === 'image') {
        await patchImage(id, { name });
        const item = state.savedData.images.find(i => i.id === id);
        if (item) item.name = name || item.name;
      } else if (type === 'text') {
        await patchText(id, { name });
        const item = state.savedData.texts.find(t => t.id === id);
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
        await deleteImage(id);
        state.savedData.images = state.savedData.images.filter(i => i.id !== id);
        updateSlotsUsing(id); // clear visuals if needed
      } else {
        await deleteText(id);
        state.savedData.texts = state.savedData.texts.filter(t => t.id !== id);
      }
      renderSavedItems();
    };
  });
}

function attachItemEditors() {
  document.querySelectorAll('.saved-text-item').forEach(el => {
    el.onclick = (e) => {
      if (e.target.closest('.icon-btn') || e.target.closest('.saved-name-input')) return;
      const id = el.getAttribute('data-id');
      const item = state.savedData.texts.find(t => t.id === id);
      if (item) openTextEditor(item);
    };
  });
  document.querySelectorAll('.saved-item').forEach(el => {
    el.onclick = (e) => {
      if (e.target.closest('.icon-btn') || e.target.closest('.saved-name-input')) return;
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
      renderSavedItems();
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
      const text = textarea.value.trim();
      if (text) {
        await saveText({ text, name: `Snippet ${state.savedData.texts.length + 1}`, size: text.length, createdAt: Date.now() });
        textarea.value = '';
        document.getElementById('text-input-modal').style.display = 'none';
        const fresh = await (await fetch('/api/saved')).json();
        setSavedData(fresh);
        renderSavedItems();
      }
    };
    textCancel.onclick = () => {
      document.getElementById('text-input-modal').style.display = 'none';
    };
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
