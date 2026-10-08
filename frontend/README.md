# Airlock frontend

Single-screen Next.js app (App Router, TypeScript, Tailwind) for the Airlock demo: paste → **Scan Locally** (`POST /scan`) → **Ask Safely** (`POST /ask`) → follow-up leak test.

## Run

```bash
cd frontend
cp .env.example .env.local      # set NEXT_PUBLIC_API_URL to the backend, e.g. http://<rahul-lan-ip>:8000
npm install
npm run dev -- -H 0.0.0.0       # reachable from other machines on the LAN
```

`npm run build` must pass before merging.

## Mock mode

The UI can run without the backend. Mock mode is on when any of these is true:

- `NEXT_PUBLIC_USE_MOCK=true` in `.env.local`
- the page is opened with `?mock=1`
- the **MOCK DATA / Live API** toggle in the header is switched to mock

The header always shows **MOCK DATA** while mock responses are in use. Mock detection is a toy (`lib/mock.ts`); never present it as real results.

## Layout

| Path | What |
|---|---|
| `app/page.tsx` | The whole screen and its state |
| `lib/api.ts` | HTTP client for `/health`, `/scan`, `/ask`, plus error messages |
| `lib/mock.ts` | Contract-shaped mock backend |
| `lib/types.ts` | Types for the frozen API contract (§6.4) |
| `lib/highlight.ts` | Splits text into highlighted spans (values, placeholders, restored values) |
| `lib/samples.ts` | Demo sample texts |
| `components/` | Badges, entity table, highlighted text, ask panels, status pills |
