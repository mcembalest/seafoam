// Frontend bootstrap (galapagOS + Seafoam)

import { getSaved } from './libraryAPI.js';
import { getUiConfig } from './galapagOS/api/uiConfig.js';
import { setUiConfigState } from './galapagOS/state/uiState.js';
import { setSavedData } from './state.js';
import { startStatusPolling } from './galapagOS/status.js';
import { initFilesystem } from './filesystem.js';
import { initComposition } from './composer.js';
import { initLayout } from './layout.js';

/**
 * [galapagOS] Initialize UI config and status; [Seafoam] load saved data and init modules.
 */
async function bootstrap() {
  try {
    // Pre-apply cached UI to reduce CLS before network
    try {
      const savedHeight = localStorage.getItem('libraryHeight') || localStorage.getItem('savedPanelHeight');
      if (savedHeight) document.documentElement.style.setProperty('--library-height', savedHeight);
      const cards = JSON.parse(localStorage.getItem('cardsLayout') || 'null');
      if (cards) {
        const r = document.documentElement.style;
        const pick = (v, d) => (typeof v === 'number' && !Number.isNaN(v) ? v : d);
        const cIn = cards.composition || {}; const oIn = cards.output || {};
        r.setProperty('--comp-x', pick(cIn.x, 40) + 'px');
        r.setProperty('--comp-y', pick(cIn.y, 120) + 'px');
        r.setProperty('--comp-w', pick(cIn.w, 460) + 'px');
        r.setProperty('--comp-h', pick(cIn.h, 360) + 'px');
        r.setProperty('--out-x', pick(oIn.x, 560) + 'px');
        r.setProperty('--out-y', pick(oIn.y, 120) + 'px');
        r.setProperty('--out-w', pick(oIn.w, 520) + 'px');
        r.setProperty('--out-h', pick(oIn.h, 420) + 'px');
      }
    } catch (_) {}

    const cfg = await getUiConfig();
    setUiConfigState(cfg);
    // Pre-size cards via CSS variables to avoid CLS before JS layouts
    try {
      const cards = (cfg && cfg.layout && cfg.layout.cards) || {};
      const pick = (v, d) => (typeof v === 'number' && !Number.isNaN(v) ? v : d);
      const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
      const cIn = cards.composition || {};
      const oIn = cards.output || {};
      const headerPad = 120;
      const c = {
        x: clamp(pick(cIn.x, 40), 12, Math.max(12, window.innerWidth - pick(cIn.w, 460) - 16)),
        y: clamp(pick(cIn.y, 120), headerPad, Math.max(headerPad, window.innerHeight - pick(cIn.h, 360) - 24)),
        w: Math.max(320, pick(cIn.w, 460)),
        h: Math.max(240, pick(cIn.h, 360))
      };
      const o = {
        x: clamp(pick(oIn.x, 560), 12, Math.max(12, window.innerWidth - pick(oIn.w, 520) - 16)),
        y: clamp(pick(oIn.y, 120), headerPad, Math.max(headerPad, window.innerHeight - pick(oIn.h, 420) - 24)),
        w: Math.max(320, pick(oIn.w, 520)),
        h: Math.max(240, pick(oIn.h, 420))
      };
      const r = document.documentElement.style;
      r.setProperty('--comp-x', (c.x) + 'px');
      r.setProperty('--comp-y', (c.y) + 'px');
      r.setProperty('--comp-w', (c.w) + 'px');
      r.setProperty('--comp-h', (c.h) + 'px');
      r.setProperty('--out-x', (o.x) + 'px');
      r.setProperty('--out-y', (o.y) + 'px');
      r.setProperty('--out-w', (o.w) + 'px');
      r.setProperty('--out-h', (o.h) + 'px');
    } catch (_) {}
    if (cfg?.panel?.height) {
      document.documentElement.style.setProperty('--library-height', cfg.panel.height);
    }
    if (cfg?.background?.url) {
      document.documentElement.style.setProperty('--app-bg-url', `url('${cfg.background.url}')`);
    }
  } catch (_) {}

  try {
    const data = await getSaved();
    setSavedData(data);
  } catch (_) {}

  initFilesystem();
  initComposition();
  initLayout();
  startStatusPolling(10000);
}

document.addEventListener('DOMContentLoaded', bootstrap);
