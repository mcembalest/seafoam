// Layout configuration (galapagOS + Seafoam)

import { initPlatformLayout, attachBackgroundPicker } from './galapagOS/layout/init.js';

/**
 * App layout wiring via platform initializer.
 */
export function initLayout() {
  const panel = document.getElementById('library-panel') || document.getElementById('side-panel') || document.getElementById('save-panel');
  const toggleBtn = document.getElementById('drawer-toggle') || document.getElementById('toggle-saved-btn');
  const composition = document.querySelector('.canvas-card[data-card="composition"]');
  const output = document.querySelector('.canvas-card[data-card="output"]');

  // Apply persisted open/height before wiring
  try {
    const savedOpen = localStorage.getItem('libraryOpen') ?? localStorage.getItem('savedPanelOpen');
    const savedHeight = localStorage.getItem('libraryHeight') ?? localStorage.getItem('savedPanelHeight');
    if (savedOpen === 'true') panel?.classList.add('open');
    if (savedHeight) document.documentElement.style.setProperty('--library-height', savedHeight);
  } catch (_) {}

  initPlatformLayout({
    panelEl: panel,
    toggleBtnEl: toggleBtn,
    onToggleLabel: (open) => {
      if (toggleBtn && toggleBtn.id === 'drawer-toggle') {
        toggleBtn.textContent = open ? 'Image + Instruction Library ▼' : 'Image + Instruction Library ▲';
      }
    },
    cssVarPanel: '--library-height',
    cards: [
      composition ? {
        key: 'composition',
        el: composition,
        dragHandleEl: composition.querySelector('.card-drag-handle') || composition,
        resizeHandleEl: composition.querySelector('.card-resize-handle'),
        varPrefix: '--comp'
      } : null,
      output ? {
        key: 'output',
        el: output,
        dragHandleEl: output.querySelector('.card-drag-handle') || output,
        resizeHandleEl: output.querySelector('.card-resize-handle'),
        varPrefix: '--out'
      } : null,
    ].filter(Boolean)
  });

  // Background picker helper
  attachBackgroundPicker({ inputEl: document.getElementById('bg-input') });
}
