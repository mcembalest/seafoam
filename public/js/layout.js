// Layout configuration (galapagOS + Seafoam)

import { putUiConfig } from './galapagOS/api/uiConfig.js';
import { setUiConfigState, getUiConfigState } from './galapagOS/state/uiState.js';
import { attachPanelToggle, attachPanelResizer } from './galapagOS/components/panel.js';
import { attachCardBehavior } from './galapagOS/components/card.js';

/**
 * [galapagOS] Initialize layout behaviors: panel, cards, background picker.
 */
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
      const currentCfg = getUiConfigState();
      const uiPanel = {
        ...(currentCfg && currentCfg.panel ? currentCfg.panel : {}),
        open: !!panel?.classList.contains('open'),
        height: getComputedStyle(document.documentElement).getPropertyValue('--library-height').trim() || (currentCfg?.panel?.height || '28vh')
      };
      const payload = {
        ...(currentCfg || {}),
        panel: uiPanel,
        layout: {
          ...(currentCfg && currentCfg.layout ? currentCfg.layout : {}),
          cards: {
            composition: composition ? toRect(composition) : (currentCfg?.layout?.cards?.composition || {}),
            output: output ? toRect(output) : (currentCfg?.layout?.cards?.output || {})
          }
        }
      };
      try {
        // cache locally for faster next paint
        try {
          localStorage.setItem('cardsLayout', JSON.stringify({
            composition: composition ? toRect(composition) : undefined,
            output: output ? toRect(output) : undefined,
          }));
        } catch (_) {}
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

/**
 * [galapagOS] Toggle the library/side panel open/close and persist state.
 */
function setupLibraryToggle() {
  const toggleBtn = document.getElementById('drawer-toggle') || document.getElementById('toggle-saved-btn');
  const panel = document.getElementById('library-panel') || document.getElementById('side-panel') || document.getElementById('save-panel');
  // Backward-compatible: prefer new keys, fall back to legacy
  const savedOpen = localStorage.getItem('libraryOpen') ?? localStorage.getItem('savedPanelOpen');
  const savedHeight = localStorage.getItem('libraryHeight') ?? localStorage.getItem('savedPanelHeight');
  if (savedHeight) document.documentElement.style.setProperty('--library-height', savedHeight);
  const cfg = getUiConfigState();
  if (savedOpen === 'true') panel?.classList.add('open');
  else if (cfg?.panel?.open) panel?.classList.add('open');

  attachPanelToggle({
    panelEl: panel,
    toggleBtnEl: toggleBtn,
    onToggle: (open) => {
      localStorage.setItem('libraryOpen', open ? 'true' : 'false');
      localStorage.setItem('savedPanelOpen', open ? 'true' : 'false');
      const next = {
        ...(getUiConfigState() || {}),
        panel: {
          ...((getUiConfigState() && getUiConfigState().panel) ? getUiConfigState().panel : {}),
          open
        }
      };
      setUiConfigState(next);
      try { putUiConfig(next); } catch (_) {}
    }
  });
}

/**
 * [galapagOS] Enable panel height resizing with persistence.
 */
function setupPanelResizer() {
  const grabber = document.getElementById('panel-grabber');
  if (!grabber) return;
  attachPanelResizer({
    grabberEl: grabber,
    cssVar: '--library-height',
    minVh: 18,
    maxVh: 60,
    onResizeEnd: (value) => {
      if (!value) return;
      localStorage.setItem('libraryHeight', value);
      localStorage.setItem('savedPanelHeight', value);
      const next = {
        ...(getUiConfigState() || {}),
        panel: {
          ...((getUiConfigState() && getUiConfigState().panel) ? getUiConfigState().panel : {}),
          height: value
        }
      };
      setUiConfigState(next);
      try { putUiConfig(next); } catch (_) {}
    }
  });
}

/**
 * [galapagOS] Cards: apply initial layout, attach drag/resize via platform, and persist on commit.
 */
function setupCanvasCards() {
  const applyLayout = (key, el) => {
    const cfg = getUiConfigState();
    const rect = cfg?.layout?.cards?.[key] || {};
    const x = parseInt(rect.x || getComputedStyle(document.documentElement).getPropertyValue(key === 'composition' ? '--comp-x' : '--out-x')) || 0;
    const y = parseInt(rect.y || getComputedStyle(document.documentElement).getPropertyValue(key === 'composition' ? '--comp-y' : '--out-y')) || 0;
    const w = parseInt(rect.w || getComputedStyle(document.documentElement).getPropertyValue(key === 'composition' ? '--comp-w' : '--out-w')) || el.offsetWidth;
    const h = parseInt(rect.h || getComputedStyle(document.documentElement).getPropertyValue(key === 'composition' ? '--comp-h' : '--out-h')) || el.offsetHeight;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
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
    const toRect = (el) => ({
      x: parseInt(el.style.left || '0'),
      y: parseInt(el.style.top || '0'),
      w: parseInt(el.style.width || el.offsetWidth),
      h: parseInt(el.style.height || el.offsetHeight)
    });
    const curr = getUiConfigState();
    const payload = {
      ...(curr || {}),
      layout: {
        ...(curr && curr.layout ? curr.layout : {}),
        cards: {
          composition: composition ? toRect(composition) : (curr?.layout?.cards?.composition || {}),
          output: output ? toRect(output) : (curr?.layout?.cards?.output || {})
        }
      }
    };
    try {
      // Also cache locally to reduce CLS on next load
      const cached = {
        composition: payload.layout.cards.composition,
        output: payload.layout.cards.output,
      };
      localStorage.setItem('cardsLayout', JSON.stringify(cached));
    } catch (_) {}
    try { await putUiConfig(payload); } catch (_) {}
  };

  const commitCard = async () => { await saveLayout(); };
  if (composition) {
    attachCardBehavior({
      cardEl: composition,
      dragHandleEl: composition.querySelector('.card-drag-handle') || composition,
      resizeHandleEl: composition.querySelector('.card-resize-handle'),
      onCommit: commitCard
    });
  }
  if (output) {
    attachCardBehavior({
      cardEl: output,
      dragHandleEl: output.querySelector('.card-drag-handle') || output,
      resizeHandleEl: output.querySelector('.card-resize-handle'),
      onCommit: commitCard
    });
  }
}

/**
 * [Seafoam] Allow changing the app background image and persist in UI config.
 */
function setupBackgroundPicker() {
  const input = document.getElementById('bg-input');
  if (!input) return;
  input.onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target.result;
      const cfg = getUiConfigState();
      const payload = { ...(cfg || {}), background: { url: dataUrl } };
      document.documentElement.style.setProperty('--app-bg-url', `url('${dataUrl}')`);
      try { await putUiConfig(payload); } catch (_) {}
    };
    reader.readAsDataURL(file);
  };
}
