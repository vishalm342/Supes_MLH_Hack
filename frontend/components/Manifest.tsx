import { RiskBadge, SourceBadge } from "./Badges";
import { CheckIcon, LockIcon, SparkleIcon } from "./Icons";
import type { ScanResponse } from "@/lib/types";

// The airlock's manifest: everything held back from the cloud, and who caught it.
export function Manifest({ scan }: { scan: ScanResponse }) {
  const { entities, timings_ms: t } = scan;
  const gemmaCount = entities.filter((e) => e.source === "gemma").length;
  const ruleCount = entities.length - gemmaCount;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">Risk</p>
          <RiskBadge risk={scan.risk} size="lg" />
        </div>
        <div className="text-right">
          <p className="font-display text-[2.6rem] leading-none tracking-tight text-stone-950 tabular-nums">
            {entities.length}
          </p>
          <p className="mt-1 text-xs text-stone-500">held back</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-stone-200">
          <p className="font-display text-2xl leading-none text-stone-900 tabular-nums">{ruleCount}</p>
          <p className="mt-1 text-xs text-stone-500">caught by rules</p>
        </div>
        <div className="rounded-xl bg-blue-50 px-3 py-2.5 ring-1 ring-blue-200">
          <p className="flex items-center gap-1.5 font-display text-2xl leading-none text-blue-700 tabular-nums">
            {gemmaCount}
            <SparkleIcon className="h-4 w-4" />
          </p>
          <p className="mt-1 text-xs font-medium text-blue-700">only Gemma caught</p>
        </div>
      </div>

      {!scan.gemma_used && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          Gemma wasn&apos;t available for this scan — rule results only. Contextual items may be missed.
        </p>
      )}

      {entities.length === 0 ? (
        <p className="rounded-xl bg-white p-3 text-sm text-stone-600 ring-1 ring-stone-200">Nothing sensitive found.</p>
      ) : (
        <ul className="max-h-[19rem] space-y-1.5 overflow-y-auto pb-8 pr-1 [mask-image:linear-gradient(to_bottom,black_86%,transparent)]">
          {entities.map((e) => (
            <li
              key={e.text}
              className={`rounded-lg bg-white px-3 py-2.5 ring-1 ${
                e.source === "gemma" ? "shadow-[inset_2px_0_0_0_#2563eb] ring-blue-200" : "ring-stone-200"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium text-stone-900" title={e.text}>
                  {e.text}
                </span>
                <span className={`shrink-0 font-mono text-[11px] ${e.redacted ? "text-red-600" : "text-stone-500"}`}>
                  {e.replacement}
                  {e.count > 1 && <span className="ml-1 text-stone-400">×{e.count}</span>}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <SourceBadge source={e.source} />
                <RiskBadge risk={e.risk} />
                {e.redacted && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
                    <LockIcon className="h-3 w-3" /> never restored
                  </span>
                )}
              </div>
              {e.reason && <p className="mt-1.5 text-xs leading-snug text-stone-500">{e.reason}</p>}
            </li>
          ))}
        </ul>
      )}

      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-stone-500 tabular-nums">
        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
          <CheckIcon className="h-3 w-3" /> Processed locally
        </span>
        {t.rules != null && <span>· rules {t.rules} ms</span>}
        {scan.gemma_used && t.gemma != null && <span>· Gemma {t.gemma} ms</span>}
      </p>
    </div>
  );
}
