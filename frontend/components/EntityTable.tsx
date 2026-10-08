import { RiskBadge, SourceBadge } from "./Badges";
import type { Entity } from "@/lib/types";

export function EntityTable({ entities }: { entities: Entity[] }) {
  if (entities.length === 0) {
    return <p className="rounded-lg bg-slate-800/50 p-4 text-slate-300">Nothing sensitive found in this text.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-slate-700/70">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-800/80 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2 font-semibold">Type</th>
            <th className="px-3 py-2 font-semibold">Original value</th>
            <th className="px-3 py-2 font-semibold">Sent as</th>
            <th className="px-3 py-2 font-semibold">Risk</th>
            <th className="px-3 py-2 font-semibold">Caught by</th>
          </tr>
        </thead>
        <tbody>
          {entities.map((e) => {
            const gemma = e.source === "gemma";
            return (
              <tr
                key={e.replacement}
                className={`border-t border-slate-800 ${
                  gemma ? "bg-violet-500/10 shadow-[inset_3px_0_0_0_rgb(167,139,250)]" : ""
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-300">{e.type}</td>
                <td className="px-3 py-2">
                  <div className="max-w-[18rem] break-words font-medium text-slate-100">{e.text}</div>
                  {e.reason && <div className="text-xs text-violet-300/80">{e.reason}</div>}
                </td>
                <td className="px-3 py-2">
                  <span className={`font-mono text-xs ${e.redacted ? "text-rose-300" : "text-sky-300"}`}>
                    {e.replacement}
                  </span>
                  {e.count > 1 && <span className="ml-1 text-xs text-slate-500">×{e.count}</span>}
                  {e.redacted && <div className="text-[11px] text-rose-300/70">redacted · never restored</div>}
                </td>
                <td className="px-3 py-2">
                  <RiskBadge risk={e.risk} />
                </td>
                <td className="px-3 py-2">
                  <SourceBadge source={e.source} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
