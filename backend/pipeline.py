"""Merge rule + Gemma detections, assign placeholders, sanitize and rehydrate."""

import logging
import re
import threading
import time
import uuid
from dataclasses import dataclass, field

from backend import gemma, risk, rules

logger = logging.getLogger("airlock.pipeline")

REDACTED_TYPES = {"API_KEY", "PASSWORD", "JWT", "CARD", "GOV_ID"}
WORD_BOUNDARY_TYPES = {"PERSON", "ORG", "PROJECT"}
CASE_INSENSITIVE_TYPES = {"PERSON", "ORG"}

PLACEHOLDER_RE = re.compile(r"\[([A-Z_]+)_(\d+)\]")


@dataclass
class Session:
    scan_id: str
    value_to_ph: dict[str, str] = field(default_factory=dict)
    ph_to_value: dict[str, str] = field(default_factory=dict)
    ph_type: dict[str, str] = field(default_factory=dict)
    counters: dict[str, int] = field(default_factory=dict)
    messages: list[dict] = field(default_factory=list)
    sanitized_text: str = ""
    # Case-folded value -> placeholder, for PERSON/ORG matching.
    folded_to_ph: dict[tuple[str, str], str] = field(default_factory=dict)
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def placeholder_for(self, entity_type: str, value: str) -> str:
        """Return the stable placeholder for a value, creating one if needed."""

        if value in self.value_to_ph:
            return self.value_to_ph[value]

        folded_key = (entity_type, value.casefold())
        if entity_type in CASE_INSENSITIVE_TYPES and folded_key in self.folded_to_ph:
            placeholder = self.folded_to_ph[folded_key]
        else:
            self.counters[entity_type] = self.counters.get(entity_type, 0) + 1
            placeholder = f"[{entity_type}_{self.counters[entity_type]}]"
            self.ph_to_value[placeholder] = value
            self.ph_type[placeholder] = entity_type
            if entity_type in CASE_INSENSITIVE_TYPES:
                self.folded_to_ph[folded_key] = placeholder

        self.value_to_ph[value] = placeholder
        return placeholder

    def redacted_values(self) -> list[str]:
        return [
            value for ph, value in self.ph_to_value.items()
            if self.ph_type.get(ph) in REDACTED_TYPES
        ]


SESSIONS: dict[str, Session] = {}


def _find_occurrences(text: str, value: str, entity_type: str) -> list[tuple[int, int]]:
    if entity_type in WORD_BOUNDARY_TYPES:
        left = r"\b" if value[:1].isalnum() else ""
        right = r"\b" if value[-1:].isalnum() else ""
        pattern = re.compile(left + re.escape(value) + right)
    else:
        pattern = re.compile(re.escape(value))
    return [(m.start(), m.end()) for m in pattern.finditer(text)]


def _overlaps(a: dict, b: dict) -> bool:
    return a["start"] < b["end"] and b["start"] < a["end"]


def _merge(rule_spans: list[dict], gemma_spans: list[dict]) -> list[dict]:
    """Rule spans win over overlapping Gemma spans; longer Gemma span wins among Gemma."""

    kept_gemma: list[dict] = []
    for span in sorted(gemma_spans, key=lambda s: (-(s["end"] - s["start"]), s["start"])):
        if any(_overlaps(span, r) for r in rule_spans):
            continue
        if any(_overlaps(span, g) for g in kept_gemma):
            continue
        kept_gemma.append(span)

    return sorted(rule_spans + kept_gemma, key=lambda s: s["start"])


def _apply_spans(text: str, spans: list[dict]) -> str:
    out = text
    for span in sorted(spans, key=lambda s: s["start"], reverse=True):
        out = out[:span["start"]] + span["replacement"] + out[span["end"]:]
    return out


