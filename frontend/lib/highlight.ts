import type { Entity } from "./types";

export type SegmentKind = "original" | "placeholder" | "redacted" | "restored";

export interface Segment {
  text: string;
  kind?: SegmentKind;
  entity?: Entity;
}

export type HighlightMode =
  | "original" // raw text: mark the sensitive values
  | "sanitized" // placeholder text: mark [TYPE_N]
  | "response"; // rehydrated answer: mark restored values and leftover (redacted) placeholders

const PLACEHOLDER_RE = /\[[A-Z][A-Z_]*_\d+\]/g;

interface Match {
  start: number;
  end: number;
  kind: SegmentKind;
  entity?: Entity;
}

function indexesOf(text: string, needle: string): number[] {
  const out: number[] = [];
  if (!needle) return out;
  let i = text.indexOf(needle);
  while (i !== -1) {
    out.push(i);
    i = text.indexOf(needle, i + needle.length);
  }
  return out;
}

export function segment(text: string, entities: Entity[], mode: HighlightMode): Segment[] {
  const matches: Match[] = [];

  if (mode !== "sanitized") {
    for (const entity of entities) {
      if (mode === "response" && entity.redacted) continue;
      for (const start of indexesOf(text, entity.text)) {
        matches.push({
          start,
          end: start + entity.text.length,
          kind: mode === "original" ? "original" : "restored",
          entity,
        });
      }
    }
  }

  if (mode !== "original") {
    const byPlaceholder = new Map(entities.map((e) => [e.replacement, e]));
    for (const m of text.matchAll(PLACEHOLDER_RE)) {
      const entity = byPlaceholder.get(m[0]);
      const start = m.index ?? 0;
      matches.push({
        start,
        end: start + m[0].length,
        kind: entity?.redacted ? "redacted" : "placeholder",
        entity,
      });
    }
  }

  // Earliest first; on ties prefer the longest match. Drop anything overlapping an accepted match.
  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const segments: Segment[] = [];
  let pos = 0;
  for (const m of matches) {
    if (m.start < pos) continue;
    if (m.start > pos) segments.push({ text: text.slice(pos, m.start) });
    segments.push({ text: text.slice(m.start, m.end), kind: m.kind, entity: m.entity });
    pos = m.end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos) });
  return segments;
}
