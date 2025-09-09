// Composition of layout components (galapagOS + seafoam)

import { state, setCompositionImage, setSavedData } from './state.js';
import { saveImage, getSaved } from './api.js';

export function initComposition() {
  setupDragAndDrop();
  setupSlotClickUpload();
  setupActions();
}

function setupActions() {
  const previewBtn = document.getElementById('preview-btn');
  const generateBtn = document.getElementById('generate-btn');
  const modalGen = document.getElementById('modal-generate');
  const modalCancel = document.getElementById('modal-cancel');
  const saveBtn = document.getElementById('save-btn');
  const downloadBtn = document.getElementById('download-btn');
  if (previewBtn) previewBtn.onclick = showPreview;
  if (generateBtn) generateBtn.onclick = generate;
  if (modalGen) modalGen.onclick = generate;
  if (modalCancel) modalCancel.onclick = () => {
    document.getElementById('preview-modal').style.display = 'none';
  };
  if (downloadBtn) downloadBtn.onclick = () => {
    const img = document.getElementById('generated-image');
    const link = document.createElement('a');
    link.href = img.src; link.download = `seafoam-${Date.now()}.png`; link.click();
  };
  if (saveBtn) saveBtn.onclick = async () => {
    const img = document.getElementById('generated-image');
    if (img.src) {
      const base64 = img.src.split(',')[1];
      const mimeMatch = img.src.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      await saveImage({ data: base64, mimeType });
      const fresh = await getSaved();
      setSavedData(fresh);
    }
  };
}

function setupDragAndDrop() {
  // Handle slot remove buttons
  document.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.slot-remove-btn');
    if (removeBtn) {
      e.stopPropagation();
      const slotIndex = parseInt(removeBtn.dataset.slot);
      setCompositionImage(slotIndex, null);
      const slotEl = document.querySelector(`.image-slot[data-slot="${slotIndex}"]`);
      if (slotEl) {
        slotEl.innerHTML = '<span>Drop image here</span>';
        slotEl.classList.remove('filled');
      }
    }
  });

  document.addEventListener('dragstart', (e) => {
    if (e.target.closest('.icon-btn') || e.target.closest('.slot-remove-btn')) {
      e.preventDefault();
      return;
    }
    const dragEl = e.target.closest('.saved-item, .saved-text-item, .saved-tile, .list-row');
    if (dragEl) {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        id: dragEl.dataset.id,
        type: dragEl.dataset.type
      }));
    }
  });

  const slots = document.querySelectorAll('.image-slot');
  slots.forEach(slot => {
    slot.ondragover = (e) => { e.preventDefault(); slot.classList.add('dragover'); };
    slot.ondragleave = () => { slot.classList.remove('dragover'); };
    slot.ondrop = (e) => {
      e.preventDefault();
      slot.classList.remove('dragover');
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'image') {
        const img = state.savedData.images.find(i => i.id === data.id);
        if (img) {
          const slotIndex = parseInt(slot.dataset.slot);
          setCompositionImage(slotIndex, img);
          slot.innerHTML = `
            <img src="data:${img.mimeType};base64,${img.data}" alt="Composition">
            <button class="slot-remove-btn" title="Remove image" data-slot="${slotIndex}">×</button>
          `;
          slot.classList.add('filled');
        }
      }
    };
    // Removed double-click handler - now using 'x' button
  });

  const textArea = document.getElementById('composition-text');
  if (textArea) {
    textArea.ondragover = (e) => e.preventDefault();
    textArea.ondrop = (e) => {
      e.preventDefault();
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'text') {
        const text = state.savedData.texts.find(t => t.id === data.id);
        if (text) {
          const currentText = textArea.value;
          const insert = text.name ? `[${text.name}]` : text.text;
          textArea.value = currentText ? `${currentText} ${insert}` : insert;
        }
      }
    };
  }
}

function setupSlotClickUpload() {
  const slotFileInput = document.getElementById('slot-file-input');
  const slots = document.querySelectorAll('.image-slot');
  let activeSlotIndex = null;
  slots.forEach(slot => {
    slot.onclick = () => { activeSlotIndex = parseInt(slot.dataset.slot); slotFileInput?.click(); };
  });
  if (slotFileInput) {
    slotFileInput.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file || activeSlotIndex === null) { e.target.value = ''; return; }
      const base64 = await readAsBase64(file);
      const resp = await fetch('/api/save-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, mimeType: file.type, name: file.name.replace(/\.[^/.]+$/, '') })
      });
      const { id } = await resp.json();
      const newImage = { id, data: base64, mimeType: file.type, name: file.name.replace(/\.[^/.]+$/, '') };
      state.savedData.images.push(newImage);
      setCompositionImage(activeSlotIndex, newImage);
      const slotEl = document.querySelector(`.image-slot[data-slot="${activeSlotIndex}"]`);
      if (slotEl) {
        slotEl.innerHTML = `
          <img src="data:${newImage.mimeType};base64,${newImage.data}" alt="Composition">
          <button class="slot-remove-btn" title="Remove image" data-slot="${activeSlotIndex}">×</button>
        `;
        slotEl.classList.add('filled');
      }
      activeSlotIndex = null;
      e.target.value = '';
    };
  }
}

export function showPreview() {
  const rawText = document.getElementById('composition-text').value;
  const expandedText = expandSnippetNames(rawText);
  const activeImages = state.compositionImages.filter(img => img !== null);
  const requestPreview = buildGeminiRequestPreview(expandedText, activeImages);
  const jsonStr = JSON.stringify(requestPreview, null, 2);
  const jsonEl = document.getElementById('preview-json');
  if (jsonEl) jsonEl.textContent = jsonStr;
  document.getElementById('preview-modal').style.display = 'flex';
}

export async function generate() {
  const rawText = document.getElementById('composition-text').value;
  const text = expandSnippetNames(rawText);
  const activeImages = state.compositionImages.filter(img => img !== null);
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
  const response = await fetch('/api/compose', { method: 'POST', body: formData });
  const data = await response.json();
  displayImage(data.image);
  setLoading('generate-btn', false);
}

export function updateSlotsUsing(imageId) {
  document.querySelectorAll('.image-slot').forEach((slot, idx) => {
    const current = state.compositionImages[idx];
    if (current && current.id === imageId) {
      slot.innerHTML = `
        <img src="data:${current.mimeType};base64,${current.data}" alt="Composition">
        <button class="slot-remove-btn" title="Remove image" data-slot="${idx}">×</button>
      `;
      slot.classList.add('filled');
    }
  });
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

function buildGeminiRequestPreview(text, images) {
  const contents = [text];
  for (const img of images) {
    contents.push({ inlineData: { data: `[${img.name || 'temp image'}]`, mimeType: img.mimeType } });
    if (img.caption && img.caption.trim()) contents.push(img.caption.trim());
  }
  return { model: 'gemini-2.5-flash-image-preview', contents };
}

function expandSnippetNames(input) {
  return input.replace(/\[(.+?)\]/g, (match, name) => {
    const found = state.savedData.texts.find(t => (t.name || '').toLowerCase() === name.toLowerCase());
    return found ? found.text : match;
  });
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
