import type { Health } from "@/lib/types";

export type HealthState = { status: "loading" } | { status: "ok"; health: Health } | { status: "down"; error: string };

function Dot({ color }: { color: string }) {
  return <span aria-hidden className={`h-2 w-2 rounded-full ${color}`} />;
}

function Pill({ color, children, title }: { color: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-slate-700"
    >
      <Dot color={color} />
      {children}
    </span>
  );
}

export function StatusPill({ state }: { state: HealthState }) {
  if (state.status === "loading") {
    return <Pill color="bg-slate-400 animate-pulse">Checking backend…</Pill>;
  }
  if (state.status === "down") {
    return (
      <Pill color="bg-rose-500" title={state.error}>
        Backend offline
      </Pill>
    );
  }
  const { health } = state;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {health.gemma_status === "loading" ? (
        <Pill color="bg-sky-400 animate-pulse" title="Gemma takes about a minute to load after the backend starts">
          Gemma loading…
        </Pill>
      ) : health.gemma_status === "failed" ? (
        <Pill color="bg-rose-500" title="Check the backend logs">
          Gemma failed to load · rules only
        </Pill>
      ) : (
        <Pill color={health.gemma_loaded ? "bg-emerald-400" : "bg-amber-400"}>
          {health.gemma_loaded ? `Gemma loaded · ${health.model_alias}` : "Gemma off · rules only"}
        </Pill>
      )}
      <Pill color={health.cloud_configured ? "bg-emerald-400" : "bg-amber-400"}>
        {health.cloud_configured ? "Cloud configured" : "Cloud not configured"}
      </Pill>
    </div>
  );
}
