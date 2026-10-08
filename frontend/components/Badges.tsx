import type { EntitySource, OverallRisk } from "@/lib/types";

const RISK_STYLES: Record<OverallRisk, string> = {
  NONE: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/40",
  LOW: "bg-sky-500/15 text-sky-300 ring-sky-400/40",
  MEDIUM: "bg-amber-500/15 text-amber-300 ring-amber-400/40",
  HIGH: "bg-rose-500/20 text-rose-300 ring-rose-400/50",
};

export function RiskBadge({ risk, size = "sm" }: { risk: OverallRisk; size?: "sm" | "lg" }) {
  const sizing = size === "lg" ? "px-4 py-1.5 text-lg tracking-wider" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center rounded-md font-bold ring-1 ${sizing} ${RISK_STYLES[risk]}`}>{risk}</span>
  );
}

export function SourceBadge({ source }: { source: EntitySource }) {
  if (source === "gemma") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-violet-500/25 px-2.5 py-0.5 text-xs font-semibold text-violet-200 ring-1 ring-violet-400/60 shadow-[0_0_12px_-2px_rgba(167,139,250,0.6)]">
        <span aria-hidden>✦</span> Gemma (local AI)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-slate-700/60 px-2.5 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-slate-500/50">
      Rule
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
