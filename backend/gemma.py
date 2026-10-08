"""Local Gemma 4 via Foundry Local: model lifecycle and contextual PII detection.

Loading and response-extraction logic is adapted from the team's pre-event
Gradio test app used to benchmark Gemma 4 on our machine.
"""

import json
import logging
import os
import threading
import time
import traceback
from pathlib import Path

logger = logging.getLogger("airlock.gemma")

ALLOWED_TYPES = {
    "PERSON", "ORG", "EMAIL", "PHONE", "ADDRESS", "LOCATION", "GOV_ID",
    "FINANCIAL", "MEDICAL", "HR", "PROJECT", "INTERNAL_URL", "IP_ADDRESS",
    "API_KEY", "PASSWORD", "JWT", "CARD", "OTHER",
}

MAX_CHUNK_CHARS = 1500

DETECT_SYSTEM_PROMPT = """You are a privacy scanner that runs locally. Find every sensitive item in the user's text that should not be sent to a third-party AI.
Sensitive items include: person names; company or client names tied to business details; email addresses; phone numbers; street addresses; government ID numbers; bank, card or account numbers; money amounts tied to a person, client or deal; medical conditions, diagnoses or medications; HR details (salary, performance, disciplinary, resignation); internal project codenames; internal hostnames, URLs or IP addresses; passwords, API keys and tokens.
Do NOT flag: generic words, programming keywords, public products or public companies mentioned generically, well-known cities used without a personal address.
Copy each value EXACTLY as it appears in the text (same spelling and case). Prefer the shortest exact span that is sensitive (e.g. "diabetes", not the whole sentence).
Respond with ONLY a JSON object and nothing else:
{"entities":[{"text":"<exact substring>","type":"PERSON|ORG|EMAIL|PHONE|ADDRESS|LOCATION|GOV_ID|FINANCIAL|MEDICAL|HR|PROJECT|INTERNAL_URL|IP_ADDRESS|API_KEY|PASSWORD|JWT|CARD|OTHER","reason":"<5 words>"}]}
If nothing is sensitive, respond {"entities":[]}."""

_manager = None
_model = None
_loaded = False
_lock = threading.Lock()


def _enabled() -> bool:
    return os.getenv("GEMMA_ENABLED", "true").strip().lower() not in {"false", "0", "no", "off"}


def model_alias() -> str:
    return os.getenv("GEMMA_MODEL_ALIAS", "gemma-4-e2b-it")


def is_loaded() -> bool:
    return _loaded


def load() -> None:
    """Initialise Foundry Local and load Gemma once. Never raises."""

    global _manager, _model, _loaded

    if not _enabled():
        logger.info("GEMMA_ENABLED=false; running in rules-only mode.")
        return

    try:
        # Imported lazily so machines without the SDK can run rules-only.
        from foundry_local_sdk import Configuration, FoundryLocalManager

        shared_foundry_dir = Path.home() / ".foundry"
        logger.info("Initializing Foundry Local (data root: %s)", shared_foundry_dir)

        config = Configuration(
            app_name="GemmaVision",
            app_data_dir=str(shared_foundry_dir),
            disable_nonessential_telemetry=True,
        )
        FoundryLocalManager.initialize(config)
        _manager = FoundryLocalManager.instance

        ep_result = _manager.download_and_register_eps(names=["WebGpuExecutionProvider"])
        logger.info("Execution providers ready: %s (%s)", ep_result.success, ep_result.status)

        alias = model_alias()
        _model = _manager.catalog.get_model(alias)
        if _model is None:
            raise RuntimeError(f"Model '{alias}' was not found in the Foundry Local catalog.")

        if not _model.is_cached:
            logger.info("Downloading %s...", alias)
            _model.download()

        load_started = time.perf_counter()
        _model.load()
        logger.info("Gemma loaded in %.2f seconds.", time.perf_counter() - load_started)
        _loaded = True

    except Exception:
        logger.error("Gemma failed to load; continuing in rules-only mode.\n%s", traceback.format_exc())
        _loaded = False


def shutdown() -> None:
    """Unload Gemma and close Foundry Local."""

    global _manager, _model, _loaded

    _loaded = False
    try:
        if _model is not None:
            _model.unload()
            _model = None
    except Exception:
        logger.error("Error while unloading Gemma:\n%s", traceback.format_exc())

    try:
        if _manager is not None:
            _manager.close()
            _manager = None
    except Exception:
        logger.error("Error while closing Foundry Local:\n%s", traceback.format_exc())


