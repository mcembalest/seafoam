import { getSaved, getUiConfig } from './api.js';
import { setSavedData, setUiConfig } from './state.js';
import { startStatusPolling } from './status.js';

export async function bootstrap() {
    // Load UI config first so initial paint respects saved layout/background
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

    startStatusPolling(10000);
}

bootstrap();

