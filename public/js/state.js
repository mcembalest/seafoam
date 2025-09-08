const listeners = new Map();

export const state = {
    savedData: { images: [], texts: [] },
    compositionImages: [null, null, null],
    uiConfig: null
};

export function subscribe(event, cb) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(cb);
    return () => listeners.get(event)?.delete(cb);
}

export function emit(event, payload) {
    const set = listeners.get(event);
    if (set) set.forEach(cb => cb(payload));
}

export function setSavedData(data) {
    state.savedData = data;
    emit('savedData:change', data);
}

export function setUiConfig(cfg) {
    state.uiConfig = cfg;
    emit('uiConfig:change', cfg);
}

export function setCompositionImage(idx, img) {
    state.compositionImages[idx] = img;
    emit('compositionImages:change', state.compositionImages);
}

