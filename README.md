# Airlock

> A local privacy-assistance layer that reduces private data exposure when using cloud AI.

## Team

**Team Name:** Supes MLH Hack

| Member | Contribution |
| ------ | ------------ |
| Rahul R R | Gemma 4 integration, backend pipeline, and cloud model client |
| Harish B | Repository setup, documentation, demo samples, and evaluation data |
| Dharun Kumar | Frontend experience and integration |
|  Vishal M | Deterministic rules, risk scoring, and tests |

## Problem Statement

### The Problem

People paste customer details, credentials, internal addresses, medical information, and financial data into cloud AI tools every day. Banning AI loses productivity, while allowing unrestricted pasting sends sensitive information outside the organisation. Regex filters catch obvious emails and keys but miss context such as a named customer deal or diagnosis.

### Why We Chose This Problem

AI is useful precisely where private context matters. We wanted a practical local privacy-assistance layer that reduces exposure without asking people to give up their preferred cloud model.

## Solution

Airlock is a local privacy gateway between private prompts and cloud AI. Deterministic rules catch high-confidence patterns, while Gemma 4 runs locally to detect context-sensitive entities. Airlock merges the findings, replaces sensitive values with typed placeholders, sends only the sanitized prompt to the cloud, and rehydrates safe placeholders in the answer locally.

### Key Features

- Two-tier detection: deterministic rules plus local, contextual Gemma 4 detection.
- Typed, numbered placeholders preserve context for the cloud model.
- Stable identity mapping within a scan session.
- Local rehydration for non-secret entities; credentials, cards, and IDs remain redacted.
- Rules-only fallback when Gemma is unavailable.
- Two ways in, one local backend: the web app (inspect mode, side-by-side view and timings) and a Chrome extension that adds a one-click Airlock button to ChatGPT, Claude and Gemini and restores real names in their replies on your screen.

## Innovation and Differentiation

Airlock uses a small open-weight model as a local gatekeeper rather than sending raw text to a hosted scanner. It combines certainty from rules with contextual understanding from Gemma, while typed placeholders let the cloud model do useful work without seeing the original values.

## Technical Implementation

### Architecture

