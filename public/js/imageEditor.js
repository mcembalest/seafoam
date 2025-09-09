// Image editor modal

import { patchImage } from './libraryAPI.js';
import { updateImageInSaved } from './state.js';

let cropState = { active: false, start: null, rect: null, image: null, mimeType: null };

/**
 * [Seafoam] Open the image editor modal for a saved image.
 * @param {{id:string, name?:string, caption?:string, data:string, mimeType:string}} item
 * @param {(id:string)=>void} onAfterSave
 */
export function openImageEditor(item, onAfterSave) {
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
  cropState.image.onload = () => drawImageToCanvas(cropState.image, canvas, ctx);
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
    await patchImage(item.id, payload);
    updateImageInSaved(item.id, { name: payload.name, caption: payload.caption, data: base64, mimeType: cropState.mimeType });
        cleanup();
    if (typeof onAfterSave === 'function') onAfterSave(item.id);
  };
  const doCancel = () => { cleanup(); };
  function cleanup() {
    modal.style.display = 'none';
    document.removeEventListener('keydown', onKey);
    canvas.removeEventListener('mousedown', onDown);
    canvas.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('mouseup', onUp);
    canvas.removeEventListener('touchstart', onDown);
    canvas.removeEventListener('touchmove', onMove);
    canvas.removeEventListener('touchend', onUp);
    saveBtn.onclick = null;
    cancelBtn.onclick = null;
    replaceBtn.onclick = null;
    cropToggle.onclick = null;
    cropApply.onclick = null;
    cropCancel.onclick = null;
  }
  saveBtn.onclick = doSave;
  cancelBtn.onclick = doCancel;
  document.addEventListener('keydown', onKey);
}

/**
 * [Seafoam] Draw an image to the canvas preserving aspect ratio.
 */
function drawImageToCanvas(img, canvas, ctx) {
  const cw = canvas.width, ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = Math.min(cw / iw, ch / ih);
  const w = iw * scale, h = ih * scale;
  const x = (cw - w) / 2, y = (ch - h) / 2;
  ctx.drawImage(img, x, y, w, h);
}

/**
 * [Seafoam] Position crop overlay according to a rect.
 */
function positionOverlay(overlay, canvas, r) {
  const rect = normalizeRect(r);
  overlay.style.left = rect.x + 'px';
  overlay.style.top = rect.y + 'px';
  overlay.style.width = rect.w + 'px';
  overlay.style.height = rect.h + 'px';
}

/**
 * [Seafoam] Normalize rect with negative width/height into positive values.
 */
function normalizeRect(r) {
  const x = r.w < 0 ? r.x + r.w : r.x;
  const y = r.h < 0 ? r.y + r.h : r.y;
  const w = Math.abs(r.w);
  const h = Math.abs(r.h);
  return { x, y, w, h };
}
