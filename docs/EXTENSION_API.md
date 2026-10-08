# Airlock backend for the browser extension

The extension and the web UI share one local backend (`uvicorn backend.main:app --host 127.0.0.1 --port 8000`). The extension needs no extra server, only these endpoints. The full contract is in [`AIRLOCK_CONTEXT.md` §6.4](AIRLOCK_CONTEXT.md).

## Flow (one click → Gemma → sanitized prompt)

1. **User clicks the Airlock button** next to the AI site's input. Read the prompt text.
2. **`POST /scan {"text": prompt}`** for the first message of a chat. Keep the returned `scan_id` for that chat, e.g. keyed by the conversation URL.
   For later messages in the same chat send **`{"text": prompt, "scan_id": <kept id>}`**, so `[PERSON_1]` keeps meaning the same person for the whole chat.
3. Show the overlay from the response: `risk`, `entities` (each has `text`, `replacement`, `source` = `rule`/`gemma`, `reason`, `redacted`) and `sanitized_text`.
4. On "Send sanitized", replace the input's text with `sanitized_text` and let the user send it to the AI site as usual.
5. When the AI site's reply appears, **`POST /rehydrate {"scan_id", "text": reply}`** and show the returned `text` to the user. Real names come back; `[API_KEY_1]`-style secrets stay masked.

## Calling the backend from an extension

- Make every request from the **background service worker**, not the content script. Content-script requests carry the page's origin (`https://chatgpt.com`), which the backend's CORS refuses on purpose, and Chrome's private-network rules block https pages from calling `localhost`.
- `manifest.json` needs `"host_permissions": ["http://localhost:8000/*", "http://127.0.0.1:8000/*"]`.
- Chrome extensions are allowed by default (`CORS_ORIGIN_REGEX=chrome-extension://[a-p]{32}`). For Firefox, add `moz-extension://...` to `CORS_ORIGINS` or the regex in `.env`.

## Status codes to handle

| Code | When | What the extension should do |
|---|---|---|
| 503 | Gemma is still loading (first ~47 s after startup); `GET /health` shows `"gemma_status": "loading"` | Show "Airlock is starting" and retry |
| 404 | Unknown `scan_id`: the backend restarted, or the chat's session was evicted (the last 500 are kept) | Drop the stored `scan_id` and scan again without it |
| 400 / 413 | Empty prompt / prompt over 20,000 chars | Show the `detail` message |
| Network error | Backend not running | Show "Start the Airlock backend" |

A scan with Gemma takes a few seconds and scans run one at a time, so scan on the button click, not on every keystroke.

## Quick check with curl

```bash
curl -s -X POST localhost:8000/scan -H "Content-Type: application/json" \
  -d '{"text": "Our CFO Priya (priya@acme.example) wants the numbers."}'
# -> note scan_id, sanitized_text "Our CFO [PERSON_1] ([EMAIL_1]) wants the numbers." (PERSON needs Gemma)

curl -s -X POST localhost:8000/rehydrate -H "Content-Type: application/json" \
  -d '{"scan_id": "<id>", "text": "Hi [PERSON_1], I will email [EMAIL_1]."}'
```
