// Seafoam frontend code

import { getSaved, getUiConfig } from './api.js';
import { setSavedData, setUiConfig } from './state.js';
import { startStatusPolling } from './status.js';
import { initFilesystem } from './filesystem.js';
import { initComposition } from './composition.js';
import { initLayout } from './layout.js';

async function bootstrap() {
  try {
    const cfg = await getUiConfig();
    setUiConfig(cfg);
    if (cfg?.panel?.height) {
      document.documentElement.style.setProperty('--saved-panel-height', cfg.panel.height);
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
