

import { state } from './state.js';
import { putUiConfig } from './api.js';

export function initLayout() {
  setupSavedPanelToggle();
  setupPanelResizer();
  setupCanvasCards();
  setupBackgroundPicker();
}

function setupSavedPanelToggle() {
  const toggleBtn = document.getElementById('drawer-toggle') || document.getElementById('toggle-saved-btn');
  const panel = document.getElementById('side-panel') || document.getElementById('save-panel');
  const savedOpen = localStorage.getItem('savedPanelOpen');
  const savedHeight = localStorage.getItem('savedPanelHeight');
  if (savedHeight) document.documentElement.style.setProperty('--saved-panel-height', savedHeight);
  if (savedOpen === 'true') panel.classList.add('open');
  else if (state.uiConfig?.panel?.open) panel.classList.add('open');
  const openPanel = () => { panel.classList.add('open'); localStorage.setItem('savedPanelOpen', 'true'); if (toggleBtn && toggleBtn.id === 'drawer-toggle') toggleBtn.textContent = 'Image + Instruction Library ▼'; };
  const closePanel = () => { panel.classList.remove('open'); localStorage.setItem('savedPanelOpen', 'false'); if (toggleBtn && toggleBtn.id === 'drawer-toggle') toggleBtn.textContent = 'Image + Instruction Library ▲'; };
  if (toggleBtn) toggleBtn.onclick = () => { if (panel.classList.contains('open')) closePanel(); else openPanel(); };
}

function setupPanelResizer() {
  const grabber = document.getElementById('panel-grabber');
  if (!grabber) return;
  let startY = 0; let startHeight = 0;
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
}

function setupCanvasCards() {
  const uiConfig = state.uiConfig;
  const defaults = { composition: { x: 40, y: 120, w: 460, h: 360 }, output: { x: 560, y: 120, w: 520, h: 420 } };
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
    const toRect = (el) => ({ x: parseInt(el.style.left || '0'), y: parseInt(el.style.top || '0'), w: parseInt(el.style.width || el.offsetWidth), h: parseInt(el.style.height || el.offsetHeight) });
    const payload = { ...(state.uiConfig || {}), layout: { ...(state.uiConfig && state.uiConfig.layout ? state.uiConfig.layout : {}), cards: { composition: toRect(composition), output: toRect(output) } } };
    try { await putUiConfig(payload); } catch (_) {}
  };

  const enableDrag = (card) => {
    const handle = card.querySelector('.card-drag-handle') || card;
    let dragging = false; let startX = 0; let startY = 0; let baseLeft = 0; let baseTop = 0;
    const onMove = (e) => { if (!dragging) return; const x = e.touches ? e.touches[0].clientX : e.clientX; const y = e.touches ? e.touches[0].clientY : e.clientY; const dx = x - startX; const dy = y - startY; card.style.left = baseLeft + dx + 'px'; card.style.top = baseTop + dy + 'px'; };
    const onEnd = () => { if (!dragging) return; dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('touchmove', onMove); document.removeEventListener('mouseup', onEnd); document.removeEventListener('touchend', onEnd); saveLayout(); };
    const onStart = (e) => { if ((e.target && e.target.closest('.card-resize-handle')) || (e.button && e.button !== 0)) return; dragging = true; startX = e.touches ? e.touches[0].clientX : e.clientX; startY = e.touches ? e.touches[0].clientY : e.clientY; baseLeft = parseInt(card.style.left || '0'); baseTop = parseInt(card.style.top || '0'); document.addEventListener('mousemove', onMove); document.addEventListener('touchmove', onMove, { passive: false }); document.addEventListener('mouseup', onEnd); document.addEventListener('touchend', onEnd); };
    handle.addEventListener('mousedown', onStart); handle.addEventListener('touchstart', onStart, { passive: true });
  };

  const enableResize = (card) => {
    const handle = card.querySelector('.card-resize-handle');
    if (!handle) return;
    let resizing = false; let startX = 0; let startY = 0; let baseW = 0; let baseH = 0;
    const onMove = (e) => { if (!resizing) return; const x = e.touches ? e.touches[0].clientX : e.clientX; const y = e.touches ? e.touches[0].clientY : e.clientY; const dx = x - startX; const dy = y - startY; card.style.width = Math.max(320, baseW + dx) + 'px'; card.style.height = Math.max(240, baseH + dy) + 'px'; };
    const onEnd = () => { if (!resizing) return; resizing = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('touchmove', onMove); document.removeEventListener('mouseup', onEnd); document.removeEventListener('touchend', onEnd); saveLayout(); };
    const onStart = (e) => { e.stopPropagation(); resizing = true; startX = e.touches ? e.touches[0].clientX : e.clientX; startY = e.touches ? e.touches[0].clientY : e.clientY; baseW = parseInt(card.style.width || card.offsetWidth); baseH = parseInt(card.style.height || card.offsetHeight); document.addEventListener('mousemove', onMove); document.addEventListener('touchmove', onMove, { passive: false }); document.addEventListener('mouseup', onEnd); document.addEventListener('touchend', onEnd); };
    handle.addEventListener('mousedown', onStart); handle.addEventListener('touchstart', onStart, { passive: true });
  };

  if (composition) { enableDrag(composition); enableResize(composition); }
  if (output) { enableDrag(output); enableResize(output); }
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
      const payload = { ...(state.uiConfig || {}), background: { url: dataUrl } };
      document.documentElement.style.setProperty('--app-bg-url', `url('${dataUrl}')`);
      try { await putUiConfig(payload); } catch (_) {}
    };
    reader.readAsDataURL(file);
  };
}
