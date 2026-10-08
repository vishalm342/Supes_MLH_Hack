import { Fragment } from "react";
import { Spinner } from "./Badges";
import { ErrorBanner, type ErrorInfo } from "./ErrorBanner";
import { HighlightedText } from "./HighlightedText";
import { ArrowLeftIcon, ArrowRightIcon, CloudIcon, LockIcon, ShieldIcon } from "./Icons";
import { Manifest } from "./Manifest";
import type { AskResponse, Entity, ScanResponse } from "@/lib/types";

export interface Turn {
  question?: string;
  answer: AskResponse;
}

// ---------- layout ----------

// One row across the three lanes: device | airlock | cloud. Lanes have no gap so their
// tints and the airlock's dashed walls run continuously down the page.
function Row({ device, gate, cloud }: { device?: React.ReactNode; gate?: React.ReactNode; cloud?: React.ReactNode }) {
  return (
    <>
      <div className="bg-violet-500/[0.03] px-6 py-4">{device}</div>
      <div className="bg-slate-950/50 px-4 py-4 lg:border-x lg:border-dashed lg:border-slate-700/80">{gate}</div>
      <div className="bg-sky-500/[0.03] px-6 py-4">{cloud}</div>
    </>
  );
}

function LaneHeads({ cloudModel }: { cloudModel?: string }) {
  const head = "sticky top-0 z-10 flex items-center gap-2 border-b border-slate-800 bg-[#07090f]/95 py-3 backdrop-blur";
  return (
    <>
      <div className={`${head} px-6 text-violet-300`}>
        <LockIcon className="h-4 w-4" />
        <span className="text-sm font-bold uppercase tracking-wider">On your device</span>
        <span className="text-xs font-normal text-slate-500">· private</span>
      </div>
      <div className={`${head} justify-center px-4 text-slate-200 lg:border-x lg:border-dashed lg:border-slate-700/80`}>
        <ShieldIcon className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-bold uppercase tracking-wider">Airlock</span>
      </div>
      <div className={`${head} px-6 text-sky-300`}>
        <CloudIcon className="h-4 w-4" />
        <span className="text-sm font-bold uppercase tracking-wider">Cloud model</span>
        <span className="truncate text-xs font-normal text-slate-500">· {cloudModel ?? "sees placeholders only"}</span>
      </div>
    </>
  );
}

// ---------- building blocks ----------

type Tone = "device" | "cloud" | "restored";

const TONES: Record<Tone, { ring: string; label: string }> = {
  device: { ring: "ring-violet-500/30", label: "text-violet-300" },
  cloud: { ring: "ring-sky-500/30", label: "text-sky-300" },
  restored: { ring: "ring-emerald-500/50 shadow-[0_0_24px_-10px_rgba(52,211,153,0.6)]", label: "text-emerald-300" },
};

function Bubble({
  tone,
  label,
  meta,
  className = "",
  children,
}: {
  tone: Tone;
  label: string;
  meta?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl bg-slate-900/85 p-4 ring-1 ${TONES[tone].ring} ${className}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className={`text-[11px] font-bold uppercase tracking-wider ${TONES[tone].label}`}>{label}</p>
        {meta && <p className="truncate text-[11px] text-slate-500">{meta}</p>}
      </div>
      <div className="text-[15px] leading-relaxed text-slate-100">{children}</div>
    </div>
  );
}

function Sealed({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700/80 p-4 text-center text-sm text-slate-500">
      <LockIcon className="h-5 w-5 text-slate-600" />
      {children}
    </div>
  );
}

function Typing({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-900/70 p-4 ring-1 ring-sky-500/20">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="typing-dot h-2 w-2 rounded-full bg-sky-300" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
      <span className="text-sm text-slate-400">{label}</span>
    </div>
  );
}