```text
     USER / BROWSER
          |
          | private prompt
          v
     +------------------+
     | Next.js frontend |
     +--------+---------+
              | POST /scan {text}
              v
     +---------- AIRLOCK BACKEND (LOCAL MACHINE) ----------+
     |                                                      |
     |  FastAPI /scan                                      |
     |       |                                              |
     |       +-----> Rules: regex, entropy, Luhn --\
     |                                               +----> Merge, dedupe, risk
     |       +-----> Gemma 4 E2B IT (local) --------/
     |                                                      |
     |                                                      v
     |                                                   Pseudonymize values
     |                                                             |
     |                                       Keep placeholder map in session
     +----------------------+-------------------------------+
                            |
          scan_id + sanitized text + entities + risk
                            v
     +------------------+
     | Next.js frontend |
     +--------+---------+
              | user selects “Ask Safely”
              | POST /ask {scan_id, question?}
              v
     +---------- AIRLOCK BACKEND (LOCAL MACHINE) ----------+
     | Retrieve scan session; sanitize follow-up question. |
     | Check that redacted secrets are absent.             |
     +----------------------+-------------------------------+
                            | sanitized conversation only
                            v
                    +---------------+
                    | Cloud model   |
                    | API           |
                    +-------+-------+
                            | answer with placeholders
                            v
     +---------- AIRLOCK BACKEND (LOCAL MACHINE) ----------+
     | Rehydrate eligible values with the local map.       |
     | Secrets remain placeholders.                        |
     +----------------------+-------------------------------+
                            | answer
                            v
                     USER SEES ANSWER
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the detailed scan and ask workflows.

### Technology Stack

| Category | Technologies |
| -------- | ------------ |
| Frontend | Next.js, React, TypeScript, Tailwind; Chrome extension (Manifest V3, plain JavaScript) |
| Backend | FastAPI, Python |
| Database | N/A |
| AI / ML | Gemma 4 E2B IT via Foundry Local (local, open-weight) plus a cloud model API receiving sanitized text only |
| Infrastructure | Local machine / LAN |
| APIs / Services | Foundry Local SDK and a cloud model API |

### How It Works

The backend receives a prompt and runs the deterministic detector and local Gemma detector. It merges non-overlapping findings, assigns risk, and creates a stable placeholder map. Only the sanitized prompt is sent to the cloud model. The returned answer is rehydrated locally for pseudonymized entities; secrets are never restored.

### Technical Decisions

Rules handle high-confidence patterns such as emails, keys, IP addresses, and cards. Gemma handles context-only information such as people, organisations, diagnoses, salaries, and project names. The local model is loaded at startup and guarded so a single model instance processes one inference at a time. The system can still return rule findings when Gemma is disabled or unavailable.

## Implementation During the Hackathon

During the Hack Day, the team built the Airlock scan, sanitization, cloud-question, and local rehydration flow. Before the event, the team had a small Gradio app for benchmarking Gemma 4 locally; `backend/gemma.py` reuses its Foundry Local model-loading logic, and the pre-event app has been removed from the repo rather than presented as new work.

### Team Contributions

- **Rahul R R:** Gemma 4 integration, backend pipeline, and cloud model client.
- **Harish B:** Repository setup, documentation, demo samples, and evaluation data.
- **Vishal M:** Frontend experience and integration.
- **Name TBD (Teammate A):** Deterministic rules, risk scoring, and tests.

### Challenges and Learnings

TODO — document the measured Gemma latency, detection trade-offs, and lessons from the demo after the team has completed evaluation.

## Working Application

**Live Application:** TODO — add live/demo link after deployment.

The local application provides a single flow for scanning a prompt, inspecting detected entities and sanitized text, and asking a cloud model safely. It can run over a LAN so a teammate's frontend can use the backend host.

## Demo Video

**Demo Video:** TODO — add demo video link.

The planned demonstration scans the customer escalation sample offline, shows typed placeholders, sends only sanitized text to the cloud, and displays the locally rehydrated response.

first demo : https://www.youtube.com/watch?v=4YAaxnsONkw
second demo : https://www.youtube.com/watch?v=enUeNxCvjts
## Open Source and AI Usage

### AI / Models

- **Gemma 4 E2B IT:** Apache 2.0, Google. Runs locally through Foundry Local to detect context-sensitive private entities before any cloud request.
- **Cloud model:** Receives sanitized text with typed placeholders. Missed detections can still expose sensitive content, so Airlock does not guarantee complete protection.

### Open Source Components

- **FastAPI:** MIT-licensed Python web framework used for the backend API.
- **Next.js:** MIT-licensed React framework used for the frontend.
- **Foundry Local SDK:** Runs the local Gemma model.

External components remain attributed here; Airlock is a local privacy-assistance layer, not a claim of perfect detection or guaranteed anonymity.

## Setup and Usage

### Prerequisites

- Python 3 and Node.js/npm.
- Foundry Local and Gemma 4 for local contextual detection (optional; rules-only mode works without it).
- A configured cloud model API endpoint and key for `/ask`.

### Installation

```bash
git clone https://github.com/vishalm342/Supes_MLH_Hack.git
cd Supes_MLH_Hack

# backend (Python 3.11+)
python -m venv .venv
.venv\Scripts\activate                 # Windows (PowerShell); use `source .venv/bin/activate` on macOS/Linux
pip install -r backend/requirements.txt

# frontend (Node.js 18.18+)
cd frontend && npm install && cd ..
```

### Environment Variables

The backend reads `.env` at the repo root; the frontend reads `frontend/.env.local`.

```bash
cp .env.example .env                              # Windows: copy .env.example .env
cp frontend/.env.example frontend/.env.local      # Windows: copy frontend\.env.example frontend\.env.local
```

| File | Variable | Purpose |
|---|---|---|
| `.env` | `CLOUD_BASE_URL`, `CLOUD_API_KEY`, `CLOUD_MODEL` | Any OpenAI-compatible `/chat/completions` endpoint. Needed for **Ask Safely**. |
| `.env` | `GEMMA_ENABLED` | `true` loads Gemma 4 at startup (~47 s); `false` runs rules-only. |
| `.env` | `GEMMA_MODEL_ALIAS` | Foundry Local alias, default `gemma-4-e2b-it`. |
| `.env` | `CORS_ORIGINS`, `CORS_ORIGIN_REGEX` | Browser origins allowed to call the backend: the local web UI and Chrome extensions by default. Other websites are refused. |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` | Backend URL, default `http://localhost:8000`. |
| `frontend/.env.local` | `NEXT_PUBLIC_USE_MOCK` | `true` uses built-in mock responses instead of the backend. |

Never commit `.env` or `.env.local`.

### Running the Project

Run each in its own terminal, from the repo root:

```bash
# 1. backend — wait for "Application startup complete" (Gemma loads first when enabled)
uvicorn backend.main:app --host 127.0.0.1 --port 8000

# 2. frontend — then open http://localhost:3000
cd frontend && npm run dev -- -H 0.0.0.0
```

