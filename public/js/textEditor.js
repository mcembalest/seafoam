// Text instruction editor modal

import { patchText } from './libraryAPI.js';
import { updateTextInSaved } from './state.js';

/**
 * [Seafoam] Open the text editor modal for a saved text instruction.
 * @param {{id:string, name?:string, text:string}} item
 */
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
  