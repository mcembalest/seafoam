// Text instruction editing modal

import { patchText } from './api.js';
import { updateTextInSaved } from './state.js';

export function openTextEditor(item) {
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
      await patchText(item.id, payload);
      updateTextInSaved(item.id, payload);
      cleanup();
    };
    const doCancel = () => { cleanup(); };
    function cleanup() {
      modal.style.display = 'none';
      document.removeEventListener('keydown', onKey);
      saveBtn.onclick = null;
      cancelBtn.onclick = null;
    }
    saveBtn.onclick = doSave;
    cancelBtn.onclick = doCancel;
    document.addEventListener('keydown', onKey);
    setTimeout(() => nameInput.focus(), 0);
  }
  