function Connector({
  direction,
  title,
  detail,
  busy = false,
}: {
  direction: "out" | "back";
  title: string;
  detail?: string;
  busy?: boolean;
}) {
  const out = direction === "out";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <div className="flex w-full items-center gap-2">
        <span className={`h-px flex-1 ${out ? "bg-violet-400/40" : "bg-emerald-400/40"}`} />
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${
            out ? "bg-sky-500/15 text-sky-300 ring-sky-400/50" : "bg-emerald-500/15 text-emerald-300 ring-emerald-400/50"
          }`}
        >
          {busy ? <Spinner /> : out ? <ArrowRightIcon /> : <ArrowLeftIcon />}
        </span>
        <span className={`h-px flex-1 ${out ? "bg-sky-400/40" : "bg-emerald-400/40"}`} />
      </div>
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      {detail && <p className="text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

function ScanningGate({ seconds, withGemma }: { seconds: number; withGemma: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-violet-500/20 border-t-violet-400" />
        <ShieldIcon className="h-7 w-7 animate-pulse text-violet-300" />
      </div>
      <p className="text-base font-semibold text-violet-100">
        Scanning on this device{withGemma ? " with Gemma 4" : " (rules only)"}…
      </p>
      <p className="text-sm text-slate-400">{seconds}s · nothing has left this machine</p>
    </div>
  );
}

function restoredSummary(answer: AskResponse, entities: Entity[]): string {
  const restored = entities.filter((e) => !e.redacted && answer.response.includes(e.text)).length;
  const kept = entities.filter((e) => e.redacted && answer.cloud_response_raw.includes(e.replacement)).length;
  const parts: string[] = [];
  if (restored) parts.push(`${restored} value${restored === 1 ? "" : "s"} restored`);
  if (kept) parts.push(`${kept} secret${kept === 1 ? "" : "s"} kept hidden`);
  return parts.join(" · ") || "Nothing to restore";
}

// ---------- workspace ----------

export function Workspace({
  text,
  scan,
  scanning,
  scanSeconds,
  gemmaExpected,
  scanError,
  turns,
  asking,
  pendingQuestion,
  askError,
}: {
  text: string;
  scan: ScanResponse | null;
  scanning: boolean;
  scanSeconds: number;
  gemmaExpected: boolean;
  scanError: ErrorInfo | null;
  turns: Turn[];
  asking: boolean;
  pendingQuestion?: string;
  askError: ErrorInfo | null;
}) {
  const entities = scan?.entities ?? [];
  const sent = turns.length > 0 || asking;

  return (
    <div className="grid min-h-full grid-cols-1 content-start lg:grid-cols-[minmax(0,1fr)_21rem_minmax(0,1fr)]">
      <LaneHeads cloudModel={turns.at(-1)?.answer.cloud_model} />

      {/* Your text → manifest → what can leave */}
      <Row
        device={
          <div>
            <Bubble tone="device" label="Your text" className={scanning ? "scan-sweep" : ""}>
              {scan ? (
                <HighlightedText text={text} entities={entities} mode="original" />
              ) : (
                <p className="whitespace-pre-wrap break-words">{text}</p>
              )}
            </Bubble>
            {scan && (
              <p className="mt-2 flex gap-4 px-1 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-400/70" /> Rule
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-violet-400" /> Gemma (local AI)
                </span>
              </p>
            )}
          </div>
        }
        gate={
          scanning ? (
            <ScanningGate seconds={scanSeconds} withGemma={gemmaExpected} />
          ) : scanError ? (
            <ErrorBanner {...scanError} />
          ) : scan ? (
            <Manifest scan={scan} />
          ) : null
        }
        cloud={
          scan ? (
            <div>
              <Bubble tone="cloud" label={sent ? "Sent to the cloud" : "Ready to send"}>
                <HighlightedText text={scan.sanitized_text} entities={entities} mode="sanitized" />
              </Bubble>
              <p className="mt-2 flex gap-4 px-1 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-sky-400/70" /> Restored later
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-400/80" /> Never restored
                </span>
              </p>
            </div>
          ) : (
            <Sealed>Nothing has left this device.</Sealed>
          )
        }
      />

      {turns.map((turn, i) => (
        <Fragment key={i}>
          {turn.question && (
            <Row
              device={
                <Bubble tone="device" label="You asked">
                  <p className="whitespace-pre-wrap break-words">{turn.question}</p>
                </Bubble>
              }
              gate={<Connector direction="out" title="Sanitized" detail="Same placeholders as before" />}
              cloud={
                <Bubble tone="cloud" label="Sent to the cloud">
                  <HighlightedText text={turn.answer.cloud_saw} entities={entities} mode="sanitized" />
                </Bubble>
              }
            />
          )}
          <Row
            device={
              <Bubble tone="restored" label="What you see · restored here">
                <HighlightedText text={turn.answer.response} entities={entities} mode="response" />
              </Bubble>
            }
            gate={<Connector direction="back" title="Restored locally" detail={restoredSummary(turn.answer, entities)} />}
            cloud={
              <Bubble
                tone="cloud"
                label="Cloud replied"
                meta={turn.answer.timings_ms.cloud != null ? `${turn.answer.timings_ms.cloud} ms` : undefined}
              >
                <HighlightedText text={turn.answer.cloud_response_raw} entities={entities} mode="sanitized" />
              </Bubble>
            }
          />
        </Fragment>
      ))}

      {asking && (
        <Row
          device={
            pendingQuestion ? (
              <Bubble tone="device" label="You asked">
                <p className="whitespace-pre-wrap break-words">{pendingQuestion}</p>
              </Bubble>
            ) : (
              <Sealed>The answer will be restored here.</Sealed>
            )
          }
          gate={<Connector direction="out" title="Sending placeholders only" busy />}
          cloud={<Typing label="Cloud model is answering…" />}
        />
      )}

      {askError && !asking && <Row gate={<ErrorBanner {...askError} />} />}
    </div>
  );
}
