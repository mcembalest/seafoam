// API utilities for saved items and UI config (galapagOS + seafoam)

export async function getSaved() {
  const res = await fetch('/api/saved');
  if (!res.ok) throw new Error('getSaved failed');
  return res.json();
}

export async function saveImage(payload) {
  const res = await fetch('/api/save-image', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('saveImage failed');
  return res.json();
}

export async function saveText(payload) {
  const res = await fetch('/api/save-text', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('saveText failed');
  return res.json();
}

export async function deleteImage(id) {
  const res = await fetch(`/api/saved/image/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('deleteImage failed');
}

export async function deleteText(id) {
  const res = await fetch(`/api/saved/text/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('deleteText failed');
}

export async function patchImage(id, payload) {
  const res = await fetch(`/api/saved/image/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('patchImage failed');
}

export async function patchText(id, payload) {
  const res = await fetch(`/api/saved/text/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('patchText failed');
}

export async function getUiConfig() {
  const res = await fetch('/api/ui-config');
  if (!res.ok) throw new Error('getUiConfig failed');
  return res.json();
}

export async function putUiConfig(cfg) {
  const res = await fetch('/api/ui-config', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg)
  });
  if (!res.ok) throw new Error('putUiConfig failed');
  return res.json();
}

