import { SparkleIcon } from "./Icons";
import type { EntitySource, OverallRisk } from "@/lib/types";

const RISK: Record<OverallRisk, { label: string; cls: string; dot: string }> = {
  NONE: { label: "None", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  LOW: { label: "Low", cls: "bg-stone-100 text-stone-700 ring-stone-200", dot: "bg-stone-400" },
  MEDIUM: { label: "Medium", cls: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  HIGH: { label: "High", cls: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
};

export function RiskBadge({ risk, size = "sm" }: { risk: OverallRisk; size?: "sm" | "lg" }) {
  const { label, cls, dot } = RISK[risk];
  const sizing = size === "lg" ? "gap-2 px-3 py-1 text-sm font-semibold" : "gap-1.5 px-1.5 py-0.5 text-[11px] font-medium";
  return (
    <span className={`inline-flex items-center rounded-md ring-1 ring-inset ${sizing} ${cls}`}>
      <span aria-hidden className={`rounded-full ${dot} ${size === "lg" ? "h-2 w-2" : "h-1.5 w-1.5"}`} />
      {label}
    </span>
  );
}

export function SourceBadge({ source }: { source: EntitySource }) {
  if (source === "gemma") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
        <SparkleIcon className="h-3 w-3" />
        Gemma · local AI
      </span>
    );
  }
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600 ring-1 ring-inset ring-stone-200">
      Rule
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 animate-spin rounded-full border-[1.5px] border-current border-t-transparent ${className}`}
    />
  );
}
