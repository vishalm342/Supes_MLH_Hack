// Airlock popup: scan with Gemma locally, then ask the cloud model through Airlock.

const PLACEHOLDER_SPLIT_RE = /(\[[A-Z_]+_\d+\])/g;
const PLACEHOLDER_RE = /^\[[A-Z_]+_\d+\]$/;
const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

const $ = (id) => document.getElementById(id);

let scan = null;

function api(path, body) {
  return new Promise((resolve) => chrome.runtime.sendMessage({ type: "api", path, body }, resolve));
}

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

function showError(message) {
  $("error").textContent = message;
  $("error").hidden = !message;
}

function renderWithPlaceholders(target, text) {
  const redacted = new Set((scan?.entities || []).filter((e) => e.redacted).map((e) => e.replacement));
  target.replaceChildren(
    ...text.split(PLACEHOLDER_SPLIT_RE).map((part) =>
      PLACEHOLDER_RE.test(part) ? h("span", "ph" + (redacted.has(part) ? " red" : ""), part) : document.createTextNode(part),
    ),
  );
}

async function refreshStatus() {
  const status = $("status");
  const res = await api("/health");
  if (!res.ok) {
    status.className = "status bad";
    status.textContent = "Backend offline";
    status.title = res.detail;
    return;
  }
  const health = res.data;
  const gemma = {
    loaded: "Gemma ready",
    loading: "Gemma loading…",
    disabled: "Gemma off · rules only",
    failed: "Gemma failed · rules only",
  }[health.gemma_status] || (health.gemma_loaded ? "Gemma ready" : "Gemma off");
  const cloud = health.cloud_configured ? "cloud ready" : "cloud not set";
  status.className = "status " + (health.gemma_loaded && health.cloud_configured ? "good" : "warn");
  status.textContent = `${gemma} · ${cloud}`;
  if (health.gemma_status === "loading") setTimeout(refreshStatus, 3000);
}

async function runScan() {
  const text = $("input").value.trim();
  showError("");
  if (!text) return showError("Paste some text to scan first.");
  $("scan").disabled = true;
  $("scan-meta").textContent = "Scanning on this device…";
  $("answer").hidden = true;
  try {
    const res = await api("/scan", { text });
    if (!res.ok) {
      $("scan-result").hidden = true;
      return showError(res.detail);
    }
    scan = res.data;
    const gemmaCount = scan.entities.filter((e) => e.source === "gemma").length;
    $("scan-meta").textContent = `${scan.entities.length} found · ${gemmaCount} by Gemma · ${scan.timings_ms.total} ms`;
    $("risk").className = `risk risk-${scan.risk}`;
    $("risk").textContent = scan.risk;
    $("entities").replaceChildren(
      ...scan.entities.map((e) => {
        const li = h("li");
        li.append(
          h("span", "type", e.type),
          h("span", "value", e.text),
          h("span", "ph" + (e.redacted ? " red" : ""), e.replacement),
          h("span", `badge src-${e.source}`, e.source === "gemma" ? "Gemma" : "Rule"),
        );
        if (e.reason) li.title = e.reason;
        return li;
      }),
    );
    renderWithPlaceholders($("sanitized"), scan.sanitized_text);
    $("scan-result").hidden = false;
  } finally {
    $("scan").disabled = false;
  }
}

async function runAsk(question) {
  if (!scan) return;
  showError("");
  const button = question ? $("send-followup") : $("ask");
  button.disabled = true;
  $("ask-meta").textContent = "Asking the cloud model…";
  try {
    let res = await api("/ask", question ? { scan_id: scan.scan_id, question } : { scan_id: scan.scan_id });
    if (!res.ok && res.status === 404) {
      return showError("The backend restarted and forgot this scan. Scan the text again.");
    }
    if (!res.ok) return showError(res.detail);
    const answer = res.data;
    $("ask-meta").textContent = `${answer.cloud_model} · ${answer.timings_ms.cloud} ms`;
    renderWithPlaceholders($("cloud-saw"), answer.cloud_saw);
    renderWithPlaceholders($("cloud-raw"), answer.cloud_response_raw);
    renderWithPlaceholders($("restored"), answer.response);
    $("answer").hidden = false;
    $("followup").value = "";
  } finally {
    button.disabled = false;
  }
}

function switchTab(name) {
  for (const tab of document.querySelectorAll(".tab")) tab.classList.toggle("active", tab.dataset.tab === name);
  $("tab-ask").hidden = name !== "ask";
  $("tab-settings").hidden = name !== "settings";
}

async function loadSettings() {
  const s = await chrome.storage.local.get({ backendUrl: DEFAULT_BACKEND_URL, restoreInPage: true });
  $("backend-url").value = s.backendUrl;
  $("restore-in-page").checked = s.restoreInPage;
}

async function saveSettings() {
  const backendUrl = $("backend-url").value.trim().replace(/\/+$/, "") || DEFAULT_BACKEND_URL;
  await chrome.storage.local.set({ backendUrl, restoreInPage: $("restore-in-page").checked });
  $("settings-meta").textContent = "Saved.";
  refreshStatus();
}

for (const tab of document.querySelectorAll(".tab")) tab.addEventListener("click", () => switchTab(tab.dataset.tab));
$("scan").addEventListener("click", runScan);
$("ask").addEventListener("click", () => runAsk());
$("send-followup").addEventListener("click", () => $("followup").value.trim() && runAsk($("followup").value.trim()));
$("followup").addEventListener("keydown", (e) => e.key === "Enter" && $("send-followup").click());
$("save-settings").addEventListener("click", saveSettings);

loadSettings();
refreshStatus();