def _extract_response_text(response) -> str:
    from foundry_local_sdk import MessageItem, TextItem

    output_parts = []
    for item in response:
        if isinstance(item, MessageItem):
            for part in item.parts:
                if isinstance(part, TextItem):
                    output_parts.append(part.text)
        elif isinstance(item, TextItem):
            output_parts.append(item.text)
    return "".join(output_parts).strip()


def generate(system: str, user: str, max_tokens: int = 512, temperature: float = 0.0) -> str:
    """Run one stateless chat completion on the local model."""

    if not _loaded:
        raise RuntimeError("Gemma is not loaded.")

    from foundry_local_sdk import (
        ChatSession,
        MessageItem,
        Request,
        RequestOptions,
        SearchOptions,
        TextItem,
    )

    with _lock:
        # Fresh session per call so no history leaks between scans.
        chat_session = ChatSession(_model)
        chat_session.set_options(
            RequestOptions(
                search=SearchOptions(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                )
            )
        )
        request = Request()
        if system:
            request.add_item(MessageItem.system([TextItem(system)]))
        request.add_item(MessageItem.user([TextItem(user)]))

        with chat_session as session:
            with request as req:
                with session.process_request(req) as response:
                    return _extract_response_text(response)


def _chunk(text: str, limit: int = MAX_CHUNK_CHARS) -> list[str]:
    """Split text into pieces of at most `limit` chars, on line boundaries where possible."""

    chunks: list[str] = []
    current = ""
    for line in text.splitlines(keepends=True):
        while len(line) > limit:
            if current:
                chunks.append(current)
                current = ""
            chunks.append(line[:limit])
            line = line[limit:]
        if len(current) + len(line) > limit:
            chunks.append(current)
            current = ""
        current += line
    if current:
        chunks.append(current)
    return chunks


def _parse_json(raw: str):
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("No JSON object in model output.")
    return json.loads(cleaned[start:end + 1])


def _validate(parsed, chunk: str) -> list[dict]:
    entities = parsed.get("entities", []) if isinstance(parsed, dict) else []
    results = []
    for item in entities if isinstance(entities, list) else []:
        if not isinstance(item, dict):
            continue
        value = item.get("text")
        if not isinstance(value, str) or len(value.strip()) < 2:
            continue
        if value not in chunk:
            continue
        entity_type = str(item.get("type", "OTHER")).strip().upper()
        if entity_type not in ALLOWED_TYPES:
            entity_type = "OTHER"
        results.append({
            "type": entity_type,
            "text": value,
            "reason": str(item.get("reason", "")).strip(),
        })
    return results


def _detect_chunk(chunk: str) -> list[dict]:
    raw = generate(DETECT_SYSTEM_PROMPT, chunk)
    try:
        return _validate(_parse_json(raw), chunk)
    except (ValueError, json.JSONDecodeError):
        logger.warning("Gemma returned invalid JSON; retrying once.")

    raw = generate(DETECT_SYSTEM_PROMPT, f"{chunk}\n\nReturn ONLY valid JSON.")
    try:
        return _validate(_parse_json(raw), chunk)
    except (ValueError, json.JSONDecodeError):
        logger.error("Gemma returned invalid JSON twice; skipping chunk. Output: %r", raw[:500])
        return []


def detect(text: str) -> list[dict]:
    """Return [{"type", "text", "reason"}] where text is an exact substring of `text`."""

    if not _enabled() or not _loaded or not text.strip():
        return []

    seen: set[tuple[str, str]] = set()
    results: list[dict] = []
    for chunk in _chunk(text):
        if not chunk.strip():
            continue
        for entity in _detect_chunk(chunk):
            key = (entity["type"], entity["text"])
            if key in seen:
                continue
            seen.add(key)
            results.append(entity)
    return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    samples = {
        "henderson": (
            "The Henderson account is about to churn. Their CFO Priya "
            "(priya.r@henderson-logistics.com, +91 98400 12345) says the 40L renewal "
            "is off unless Project Falcon ships. Staging is at http://10.20.4.15:8080 "
            "and the key is sk_live_51HxQe9kLmN3pQrStUvWxYz."
        ),
        "diabetes": (
            "Draft a leave note for Arjun Mehta in accounts. He was diagnosed with "
            "type 2 diabetes last month and needs two weeks off to start insulin."
        ),
    }

    load()
    if not is_loaded():
        raise SystemExit("Gemma did not load; see logs above.")
    try:
        for name, sample in samples.items():
            started = time.perf_counter()
            found = detect(sample)
            elapsed = time.perf_counter() - started
            print(f"\n=== {name} ({elapsed:.2f}s) ===")
            print(json.dumps(found, indent=2, ensure_ascii=False))
    finally:
        shutdown()
