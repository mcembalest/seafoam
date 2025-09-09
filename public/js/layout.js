// Layout elements (galapagOS + seafoam)

import { state, setUiConfig } from './state.js';
import { putUiConfig } from './api.js';

export function initLayout() {
  setupLibraryToggle();
  setupPanelResizer();
  setupCanvasCards();
  setupBackgroundPicker();
  // Best-effort save on page unload to avoid losing last changes
  try {
    window.addEventListener('beforeunload', () => {
      const composition = document.querySelector('.canvas-card[data-card="composition"]');
      const output = document.querySelector('.canvas-card[data-card="output"]');
      const toRect = (el) => ({
        x: parseInt(el?.style.left || '0'),
        y: parseInt(el?.style.top || '0'),
        w: parseInt(el?.style.width || el?.offsetWidth || '0'),
        h: parseInt(el?.style.height || el?.offsetHeight || '0')
      });
      const panel = document.getElementById('library-panel') || document.getElementById('side-panel') || document.getElementById('save-panel');
      const uiPanel = {
        ...(state.uiConfig && state.uiConfig.panel ? state.uiConfig.panel : {}),
        open: !!panel?.classList.contains('open'),
        height: getComputedStyle(document.documentElement).getPropertyValue('--library-height').trim() || (state.uiConfig?.panel?.height || '28vh')
      };
      const payload = {
        ...(state.uiConfig || {}),
        panel: uiPanel,
        layout: {
          ...(state.uiConfig && state.uiConfig.layout ? state.uiConfig.layout : {}),
          cards: {
            composition: composition ? toRect(composition) : (state.uiConfig?.layout?.cards?.composition || {}),
            output: output ? toRect(output) : (state.uiConfig?.layout?.cards?.output || {})
          }
        }
      };
      try {
        fetch('/api/ui-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        });
      } catch (_) {}
    });
  } catch (_) {}
}

function setupLibraryToggle() {
  const toggleBtn = document.getElementById('drawer-toggle') || document.getElementById('toggle-saved-btn');
  const panel = document.getElementById('library-panel') || document.getElementById('side-panel') || document.getElementById('save-panel');
  // Backward-compatible: prefer new keys, fall back to legacy
  const savedOpen = localStorage.getItem('libraryOpen') ?? localStorage.getItem('savedPanelOpen');
  const savedHeight = localStorage.getItem('libraryHeight') ?? localStorage.getItem('savedPanelHeight');
  if (savedHeight) {
    document.documentElement.style.setProperty('--library-height', savedHeight);
  }
  if (savedOpen === 'true') panel?.classList.add('open');
  else if (state.uiConfig?.panel?.open) panel?.classList.add('open');
  const persistPanel = (partial) => {
    const next = {
      ...(state.uiConfig || {}),
      panel: {
        ...(state.uiConfig && state.uiConfig.panel ? state.uiConfig.panel : {}),
        ...partial
      }
    };
    setUiConfig(next);
    try { putUiConfig(next); } catch (_) {}
  };
  const openPanel = () => {
    panel?.classList.add('open');
    localStorage.setItem('libraryOpen', 'true');
    localStorage.setItem('savedPanelOpen', 'true');
    if (toggleBtn && toggleBtn.id === 'drawer-toggle') toggleBtn.textContent = 'Image + Instruction Library ▼';
    persistPanel({ open: true });
  };
  const closePanel = () => {
    panel?.classList.remove('open');
    localStorage.setItem('libraryOpen', 'false');
    localStorage.setItem('savedPanelOpen', 'false');
    if (toggleBtn && toggleBtn.id === 'drawer-toggle') toggleBtn.textContent = 'Image + Instruction Library ▲';
    persistPanel({ open: false });
  };
  if (toggleBtn && panel) toggleBtn.onclick = () => { if (panel.classList.contains('open')) closePanel(); else openPanel(); };
}

function setupPanelResizer() {
  const grabber = document.getElementById('panel-grabber');
  if (!grabber) return;
  let startY = 0; let startHeight = 0; let active = false;

  const computeStartHeight = () => {
    const current = getComputedStyle(document.documentElement).getPropertyValue('--library-height').trim();
    const vh = current.endsWith('vh') ? parseFloat(current) : 28;
    startHeight = (vh / 100) * window.innerHeight;
  };
  const applyY = (clientY) => {
    const dy = startY - clientY;
    const newVh = Math.max(18, Math.min(60, ((startHeight + dy) / window.innerHeight) * 100));
    const value = newVh.toFixed(1) + 'vh';
    document.documentElement.style.setProperty('--library-height', value);
  };
  const persist = () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--library-height').trim();
    if (value) {
      localStorage.setItem('libraryHeight', value);
      localStorage.setItem('savedPanelHeight', value);
      const next = {
        ...(state.uiConfig || {}),
        panel: {
          ...(state.uiConfig && state.uiConfig.panel ? state.uiConfig.panel : {}),
          height: value
        }
      };
      setUiConfig(next);
      try { putUiConfig(next); } catch (_) {}
    }
  };

  // Pointer events (cover mouse + touch)
  const onPointerMove = (e) => { if (!active) return; e.preventDefault(); applyY(e.clientY); };
  const onPointerUp = () => { if (!active) return; active = false; window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp); persist(); };
  const onPointerDown = (e) => { active = true; startY = e.clientY; computeStartHeight(); window.addEventListener('pointermove', onPointerMove, { passive: false }); window.addEventListener('pointerup', onPointerUp); };
  grabber.addEventListener('pointerdown', onPointerDown);

  // Fallback legacy handlers
  const onMove = (e) => { if (!active) return; const y = e.touches ? e.touches[0].clientY : e.clientY; applyY(y); };
  const onEnd = () => { if (!active) return; active = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('touchmove', onMove); document.removeEventListener('mouseup', onEnd); document.removeEventListener('touchend', onEnd); persist(); };
  const onStart = (e) => { active = true; startY = e.touches ? e.touches[0].clientY : e.clientY; computeStartHeight(); document.addEventListener('mousemove', onMove); document.addEventListener('touchmove', onMove, { passive: false }); document.addEventListener('mouseup', onEnd); document.addEventListener('touchend', onEnd); };
  grabber.addEventListener('mousedown', onStart);
  grabber.addEventListener('touchstart', onStart, { passive: true });
}

