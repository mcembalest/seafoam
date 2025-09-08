// Status icon for the server (galapagOS)

export async function pingServer() {
  try {
    const res = await fetch('/health');
    const ok = res.ok;
    setServerStatus(ok);
    return ok;
  } catch (_) {
    setServerStatus(false);
    return false;
  }
}

export function setServerStatus(isOnline) {
  const pill = document.getElementById('server-status');
  if (!pill) return;
  pill.textContent = isOnline ? 'Online' : 'Offline';
  pill.classList.toggle('status-online', !!isOnline);
  pill.classList.toggle('status-offline', !isOnline);
  if (isOnline) {
    pill.title = 'Online: server is running. Gemini requests may still fail; check Inspect > Console for errors if images take longer than 30 seconds.';
  } else {
    pill.title = 'Offline: server is not running and needs inspection.';
  }
}

export function startStatusPolling(intervalMs = 10000) {
  pingServer();
  return setInterval(pingServer, intervalMs);
}

