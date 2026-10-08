import { segment, type HighlightMode, type Segment } from "@/lib/highlight";
import type { Entity } from "@/lib/types";

// Real values get a highlighter-pen mark (tint + solid underline, readable on a projector);
// placeholders are monospace tokens.
export const MARK = {
  rule: "bg-stone-300/55 shadow-[inset_0_-2px_0_0_#78716c]",
  gemma: "bg-blue-200/70 shadow-[inset_0_-2px_0_0_#2563eb]",
  restored: "bg-emerald-200/60 shadow-[inset_0_-2px_0_0_#059669]",
  placeholder: "bg-stone-100 ring-1 ring-inset ring-stone-300",
  redacted: "bg-red-50 ring-1 ring-inset ring-red-300",
};

const PEN = "rounded-[3px] px-[2px]";
const TOKEN = "rounded-[5px] px-1 py-px font-mono text-[0.82em] font-medium";

function classFor(seg: Segment): string {
  switch (seg.kind) {
    case "original":
      return seg.entity?.source === "gemma"
        ? `${PEN} ${MARK.gemma} text-blue-950`
        : `${PEN} ${MARK.rule} text-stone-950`;
    case "placeholder":
      return `${TOKEN} ${MARK.placeholder} text-stone-700`;
    case "redacted":
      return `${TOKEN} ${MARK.redacted} text-red-700`;
    case "restored":
      return `${PEN} ${MARK.restored} font-medium text-emerald-950`;
    default:
      return "";
  }
}

function titleFor(seg: Segment): string | undefined {
  const e = seg.entity;
  if (!e) return seg.kind === "redacted" ? "Redacted — never restored" : seg.kind ? "Placeholder" : undefined;
  switch (seg.kind) {
    case "original":
      return `${e.type} → ${e.replacement} (${e.source === "gemma" ? "caught by Gemma" : "caught by a rule"})`;
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
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {segment(text, entities, mode).map((seg, i) =>
        seg.kind ? (
          <mark key={i} title={titleFor(seg)} className={`box-decoration-clone ${classFor(seg)}`}>
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}