function setupCanvasCards() {
  const uiConfig = state.uiConfig;
  const defaults = { composition: { x: 40, y: 120, w: 460, h: 360 }, output: { x: 560, y: 120, w: 520, h: 420 } };
  const applyLayout = (key, el) => {
    const cfg = (uiConfig && uiConfig.layout && uiConfig.layout.cards && uiConfig.layout.cards[key]) || defaults[key];
    const pick = (v, d) => (typeof v === 'number' && !Number.isNaN(v) ? v : d);
    const headerPad = 120; // avoid pushing cards under the browser/UI chrome
    const minLeft = 12, minTop = headerPad;
    let x = Math.max(minLeft, pick(cfg.x, defaults[key].x));
    let y = Math.max(minTop, pick(cfg.y, defaults[key].y));
    let w = Math.max(320, pick(cfg.w, defaults[key].w));
    let h = Math.max(240, pick(cfg.h, defaults[key].h));
    // Keep within viewport horizontally
    const maxX = Math.max(minLeft, window.innerWidth - w - 16);
    const maxY = Math.max(minTop, window.innerHeight - h - 24);
    x = Math.min(x, maxX);
    y = Math.min(y, maxY);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';

    // Also update CSS variables to match inline styles to ensure consistency
    const varPrefix = key === 'composition' ? '--comp' : '--out';
    document.documentElement.style.setProperty(`${varPrefix}-x`, x + 'px');
    document.documentElement.style.setProperty(`${varPrefix}-y`, y + 'px');
    document.documentElement.style.setProperty(`${varPrefix}-w`, w + 'px');
    document.documentElement.style.setProperty(`${varPrefix}-h`, h + 'px');
  };
  const composition = document.querySelector('.canvas-card[data-card="composition"]');
  const output = document.querySelector('.canvas-card[data-card="output"]');
  if (composition) applyLayout('composition', composition);
  if (output) applyLayout('output', output);

  const saveLayout = async () => {
    const toRect = (el) => {
      // Use inline styles since they take precedence over CSS variables
      return {
        x: parseInt(el.style.left || '0'),
        y: parseInt(el.style.top || '0'),
        w: parseInt(el.style.width || el.offsetWidth),
        h: parseInt(el.style.height || el.offsetHeight)
      };
    };
    const payload = { ...(state.uiConfig || {}), layout: { ...(state.uiConfig && state.uiConfig.layout ? state.uiConfig.layout : {}), cards: { composition: toRect(composition), output: toRect(output) } } };
    console.log('saving layout', payload);
    try { await putUiConfig(payload); } catch (_) {}
  };

  const enableDrag = (card) => {
    const handle = card.querySelector('.card-drag-handle') || card;
    let dragging = false; let startX = 0; let startY = 0; let baseLeft = 0; let baseTop = 0;
    const onMove = (e) => {
      if (!dragging) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = x - startX;
      const dy = y - startY;
      const newLeft = baseLeft + dx;
      const newTop = baseTop + dy;
      card.style.left = newLeft + 'px';
      card.style.top = newTop + 'px';

      // Also update CSS variables to match
      const varPrefix = card.dataset.card === 'composition' ? '--comp' : '--out';
      document.documentElement.style.setProperty(`${varPrefix}-x`, newLeft + 'px');
      document.documentElement.style.setProperty(`${varPrefix}-y`, newTop + 'px');
    };
    const onEnd = () => { if (!dragging) return; dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('touchmove', onMove); document.removeEventListener('mouseup', onEnd); document.removeEventListener('touchend', onEnd); saveLayout(); };
    const onStart = (e) => {
      if ((e.target && e.target.closest('.card-resize-handle')) || (e.button && e.button !== 0)) return;
      dragging = true;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      const computed = getComputedStyle(card);
      baseLeft = parseInt(computed.left || '0');
      baseTop = parseInt(computed.top || '0');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchend', onEnd);
    };
    handle.addEventListener('mousedown', onStart); handle.addEventListener('touchstart', onStart, { passive: true });
  };

  const enableResize = (card) => {
    const handle = card.querySelector('.card-resize-handle');
    if (!handle) return;
    let resizing = false; let startX = 0; let startY = 0; let baseW = 0; let baseH = 0;
    const onMove = (e) => {
      if (!resizing) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = x - startX;
      const dy = y - startY;
      const newWidth = Math.max(320, baseW + dx);
      const newHeight = Math.max(240, baseH + dy);
      card.style.width = newWidth + 'px';
      card.style.height = newHeight + 'px';

      // Also update CSS variables to match
      const varPrefix = card.dataset.card === 'composition' ? '--comp' : '--out';
      document.documentElement.style.setProperty(`${varPrefix}-w`, newWidth + 'px');
      document.documentElement.style.setProperty(`${varPrefix}-h`, newHeight + 'px');
    };
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
