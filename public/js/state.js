// Lightweight app state with pub/sub (galapagOS + seafoam)

/**
 * [galapagOS] Simple pub/sub registry for reactive updates across modules.
 * Map<string, Set<Function>>
 */
const listeners = new Map();

/**
 * [Seafoam] In-memory application state for Seafoam.
 */
export const state = {
  savedData: { images: [], texts: [] },
  compositionImages: [null, null, null],
  uiConfig: null,
};

/**
 * [galapagOS] Subscribe to an event.
 * @param {string} event
 * @param {(payload:any)=>void} cb
 * @returns {()=>void} unsubscribe
 */
export function subscribe(event, cb) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(cb);
  return () => listeners.get(event)?.delete(cb);
}

/**
 * [galapagOS] Emit an event with payload to all subscribers.
 * @param {string} event
 * @param {any} payload
 */
export function emit(event, payload) {
  const set = listeners.get(event);
  if (set) set.forEach((cb) => cb(payload));
}

/**
 * [Seafoam] Replace saved data (images, texts) and notify listeners.
 * @param {{images:Array,texts:Array}} data
 */
export function setSavedData(data) {
  state.savedData = data;
  emit('savedData:change', data);
}

/**
 * [galapagOS] Replace UI config and notify listeners.
 * @param {object} cfg
 */
export function setUiConfig(cfg) {
  state.uiConfig = cfg;
  emit('uiConfig:change', cfg);
}

/**
 * [Seafoam] Set a composition slot image and notify listeners.
 * @param {number} idx
 * @param {object|null} img
 */
export function setCompositionImage(idx, img) {
  state.compositionImages[idx] = img;
  emit('compositionImages:change', state.compositionImages);
}

/**
 * [Seafoam] Update an image entry in savedData and notify listeners.
 * @param {string} id
 * @param {object} updates
 */
export function updateImageInSaved(id, updates) {
  const img = state.savedData.images.find((i) => i.id === id);
  if (img) Object.assign(img, updates);
  emit('savedData:change', state.savedData);
}

/**
 * [Seafoam] Update a text entry in savedData and notify listeners.
 * @param {string} id
 * @param {object} updates
 */
export function updateTextInSaved(id, updates) {
  const t = state.savedData.texts.find((i) => i.id === id);
  if (t) Object.assign(t, updates);
  emit('savedData:change', state.savedData);
}

