// Mock backend that follows the §6.4 contract, so the UI can be built and demoed without the API.
// Detection here is a toy: a few regexes plus a fixed list of "contextual" terms from the samples.

import { REDACTED_TYPES } from "./highlight";
import type { AirlockApi, AskResponse, Entity, EntityRisk, EntitySource, OverallRisk, ScanResponse } from "./types";

const HIGH_TYPES = new Set([...REDACTED_TYPES, "EMAIL", "MEDICAL", "FINANCIAL"]);
const MEDIUM_TYPES = new Set(["PERSON", "ORG", "PHONE", "ADDRESS", "HR", "PROJECT", "INTERNAL_URL", "IP_ADDRESS"]);

const RULES: [string, RegExp][] = [
  ["INTERNAL_URL", /\bhttps?:\/\/[\w.-]+\.(?:internal|corp|local|lan)\b(?:[^\s,;]*[^\s,;.])?/g],
  ["EMAIL", /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  ["API_KEY", /\b(?:sk|pk|rk|ak)_(?:live|test)_[A-Za-z0-9]{8,}\b|\bAKIA[0-9A-Z]{16}\b|\bghp_[A-Za-z0-9]{20,}\b/g],
  ["PASSWORD", /(?<=\bpassword(?:\s+is)?[\s:=]+)(?!is\b)[^\s,;]*[^\s,;.]/gi],
  ["CARD", /\b(?:\d{4}[ -]?){3}\d{4}\b/g],
  ["GOV_ID", /\b\d{4} \d{4} \d{4}\b/g],
  ["IP_ADDRESS", /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  ["PHONE", /\+\d{1,3}(?:[\s-]?\d{2,5}){2,4}\b|\b[6-9]\d{4}[\s-]?\d{5}\b/g],
];

// What the local model would catch that no regex can.
const CONTEXTUAL: { text: string; type: string; reason: string }[] = [
  { text: "Henderson", type: "ORG", reason: "Customer account name" },
  { text: "Priya", type: "PERSON", reason: "Named customer contact (CFO)" },
  { text: "40L renewal", type: "FINANCIAL", reason: "Deal value for a named customer" },
  { text: "Project Falcon", type: "PROJECT", reason: "Internal project codename" },
  { text: "Mateo", type: "PERSON", reason: "Named service owner" },
  { text: "Northstar", type: "ORG", reason: "Organisation tied to the leaked credentials" },
  { text: "Anika Rao", type: "PERSON", reason: "Treating doctor" },
  { text: "Leena", type: "PERSON", reason: "Patient name" },
  { text: "diabetes", type: "MEDICAL", reason: "Diagnosis linked to a named patient" },
  { text: "severe peanut allergy", type: "MEDICAL", reason: "Health condition linked to a named patient" },
  { text: "Project Nimbus", type: "PROJECT", reason: "Internal project codename" },
  { text: "Ibrahim", type: "PERSON", reason: "Named on-call engineer" },
];

function entityRisk(type: string): EntityRisk {
  if (HIGH_TYPES.has(type)) return "HIGH";
  if (MEDIUM_TYPES.has(type)) return "MEDIUM";
  return "LOW";
}

function overallRisk(entities: Entity[]): OverallRisk {
  if (entities.length === 0) return "NONE";
  if (entities.some((e) => e.risk === "HIGH")) return "HIGH";
  if (entities.some((e) => e.risk === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

interface Span {
  start: number;
  end: number;
  type: string;
  source: EntitySource;
  reason?: string;
}

function detect(text: string): Span[] {
  const spans: Span[] = [];
  for (const [type, re] of RULES) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      spans.push({ start, end: start + m[0].length, type, source: "rule" });
    }
  }
  for (const c of CONTEXTUAL) {
    let i = text.indexOf(c.text);
    while (i !== -1) {
      spans.push({ start: i, end: i + c.text.length, type: c.type, source: "gemma", reason: c.reason });
      i = text.indexOf(c.text, i + c.text.length);
    }
  }
  spans.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const kept: Span[] = [];
  for (const s of spans) {
    const last = kept[kept.length - 1];
    if (!last || s.start >= last.end) kept.push(s);
  }
  return kept;
}

function buildScan(text: string): ScanResponse {
  const spans = detect(text);
  const byValue = new Map<string, Entity>();
  const perType = new Map<string, number>();
  let sanitized = "";
  let pos = 0;

  for (const s of spans) {
    const value = text.slice(s.start, s.end);
    let entity = byValue.get(value);
    if (!entity) {
      const n = (perType.get(s.type) ?? 0) + 1;
      perType.set(s.type, n);
      entity = {
        type: s.type,
        text: value,
        replacement: `[${s.type}_${n}]`,
        risk: entityRisk(s.type),
        source: s.source,
        redacted: REDACTED_TYPES.has(s.type),
        count: 0,
        reason: s.reason,
      };
      byValue.set(value, entity);
    }
    entity.count += 1;
    sanitized += text.slice(pos, s.start) + entity.replacement;
    pos = s.end;
  }
  sanitized += text.slice(pos);

  const entities = [...byValue.values()];
  const gemmaMs = 2600 + Math.round(Math.random() * 1200);
  return {
    scan_id: crypto.randomUUID(),
    risk: overallRisk(entities),
    entities,
    sanitized_text: sanitized,
    gemma_used: true,
    timings_ms: { rules: 2, gemma: gemmaMs, total: gemmaMs + 4 },
  };
}

function sanitize(text: string, entities: Entity[]): string {
  let out = text;
  for (const e of [...entities].sort((a, b) => b.text.length - a.text.length)) {
    out = out.split(e.text).join(e.replacement);
  }
  return out;
}

function rehydrate(text: string, entities: Entity[]): string {
  let out = text;
  for (const e of entities) {
    if (!e.redacted) out = out.split(e.replacement).join(e.text);
  }
  return out;
}

function placeholdersOf(entities: Entity[], types: string[]): string[] {
  return entities.filter((e) => types.includes(e.type)).map((e) => e.replacement);
}

function firstAnswer(entities: Entity[]): string {
  const people = placeholdersOf(entities, ["PERSON"]);
  const orgs = placeholdersOf(entities, ["ORG", "PROJECT"]);
  const secrets = entities.filter((e) => e.redacted).map((e) => e.replacement);
  const lines = ["Here's how I'd handle this:"];
  if (people.length) lines.push(`• Reply directly to ${people[0]} and acknowledge their concern first.`);
  if (orgs.length) lines.push(`• Keep the focus on ${orgs.join(" and ")} — be concrete about what is already done.`);
  if (secrets.length) {
    lines.push(`• Don't paste ${secrets.join(", ")} into messages or docs; rotate anything that was shared.`);
  }
  lines.push(people.length ? `Suggested opener: "Hi ${people[0]}, thanks for being upfront with us…"` : "Let me know if you want a full draft.");
  return lines.join("\n");
}

function followUpAnswer(question: string, entities: Entity[]): string {
  const secrets = entities.filter((e) => e.redacted);
  if (/\b(key|password|secret|token|card|aadhaar|credential)s?\b/i.test(question) && secrets.length) {
    return (
      `I don't know the actual value. In what you sent me it only appears as ${secrets.map((e) => e.replacement).join(", ")} — ` +
      "the real value was removed before it reached me. Check your secrets manager."
    );
  }
  const person = placeholdersOf(entities, ["PERSON"])[0];
  return person
    ? `Sure. Based on our conversation, I'd keep ${person} in the loop and follow up within two working days.`
    : "Sure — based on what you shared, I'd follow up within two working days.";
}

const scans = new Map<string, ScanResponse>();
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockApi: AirlockApi = {
  async health() {
    await delay(150);
    return { ok: true, gemma_loaded: true, gemma_status: "loaded", model_alias: "gemma-4-e2b-it (mock)", cloud_configured: true };
  },

  async scan(text) {
    await delay(1800);
    const scan = buildScan(text);
    scans.set(scan.scan_id, scan);
    return scan;
  },

  async ask({ scan_id, question }): Promise<AskResponse> {
    await delay(1200);
    const scan = scans.get(scan_id);
    if (!scan) throw new Error("Scan not found (mock). Scan the text again.");
    const { entities } = scan;
    const cloudSaw = question ? sanitize(question, entities) : scan.sanitized_text;
    const raw = question ? followUpAnswer(cloudSaw, entities) : firstAnswer(entities);
    return {
      scan_id,
      cloud_model: "mock-cloud-model",
      cloud_saw: cloudSaw,
      cloud_response_raw: raw,
      response: rehydrate(raw, entities),
      timings_ms: { cloud: 1150 },
    };
  },
};