def scan(text: str) -> dict:
    """Run both tiers over `text` and return the /scan response body."""

    total_started = time.perf_counter()

    started = time.perf_counter()
    rule_hits = rules.detect(text)
    rules_ms = round((time.perf_counter() - started) * 1000)

    gemma_hits: list[dict] = []
    gemma_used = False
    gemma_ms = 0
    if gemma.is_loaded():
        started = time.perf_counter()
        try:
            gemma_hits = gemma.detect(text)
            gemma_used = True
        except Exception:
            logger.exception("Gemma detection failed; continuing with rule results only.")
            gemma_hits = []
        gemma_ms = round((time.perf_counter() - started) * 1000)

    rule_spans = [
        {"type": h["type"], "text": text[h["start"]:h["end"]], "start": h["start"], "end": h["end"], "source": "rule"}
        for h in rule_hits
    ]
    gemma_spans = [
        {"type": h["type"], "text": text[s:e], "start": s, "end": e, "source": "gemma"}
        for h in gemma_hits
        for s, e in _find_occurrences(text, h["text"], h["type"])
    ]
    spans = _merge(rule_spans, gemma_spans)

    session = Session(scan_id=str(uuid.uuid4()))
    for span in spans:
        span["replacement"] = session.placeholder_for(span["type"], span["text"])

    sanitized_text = _apply_spans(text, spans)
    session.sanitized_text = sanitized_text

    # One row per unique value; "rule" wins if both tiers caught it.
    rows: dict[str, dict] = {}
    for span in spans:
        row = rows.get(span["text"])
        if row is None:
            entity_type = session.ph_type[span["replacement"]]
            rows[span["text"]] = {
                "type": entity_type,
                "text": span["text"],
                "replacement": span["replacement"],
                "risk": risk.entity_risk(entity_type),
                "source": span["source"],
                "redacted": entity_type in REDACTED_TYPES,
                "count": 1,
            }
        else:
            row["count"] += 1
            if span["source"] == "rule":
                row["source"] = "rule"

    entities = list(rows.values())

    SESSIONS[session.scan_id] = session

    return {
        "scan_id": session.scan_id,
        "risk": risk.overall_risk([e["type"] for e in entities]),
        "entities": entities,
        "sanitized_text": sanitized_text,
        "gemma_used": gemma_used,
        "timings_ms": {
            "rules": rules_ms,
            "gemma": gemma_ms,
            "total": round((time.perf_counter() - total_started) * 1000),
        },
    }


def sanitize_with_session(session: Session, text: str) -> str:
    """Sanitize a follow-up message with the session's existing placeholder map plus new rule hits."""

    out = text
    for value in sorted(session.value_to_ph, key=len, reverse=True):
        placeholder = session.value_to_ph[value]
        entity_type = session.ph_type[placeholder]
        if entity_type in WORD_BOUNDARY_TYPES:
            left = r"\b" if value[:1].isalnum() else ""
            right = r"\b" if value[-1:].isalnum() else ""
            flags = re.IGNORECASE if entity_type in CASE_INSENSITIVE_TYPES else 0
            out = re.sub(left + re.escape(value) + right, lambda _m: placeholder, out, flags=flags)
        else:
            out = out.replace(value, placeholder)

    spans = []
    for hit in rules.detect(out):
        value = out[hit["start"]:hit["end"]]
        if PLACEHOLDER_RE.fullmatch(value):
            continue
        spans.append({
            "start": hit["start"],
            "end": hit["end"],
            "replacement": session.placeholder_for(hit["type"], value),
        })
    return _apply_spans(out, spans)


def rehydrate(session: Session, text: str) -> str:
    """Restore pseudonymized placeholders; redacted and unknown placeholders stay as-is."""

    def restore(match: re.Match) -> str:
        placeholder = match.group(0)
        entity_type = session.ph_type.get(placeholder)
        if entity_type is None or entity_type in REDACTED_TYPES:
            return placeholder
        return session.ph_to_value[placeholder]

    return PLACEHOLDER_RE.sub(restore, text)
