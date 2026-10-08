# Airlock browser extension (Chrome, Manifest V3)

The extension is a thin client for the local Airlock backend: Gemma 4 and the rules run in the backend on your machine; the extension never sends your raw prompt anywhere else.

## What it does

**On ChatGPT, Claude and Gemini** (`chatgpt.com`, `chat.openai.com`, `claude.ai`, `gemini.google.com`):

1. Write your prompt in the site's box as usual.
2. Click the purple **Airlock** button (bottom right) or press **Alt+Shift+A**. The prompt is scanned on this machine (rules + Gemma).
3. The panel shows the risk, every finding with its placeholder, whether **Gemma** or a **Rule** caught it (and Gemma's reason), and exactly what the AI will see.
4. Click **Use sanitized prompt**: the box now holds the placeholder version. Press the site's Send button as usual.
5. When the reply arrives, placeholders such as `[PERSON_1]` are swapped back to the real values **on your screen**. Secrets (`[API_KEY_1]`, passwords, cards, IDs) stay masked.

Later messages in the same chat reuse the same placeholders, so `[PERSON_1]` stays the same person for the whole conversation, and names the backend already knows stay masked even if they are not re-detected.

**In the toolbar popup** (both models, without an AI site): paste text → **Scan locally (Gemma)** → **Ask the cloud model**. Airlock sends only the sanitized text to the cloud model configured in the backend's `.env`, and shows *what the cloud saw*, *what it replied* and *what you see* side by side, with follow-ups.

## Install (load unpacked)

1. Start the backend from the repo root: `uvicorn backend.main:app --host 127.0.0.1 --port 8000`. With Gemma on, wait until the popup shows **Gemma ready**.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick this `extension/` folder.
3. Pin Airlock from the puzzle-piece menu, then open ChatGPT, Claude or Gemini (reload tabs that were already open).

The backend URL defaults to `http://127.0.0.1:8000` and can be changed in the popup's **Settings** tab. The backend's default CORS settings already allow Chrome extensions (`CORS_ORIGIN_REGEX` in `.env`).

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest: content script on the AI sites, `host_permissions` for the local backend only |
| `background.js` | Service worker. Every backend call goes through here (the AI site's page origin is refused by the backend on purpose). Keeps chat → `scan_id` in memory-only `storage.session` |
| `content.js` | Airlock button, findings panel (shadow DOM), replacing the site's input text, restoring names in replies |
| `popup.html/.css/.js` | Ask-safely flow with the cloud model, backend status, settings |

## Limits (honest list)

- **Scanning happens when you click.** The extension does not block the site's own Send button; if you send without clicking Airlock, the prompt goes out unscanned.
- **Restoring names puts them back into the AI site's page** so you can read them. The site's own scripts can read its page, so a real name shown there is visible to that page (it was never sent in a request by Airlock). Turn **Restore real names in AI replies** off in Settings to keep replies as placeholders.
- **File uploads on the AI sites are not scanned.**
- The AI sites change their markup often. The input-box detection uses several selectors and falls back to the focused editable element; if replacing the text fails, the sanitized prompt is copied to the clipboard instead.
- Tested in Chromium against a local page that mimics ChatGPT's input box and streaming replies, not against the live sites.
