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
      <div className="flex items-end justify-between rounded-xl bg-slate-900/80 px-4 py-3 ring-1 ring-slate-700/70">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Risk</p>
          <RiskBadge risk={scan.risk} size="lg" />
        </div>
        <div className="text-right">
          <p className="text-3xl font-black leading-none text-white">{entities.length}</p>
          <p className="mt-1 text-xs text-slate-400">held back</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-slate-800/50 px-2 py-2 ring-1 ring-slate-700/60">
          <p className="text-lg font-bold text-slate-100">{ruleCount}</p>
          <p className="text-[11px] text-slate-400">caught by rules</p>
        </div>
        <div className="rounded-lg bg-violet-500/15 px-2 py-2 ring-1 ring-violet-400/60 shadow-[0_0_18px_-6px_rgba(167,139,250,0.8)]">
          <p className="flex items-center justify-center gap-1 text-lg font-bold text-violet-100">
            <SparkleIcon className="h-4 w-4" />
            {gemmaCount}
          </p>
          <p className="text-[11px] text-violet-200">only Gemma caught</p>
        </div>
      </div>

      {!scan.gemma_used && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/40">
          Gemma wasn&apos;t available for this scan — rule results only. Contextual items may be missed.
        </p>
      )}

      {entities.length === 0 ? (
        <p className="rounded-lg bg-slate-800/50 p-3 text-sm text-slate-300">Nothing sensitive found.</p>
      ) : (
        <ul className="max-h-[19rem] space-y-1.5 overflow-y-auto pr-1 pb-8 [mask-image:linear-gradient(to_bottom,black_88%,transparent)]">
          {entities.map((e) => {
            const gemma = e.source === "gemma";
            return (
              <li
                key={e.text}
                className={`rounded-lg px-3 py-2 ring-1 ${
                  gemma ? "bg-violet-500/10 ring-violet-400/50" : "bg-slate-800/40 ring-slate-700/60"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-100" title={e.text}>
                    {e.text}
                  </span>
                  <span className={`shrink-0 font-mono text-xs ${e.redacted ? "text-rose-300" : "text-sky-300"}`}>
                    {e.replacement}
                    {e.count > 1 && <span className="ml-1 text-slate-500">×{e.count}</span>}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <SourceBadge source={e.source} />
                  <RiskBadge risk={e.risk} />
                  {e.redacted && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-300">
                      <LockIcon className="h-3 w-3" /> never restored
                    </span>
                  )}
                </div>
                {e.reason && <p className="mt-1 text-xs leading-snug text-violet-200/80">{e.reason}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
          <CheckIcon className="h-3 w-3" /> Processed locally
        </span>
        {t.rules != null && <span>rules {t.rules} ms</span>}
        {scan.gemma_used && t.gemma != null && <span>· Gemma {t.gemma} ms</span>}
      </p>
    </div>
  );
}
