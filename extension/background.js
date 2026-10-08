// Airlock background service worker.
//
// Every call to the local backend goes through here. Requests from the content
// script would carry the AI site's origin (refused by the backend's CORS, and
// blocked by Chrome's private-network rules); requests from the service worker
// carry the extension's origin and are allowed by host_permissions.

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const REQUEST_TIMEOUT_MS = 120_000; // a Gemma scan can take several seconds

async function backendUrl() {
  const { backendUrl } = await chrome.storage.local.get({ backendUrl: DEFAULT_BACKEND_URL });
  return backendUrl.replace(/\/+$/, "");
}

async function callApi(path, body) {
  const base = await backendUrl();
  const init = body === undefined
    ? { method: "GET" }
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  let res;
  try {
    res = await fetch(base + path, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err && err.name === "TimeoutError";
    return {
      ok: false,
      status: 0,
      detail: timedOut
        ? `The Airlock backend took longer than ${REQUEST_TIMEOUT_MS / 1000}s to answer.`
        : `Can't reach the Airlock backend at ${base}. Is it running?`,
    };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON body; the status code is enough.
  }
  if (!res.ok) {
    const detail = data && typeof data.detail === "string" ? data.detail : `Backend error ${res.status}`;
    return { ok: false, status: res.status, detail };
  }
  return { ok: true, status: res.status, data };
}

// Chat -> scan_id, so placeholders stay stable across messages in one conversation.
// storage.session is memory-only and cleared when the browser closes.
async function getScanId(key) {
  const store = await chrome.storage.session.get({ scanIds: {} });
  return store.scanIds[key] || null;
}

async function setScanId(key, scanId) {
  const store = await chrome.storage.session.get({ scanIds: {} });
  if (scanId) store.scanIds[key] = scanId;
  else delete store.scanIds[key];
  await chrome.storage.session.set({ scanIds: store.scanIds });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg && msg.type) {
      case "api":
        return callApi(msg.path, msg.body);
      case "getScanId":
        return { scanId: await getScanId(msg.key) };
      case "setScanId":
        await setScanId(msg.key, msg.scanId);
        return { ok: true };
      default:
        return { ok: false, status: 0, detail: "Unknown message" };
    }
  })().then(sendResponse);
  return true; // keep the channel open for the async response
});
