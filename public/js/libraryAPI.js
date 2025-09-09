// API for Library of images and text instructions

/**
 * [Seafoam] Fetch all saved items (images, texts) for the current app.
 * @returns {Promise<{images: Array, texts: Array, ui?: object}>}
 */
export async function getSaved() {
  const res = await fetch('/api/saved');
  if (!res.ok) throw new Error('getSaved failed');
  return res.json();
}

/**
 * [Seafoam] Save an image to the library.
 * @param {{data:string, mimeType:string, name?:string, size?:number, createdAt?:number, caption?:string}} payload
 * @returns {Promise<{id:string, name:string, size:number, createdAt:number, caption?:string}>}
 */
export async function saveImage(payload) {
  const res = await fetch('/api/save-image', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('saveImage failed');
  return res.json();
}

/**
 * [Seafoam] Save a text instruction to the library.
 * @param {{text:string, name?:string, size?:number, createdAt?:number}} payload
 * @returns {Promise<{id:string, name:string, size:number, createdAt:number}>}
 */
export async function saveText(payload) {
  const res = await fetch('/api/save-text', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('saveText failed');
  return res.json();
}

/**
 * [Seafoam] Delete an image from the library.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteImage(id) {
  const res = await fetch(`/api/saved/image/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('deleteImage failed');
}

/**
 * [Seafoam] Delete a text instruction from the library.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteText(id) {
  const res = await fetch(`/api/saved/text/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('deleteText failed');
}

/**
 * [Seafoam] Update image metadata or data.
 * @param {string} id
 * @param {{name?:string, data?:string, mimeType?:string, size?:number, caption?:string}} payload
 * @returns {Promise<void>}
 */
export async function patchImage(id, payload) {
  const res = await fetch(`/api/saved/image/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('patchImage failed');
}

/**
 * [Seafoam] Update text metadata or content.
 * @param {string} id
 * @param {{name?:string, text?:string}} payload
 * @returns {Promise<void>}
 */
export async function patchText(id, payload) {
  const res = await fetch(`/api/saved/text/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('patchText failed');
}
