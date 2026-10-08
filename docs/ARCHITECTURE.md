# Airlock Architecture

Airlock scans a prompt locally first. When the user chooses **Ask Safely**, the backend sends the sanitized prompt to a cloud model and restores eligible placeholders locally.

## Full request flow

```text
                         USER / BROWSER
                              |
                              | Private prompt
                              v
                       +--------------+
                       | Next.js UI   |
                       +------+-------+
                              | POST /scan {text}
                              v
     +------------------- AIRLOCK: LOCAL MACHINE -------------------+
     |                                                               |
     |  FastAPI /scan                                                |
     |       |                                                        |
     |       +-----> Rules: regex, entropy, Luhn --\
     |                                               +----> Merge, dedupe, risk
     |       +-----> Gemma 4 E2B IT (local) --------/
     |                                                      |
     |                                                      v
     |                                                               Pseudonymize values
     |                                                                         |
     |                                                     Keep placeholder map in session
     +------------------------------+----------------------+
                                    |
               scan_id + sanitized text + entities + risk
                                    v
                       +--------------+
                       | Next.js UI   |
                       +------+-------+
                              |
                       User reviews scan
                       and chooses Ask Safely
                              | POST /ask {scan_id, question?}
                              v
     +------------------- AIRLOCK: LOCAL MACHINE -------------------+
     | Retrieve session/map; sanitize a follow-up question if given. |
     | Check that redacted secrets are absent from outgoing content. |
     +------------------------------+--------------------------------+
                                    | Sanitized conversation only
                                    v
                              +-----------+
                              | Cloud AI  |
                              | model API |
                              +-----+-----+
                                    | Answer with placeholders
                                    v
     +------------------- AIRLOCK: LOCAL MACHINE -------------------+
     | Restore eligible values using the local placeholder map.      |
     | Redacted secrets remain placeholders.                          |
     +------------------------------+--------------------------------+
                                    | Answer
                                    v
                               USER SEES
                            RESTORED ANSWER
```

## What happens at each step

1. The frontend sends the raw prompt to `POST /scan` on the Airlock backend.
2. The backend runs deterministic rules and, when available, Gemma 4 locally. If Gemma is disabled or unavailable, rule detections are still returned.
3. Findings are merged and deduplicated, risk is scored, and detected values are replaced with typed placeholders such as `[PERSON_1]` and `[EMAIL_1]`.
4. The backend keeps the placeholder map in the scan session and returns a `scan_id`, sanitized text, entities, and risk to the frontend for review.
5. On `POST /ask`, the backend uses the scan's sanitized text. A follow-up question is sanitized with the same session map. A final check rejects an outgoing request if it contains a redacted secret.
6. The cloud model receives the sanitized conversation, without the local placeholder map.
7. The backend rehydrates eligible placeholders in the answer. `API_KEY`, `PASSWORD`, `JWT`, `CARD`, and `GOV_ID` values remain redacted.

Airlock reduces exposure, but detection can miss sensitive content. A missed value could still be sent to the cloud model.
