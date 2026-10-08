// Airlock content script for ChatGPT, Claude and Gemini.
//
// One click on the Airlock button (or Alt+Shift+A):
//   1. read the prompt from the site's input box,
//   2. scan it on this machine (rules + Gemma 4) through the background worker,
//   3. show what was found, and on "Use sanitized prompt" put the sanitized text
//      back in the input box for the user to send as usual.
// When the AI's reply comes back with placeholders, they are swapped back to the
// real values on this screen only (secrets such as API keys stay masked).

(() => {
  if (window.__airlockLoaded) return;
  window.__airlockLoaded = true;

  const PLACEHOLDER_RE = /\[[A-Z_]+_\d+\]/;
  const PLACEHOLDER_SPLIT_RE = /(\[[A-Z_]+_\d+\])/g;

  // Input boxes per site, most specific first. All of them are contenteditable
  // except older ChatGPT builds, which used a <textarea>.
  const COMPOSER_SELECTORS = [
    "#prompt-textarea",
    "div.ProseMirror[contenteditable='true']",
    "rich-textarea .ql-editor[contenteditable='true']",
    "div[contenteditable='true'][role='textbox']",
    "div[contenteditable='true']",
    "textarea",
  ];

  // Paths that mean "new chat"; the site moves to a conversation URL after the
  // first message, and the session must follow it there.
  const NEW_CHAT_PATHS = new Set(["/", "/new", "/app", "/chat"]);

  // ------------------------------------------------------------------ backend

  function send(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, status: 0, detail: "Airlock was updated or reloaded. Refresh this page." });
          } else {
            resolve(res);
          }
        });
      } catch {
        resolve({ ok: false, status: 0, detail: "Airlock was updated or reloaded. Refresh this page." });
      }
    });
  }

  const api = (path, body) => send({ type: "api", path, body });

  // ------------------------------------------------------------------ conversation -> scan_id

  let currentKey = conversationKey();
  let currentScanId = null;

  function conversationKey() {
    return location.origin + location.pathname;
  }

  function isNewChatKey(key) {
    return NEW_CHAT_PATHS.has(new URL(key).pathname);
  }

  async function loadScanId() {
    const res = await send({ type: "getScanId", key: currentKey });
    currentScanId = (res && res.scanId) || null;
  }

  async function saveScanId(scanId) {
    currentScanId = scanId;
    await send({ type: "setScanId", key: currentKey, scanId });
  }

  async function onLocationChange() {
    const key = conversationKey();
    if (key === currentKey) return;
    const previousKey = currentKey;
    const previousScanId = currentScanId;
    currentKey = key;
    await loadScanId();
    // First message of a new chat: the site just moved to the conversation URL.
    if (!currentScanId && previousScanId && isNewChatKey(previousKey)) {
      await saveScanId(previousScanId);
      await send({ type: "setScanId", key: previousKey, scanId: null });
    }
    scheduleRestore();
  }

  setInterval(onLocationChange, 1000);
  loadScanId().then(scheduleRestore);

  // ------------------------------------------------------------------ composer

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function findComposer() {
    const active = document.activeElement;
    if (active && !host.contains(active) && (active.isContentEditable || active.tagName === "TEXTAREA")) {
      return active.closest("[contenteditable='true']") || active;
    }
    for (const selector of COMPOSER_SELECTORS) {
      const match = [...document.querySelectorAll(selector)].find((el) => isVisible(el) && !host.contains(el));
      if (match) return match;
    }
    return null;
  }

  function readComposer(el) {
    return (el.tagName === "TEXTAREA" ? el.value : el.innerText).replace(/ /g, " ").trim();
  }

  function writeComposer(el, text) {
    el.focus();
    if (el.tagName === "TEXTAREA") {
      // React tracks the value through the native setter.
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return readComposer(el) === text.trim();
    }
    // contenteditable editors (ProseMirror, Quill) ignore direct DOM edits;
    // replacing the selection through execCommand goes through their input handling.
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("insertText", false, text);
    return readComposer(el) === text.trim();
  }

  // ------------------------------------------------------------------ UI (shadow DOM, isolated from the site's CSS)

  const host = document.createElement("div");
  host.id = "airlock-root";
  host.style.all = "initial";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
      .fab { position: fixed; right: 20px; bottom: 96px; z-index: 2147483646; display: flex; align-items: center; gap: 8px;
        padding: 10px 14px; border: 0; border-radius: 999px; background: #7c3aed; color: #fff; font-size: 13px; font-weight: 600;
        cursor: pointer; box-shadow: 0 6px 20px rgba(124, 58, 237, .45); }
      .fab:hover { background: #6d28d9; }
      .fab:disabled { opacity: .7; cursor: progress; }
      .fab svg { width: 16px; height: 16px; }
      .panel { position: fixed; right: 20px; bottom: 150px; z-index: 2147483647; width: min(420px, calc(100vw - 40px));
        max-height: min(70vh, 640px); overflow: auto; border-radius: 14px; background: #0f172a; color: #e2e8f0;
        border: 1px solid #334155; box-shadow: 0 18px 50px rgba(0,0,0,.45); font-size: 13px; line-height: 1.45; }
      .panel[hidden] { display: none; }
      .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-bottom: 1px solid #1e293b; }
      .title { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; }
      .close { background: none; border: 0; color: #94a3b8; font-size: 18px; cursor: pointer; line-height: 1; }
      .body { padding: 12px 14px; display: grid; gap: 12px; }
      .muted { color: #94a3b8; font-size: 12px; }
      .risk { padding: 2px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; }
      .risk-NONE { background: #064e3b; color: #6ee7b7; } .risk-LOW { background: #1e3a8a; color: #93c5fd; }
      .risk-MEDIUM { background: #78350f; color: #fcd34d; } .risk-HIGH { background: #7f1d1d; color: #fca5a5; }
      .stats { display: flex; gap: 12px; flex-wrap: wrap; }
      .stats b { color: #fff; }
      .gemma-note { color: #c4b5fd; }
      ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
      li { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; padding: 8px; border-radius: 8px; background: #1e293b; }
      .type { font-family: ui-monospace, monospace; font-size: 11px; color: #cbd5e1; }
      .value { overflow-wrap: anywhere; color: #fff; }
      .meta { grid-column: 2; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
      .badge { font-size: 11px; padding: 1px 7px; border-radius: 999px; }
      .src-gemma { background: #4c1d95; color: #ddd6fe; } .src-rule { background: #334155; color: #e2e8f0; }
      .ph { font-family: ui-monospace, monospace; font-size: 11px; padding: 0 4px; border-radius: 4px; background: #0c4a6e; color: #bae6fd; }
      .ph.red { background: #7f1d1d; color: #fecaca; }
      .reason { color: #a5b4fc; font-size: 11px; }
      .label { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; }
      .preview { white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px; border-radius: 8px; background: #020617; border: 1px solid #1e293b; max-height: 180px; overflow: auto; }
      .actions { display: flex; gap: 8px; justify-content: flex-end; }
      .btn { border: 0; border-radius: 8px; padding: 8px 12px; font-weight: 600; font-size: 13px; cursor: pointer; }
      .primary { background: #7c3aed; color: #fff; } .primary:hover { background: #6d28d9; }
      .ghost { background: #1e293b; color: #e2e8f0; }
      .error { padding: 10px; border-radius: 8px; background: #450a0a; color: #fecaca; border: 1px solid #7f1d1d; }
      .ok { padding: 10px; border-radius: 8px; background: #052e16; color: #bbf7d0; border: 1px solid #14532d; }
      .spinner { width: 14px; height: 14px; border: 2px solid #c4b5fd; border-top-color: transparent; border-radius: 50%; animation: spin .8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
    <button class="fab" part="fab" title="Scan this prompt locally with Airlock (Alt+Shift+A)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"/></svg>
      <span class="fab-label">Airlock</span>
    </button>
    <div class="panel" hidden role="dialog" aria-label="Airlock">
      <div class="head">
        <div class="title">🛡 Airlock <span class="head-risk"></span></div>
        <button class="close" title="Close">×</button>
      </div>
      <div class="body"></div>
    </div>`;
  document.documentElement.appendChild(host);

  const fab = root.querySelector(".fab");
  const fabLabel = root.querySelector(".fab-label");
  const panel = root.querySelector(".panel");
  const body = root.querySelector(".body");
  const headRisk = root.querySelector(".head-risk");
  root.querySelector(".close").addEventListener("click", () => (panel.hidden = true));

  function h(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
      if (child != null) el.append(child);
    }
    return el;
  }

  let hideTimer = null;

  function show(...nodes) {
    clearTimeout(hideTimer);
    body.replaceChildren(...nodes);
    panel.hidden = false;
  }

  function showError(message) {
    headRisk.replaceChildren();
    show(h("div", { class: "error", text: message }));
  }

  function renderSanitized(text, redactedPlaceholders) {
    return text.split(PLACEHOLDER_SPLIT_RE).map((part) =>
      PLACEHOLDER_RE.test(part) ? h("span", { class: "ph" + (redactedPlaceholders.has(part) ? " red" : ""), text: part }) : part,
    );
  }

  function renderResult(scan, composer) {
    const entities = scan.entities;
    const gemmaOnly = entities.filter((e) => e.source === "gemma").length;
    const redacted = new Set(entities.filter((e) => e.redacted).map((e) => e.replacement));
    headRisk.replaceChildren(h("span", { class: `risk risk-${scan.risk}`, text: scan.risk }));

    const stats = h("div", { class: "stats muted" }, [
      h("span", {}, [h("b", { text: String(entities.length) }), " sensitive"]),
      h("span", {}, [h("b", { text: String(entities.length - gemmaOnly) }), " by rules"]),
      h("span", { class: "gemma-note" }, [h("b", { text: String(gemmaOnly) }), " only Gemma understood"]),
      h("span", { text: `${scan.timings_ms.total} ms on this device` }),
    ]);

    const notes = [];
    if (!scan.gemma_used) {
      notes.push(h("div", { class: "muted", text: "Gemma wasn't used for this scan, so only rule-based findings are shown." }));
    }

    const list = entities.length
      ? h("ul", {}, entities.map((e) =>
          h("li", {}, [
            h("span", { class: "type", text: e.type }),
            h("span", { class: "value", text: e.text }),
            h("span", { class: "meta" }, [
              h("span", { class: "ph" + (e.redacted ? " red" : ""), text: e.replacement }),
              h("span", { class: `badge src-${e.source}`, text: e.source === "gemma" ? "Gemma" : "Rule" }),
              e.redacted ? h("span", { class: "muted", text: "never restored" }) : null,
              e.reason ? h("span", { class: "reason", text: e.reason }) : null,
            ]),
          ]),
        ))
      : h("div", { class: "ok", text: "Nothing sensitive found. You can send this prompt as is." });

    const preview = h("div", {}, [
      h("div", { class: "label", text: "What the AI will see" }),
      h("div", { class: "preview" }, renderSanitized(scan.sanitized_text, redacted)),
    ]);

    const useButton = h("button", {
      class: "btn primary",
      text: "Use sanitized prompt",
      onclick: () => {
        const target = composer && composer.isConnected ? composer : findComposer();
        if (!target || !writeComposer(target, scan.sanitized_text)) {
          navigator.clipboard?.writeText(scan.sanitized_text).catch(() => {});
          showError("Couldn't replace the text in this site's input box. The sanitized prompt was copied; paste it in instead.");
          return;
        }
        headRisk.replaceChildren();
        show(h("div", { class: "ok", text: "Sanitized prompt is in the box. Press Send as usual; names in the reply are restored on your screen." }));
        hideTimer = setTimeout(() => (panel.hidden = true), 2500);
      },
    });
    const cancel = h("button", { class: "btn ghost", text: "Cancel", onclick: () => (panel.hidden = true) });

    show(stats, ...notes, list, entities.length ? preview : null, h("div", { class: "actions" }, [cancel, entities.length ? useButton : null]));
  }

  // ------------------------------------------------------------------ scan

  let scanning = false;

  async function runScan() {
    if (scanning) return;
    const composer = findComposer();
    const text = composer ? readComposer(composer) : "";
    if (!text) {
      showError("Type or paste your prompt in the chat box first, then click Airlock.");
      return;
    }

    scanning = true;
    fab.disabled = true;
    fabLabel.textContent = "Scanning…";
    headRisk.replaceChildren();
    show(h("div", { class: "stats muted" }, [h("span", { class: "spinner" }), "Scanning on this device with Gemma 4…"]));

    try {
      await onLocationChange();
      let res = await api("/scan", currentScanId ? { text, scan_id: currentScanId } : { text });
      if (!res.ok && res.status === 404 && currentScanId) {
        // Backend restarted or the session expired: start a fresh one for this chat.
        await saveScanId(null);
        res = await api("/scan", { text });
      }
      if (!res.ok) {
        showError(res.status === 503 ? `Airlock is starting: ${res.detail}` : res.detail);
        return;
      }
      await saveScanId(res.data.scan_id);
      renderResult(res.data, composer);
    } finally {
      scanning = false;
      fab.disabled = false;
      fabLabel.textContent = "Airlock";
    }
  }

  fab.addEventListener("click", runScan);
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
      e.preventDefault();
      runScan();
    }
  }, true);

  // ------------------------------------------------------------------ restore names in replies (on this screen only)

  let restoreEnabled = true;
  chrome.storage.local.get({ restoreInPage: true }, (s) => (restoreEnabled = s.restoreInPage));
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.restoreInPage) restoreEnabled = changes.restoreInPage.newValue;
  });

  const restoredText = new WeakMap(); // text node -> the text Airlock wrote into it
  let restoreTimer = null;

  function isInsideEditable(node) {
    const el = node.parentElement;
    return !el || !!el.closest("[contenteditable='true'], textarea, input, script, style");
  }

  function candidateNodes() {
    const nodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        PLACEHOLDER_RE.test(node.nodeValue) && restoredText.get(node) !== node.nodeValue && !isInsideEditable(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP,
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  async function restoreNames() {
    restoreTimer = null;
    if (!restoreEnabled || !currentScanId || !document.body) return;
    const scanId = currentScanId;
    for (const node of candidateNodes().slice(0, 200)) {
      const original = node.nodeValue;
      const res = await api("/rehydrate", { scan_id: scanId, text: original });
      if (!res.ok) {
        if (res.status === 404) await saveScanId(null);
        return;
      }
      // Skip if the site re-rendered the node while we were waiting.
      if (node.isConnected && node.nodeValue === original) {
        node.nodeValue = res.data.text;
        restoredText.set(node, res.data.text);
      }
    }
  }

  function scheduleRestore() {
    if (!restoreTimer) restoreTimer = setTimeout(restoreNames, 300);
  }

  new MutationObserver(scheduleRestore).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