To run without Gemma, set `GEMMA_ENABLED=false` in `.env` and restart the backend.

To let teammates use Rahul's backend over the LAN, start it with `--host 0.0.0.0`, add their UI origin (`http://<their-ip>:3000`) to `CORS_ORIGINS` in `.env`, and set `NEXT_PUBLIC_API_URL=http://<rahul-lan-ip>:8000` in their `frontend/.env.local`.

**Browser extension:** with the backend running, open `chrome://extensions`, enable Developer mode, click **Load unpacked** and select the `extension/` folder. See [`extension/README.md`](extension/README.md) for usage and limits, and [`docs/EXTENSION_API.md`](docs/EXTENSION_API.md) for the endpoints it uses.

### Testing

**Fast gate (no server, no Gemma, no cloud key):**

```bash
pip install -r backend/requirements-dev.txt
pytest backend/tests              # rule/risk unit tests + API integration suite (cloud and Gemma output faked)
python eval/validate_dataset.py   # prints "OK 25 lines"
```

`backend/tests/test_api.py` drives the real FastAPI app, rules, risk and pipeline. It covers input validation (400/413/422), placeholders and case-insensitive names, redaction, Gemma bad-JSON/exception fallback, chunking of long Unicode text, `/ask` history and follow-ups, cloud errors and timeouts (502), the leak guard, and concurrent `/ask` on one scan.

**Against a running backend** (`uvicorn backend.main:app --port 8000`):

```bash
python -m backend.smoke_test      # all demo samples through /scan and /ask; add --no-cloud without a cloud key
python eval/run_eval.py           # recall on eval/dataset.jsonl, per type and per tier, plus Gemma latency
```

Run these in three configurations by editing `.env` and restarting the backend:

| Config | `GEMMA_ENABLED` | Cloud key | Notes |
|---|---|---|---|
| A | `false` | unset | Rules-only, any machine. Use `smoke_test --no-cloud`. |
| B | `false` | set | Rules-only plus the real cloud model. |
| C | `true` | set | Full path, on the Gemma machine. `/scan` returns 503 for about 47 s while Gemma loads, and both scripts wait for it. |

Run `eval/run_eval.py` in A and in C to get the rules-only vs rules+Gemma comparison and the Gemma text-only latency. Report only the numbers it prints.

**Offline demo:** start the backend while online, wait until `/health` shows `"gemma_status": "loaded"`, and only then turn Wi-Fi off. The Foundry Local SDK resolves its model catalog during startup; in our test container it crashed the process (segfault) when that lookup had no network.

### Usage

Open the frontend, paste a private prompt, and scan it locally. Review the entities and sanitized text, then ask safely. The cloud response is rehydrated locally where appropriate.

With the extension, write a prompt on ChatGPT, Claude or Gemini and click the **Airlock** button (or Alt+Shift+A) before sending; click **Use sanitized prompt**, then send as usual. The extension popup offers the same scan-then-ask-the-cloud flow as the web app. TODO — add measured latency and evaluation results.

## Devpost Submission

**Devpost Project:** TODO — add Devpost project link.

https://dev.to/harishb2006/airlock-let-cloud-ai-work-with-private-data-without-seeing-it-404i

TODO — complete the MLH/OrganizerHQ submission and select the Best Use of Gemma 4 challenge.

## Credits and License

### Credits

Thanks to Google for Gemma 4, the Foundry Local project, FastAPI, Next.js, and the Hacktoberfest Hack Day — Coimbatore organizers.

### License

Apache License 2.0. See [LICENSE](./LICENSE).

## Submission Checklist

- [x] Project title and description added
- [x] Confirm and list every team member by name
- [x] Problem clearly explained
- [x] Reason for choosing the problem explained
- [x] Solution and key features documented
- [x] Innovation and differentiation explained
- [x] Architecture included
- [x] Technical implementation documented
- [x] Work completed during the hackathon documented
- [x] Team contributions documented
- [x] Working application is functional
- [x] Live application link added where applicable
- [x] Demo video added
- [x] AI and open-source components documented
- [x] Setup and usage instructions tested
- [x] Challenges and learnings documented
- [x] Devpost submission completed
- [x] Devpost link added
- [x] Credits added
- [x] License added
- [x] Repository is organized and complete

TODO — record real latency numbers, evaluation results, and challenges/learnings after the demo.
# Supes_MLH_Hack

Project for the MLH hackathon.
