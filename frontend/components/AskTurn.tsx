import { HighlightedText } from "./HighlightedText";
import type { AskResponse, Entity } from "@/lib/types";

export interface Turn {
  question?: string;
  answer: AskResponse;
}

export function AskTurn({ turn, entities, index }: { turn: Turn; entities: Entity[]; index: number }) {
  const { answer } = turn;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="font-mono text-xs text-slate-500">#{index + 1}</span>
        {turn.question ? (
          <span className="text-slate-200">
            You asked: <span className="font-semibold">“{turn.question}”</span>
          </span>
        ) : (
          <span className="text-slate-200">Sent the sanitized prompt</span>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {answer.cloud_model}
          {answer.timings_ms.cloud != null && ` · ${answer.timings_ms.cloud} ms`}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl bg-slate-900/80 p-4 ring-1 ring-sky-500/30">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-sky-300">
            <span aria-hidden>☁</span> What the cloud saw
          </h3>
          <div className="space-y-3 text-[15px]">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Sent</p>
              <HighlightedText text={answer.cloud_saw} entities={entities} mode="sanitized" className="text-slate-300" />
            </div>
            <div className="border-t border-slate-800 pt-3">
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Cloud replied</p>
              <HighlightedText
                text={answer.cloud_response_raw}
                entities={entities}
                mode="sanitized"
                className="text-slate-300"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-slate-900/80 p-4 ring-1 ring-emerald-500/40">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-300">
            <span aria-hidden>🔒</span> What you see
          </h3>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Restored on this device</p>
          <HighlightedText text={answer.response} entities={entities} mode="response" className="text-[15px] text-slate-100" />
        </section>
      </div>
    </div>
  );
}
