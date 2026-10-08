import { segment, type HighlightMode, type Segment } from "@/lib/highlight";
import type { Entity } from "@/lib/types";

function classFor(seg: Segment): string {
  switch (seg.kind) {
    case "original":
      return seg.entity?.source === "gemma"
        ? "bg-violet-500/30 text-violet-50 ring-1 ring-violet-400/70"
        : "bg-amber-400/20 text-amber-50 ring-1 ring-amber-400/60";
    case "placeholder":
      return "bg-sky-500/20 font-mono text-[0.92em] text-sky-200 ring-1 ring-sky-400/50";
    case "redacted":
      return "bg-rose-500/25 font-mono text-[0.92em] text-rose-200 ring-1 ring-rose-400/60";
    case "restored":
      return "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/60";
    default:
      return "";
  }
}

function titleFor(seg: Segment): string | undefined {
  const e = seg.entity;
  if (!e) return seg.kind === "placeholder" ? "Placeholder" : undefined;
  switch (seg.kind) {
    case "original":
      return `${e.type} → ${e.replacement} (${e.source === "gemma" ? "caught by Gemma" : "caught by rule"})`;
    case "redacted":
      return `${e.type} — redacted, never restored`;
    case "restored":
      return `Restored locally from ${e.replacement}`;
    default:
      return `${e.type} placeholder`;
  }
}

export function HighlightedText({
  text,
  entities,
  mode,
  className = "",
}: {
  text: string;
  entities: Entity[];
  mode: HighlightMode;
  className?: string;
}) {
  return (
    <p className={`whitespace-pre-wrap break-words leading-relaxed ${className}`}>
      {segment(text, entities, mode).map((seg, i) =>
        seg.kind ? (
          <mark key={i} title={titleFor(seg)} className={`rounded px-0.5 ${classFor(seg)}`}>
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}
