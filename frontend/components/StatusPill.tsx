import type { Health } from "@/lib/types";

export type HealthState = { status: "loading" } | { status: "ok"; health: Health } | { status: "down"; error: string };

function Pill({ dot, children, title }: { dot: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-200"
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

export function StatusPill({ state }: { state: HealthState }) {
  if (state.status === "loading") {
    return <Pill dot="bg-stone-400 animate-pulse">Checking backend…</Pill>;
  }
  if (state.status === "down") {
    return (
      <Pill dot="bg-red-500" title={state.error}>
        Backend offline
      </Pill>
    );
  }
  const { health } = state;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {health.gemma_status === "loading" ? (
        <Pill dot="bg-sky-500 animate-pulse" title="Gemma takes about a minute to load after the backend starts">
          Gemma loading…
        </Pill>
      ) : health.gemma_status === "failed" ? (
        <Pill dot="bg-red-500" title="Check the backend logs">
          Gemma failed · rules only
        </Pill>
      ) : (
        <Pill dot={health.gemma_loaded ? "bg-emerald-500" : "bg-amber-500"}>
          {health.gemma_loaded ? `Gemma · ${health.model_alias}` : "Gemma off · rules only"}
        </Pill>
      )}
      <Pill dot={health.cloud_configured ? "bg-emerald-500" : "bg-amber-500"}>
        {health.cloud_configured ? "Cloud ready" : "Cloud not configured"}
      </Pill>
    </div>
  );
}
