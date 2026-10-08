import { Fragment } from "react";
import { Spinner } from "./Badges";
import { ErrorBanner, type ErrorInfo } from "./ErrorBanner";
import { HighlightedText, MARK } from "./HighlightedText";
import { ArrowLeftIcon, ArrowRightIcon, BracketsIcon, CloudIcon, LockIcon, ShieldCheckIcon } from "./Icons";
import { Manifest } from "./Manifest";
import type { AskResponse, Entity, ScanResponse } from "@/lib/types";

export interface Turn {
  question?: string;
  answer: AskResponse;
}

// ---------- layout ----------

const GATE_WALLS = "lg:border-x lg:border-dashed lg:border-stone-300";

// One row across the three lanes: device | airlock | cloud. Lanes have no gap so the
// airlock's tint and dashed walls run continuously down the page.
function Row({ device, gate, cloud }: { device?: React.ReactNode; gate?: React.ReactNode; cloud?: React.ReactNode }) {
  return (
    <>
      <div className="px-6 py-4">{device}</div>
      <div className={`bg-stone-100/70 px-4 py-4 ${GATE_WALLS}`}>{gate}</div>
      <div className="px-6 py-4">{cloud}</div>
    </>
  );
}

function LaneHeads({ cloudModel }: { cloudModel?: string }) {
  const head = "sticky top-0 z-10 flex items-center gap-2 border-b border-stone-200 py-3 backdrop-blur";
  const title = "text-[13px] font-semibold text-stone-900";
  return (
    <>
      <div className={`${head} bg-paper/90 px-6`}>
        <LockIcon className="h-4 w-4 text-stone-500" />
        <span className={title}>On this device</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
          Private
        </span>
      </div>
      <div className={`${head} justify-center bg-stone-100/90 px-4 ${GATE_WALLS}`}>
        <BracketsIcon className="h-4 w-4 text-stone-500" />
        <span className={title}>Airlock</span>
      </div>
      <div className={`${head} bg-paper/90 px-6`}>
        <CloudIcon className="h-4 w-4 text-stone-500" />
        <span className={title}>Cloud model</span>
        <span className="truncate text-xs text-stone-400">{cloudModel ?? "sees placeholders only"}</span>
      </div>
    </>
  );
}

// ---------- building blocks ----------

function Card({
  label,
  meta,
  restored = false,
  className = "",
  children,
}: {
  label: string;
  meta?: string;
  restored?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(12,10,9,0.04)] ring-1 ${
        restored ? "ring-emerald-300" : "ring-stone-200"
      } ${className}`}
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${
            restored ? "text-emerald-700" : "text-stone-500"
          }`}
        >
          {label}
        </p>
        {meta && <p className="truncate text-[11px] text-stone-400 tabular-nums">{meta}</p>}
      </div>
      <div className="text-[15px] leading-[1.7] text-stone-800">{children}</div>
    </div>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <p className="mt-2 flex gap-4 px-1 text-xs text-stone-500">
      {items.map(([swatch, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-[3px] ${swatch}`} /> {label}
        </span>
      ))}
    </p>
  );
}

function Sealed({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 p-4 text-center text-sm text-stone-400">
      <LockIcon className="h-5 w-5" />
      {children}
    </div>
  );
}

function Typing({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-4 ring-1 ring-stone-200">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-stone-500" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
      <span className="text-sm text-stone-500">{label}</span>
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
  const back = direction === "back";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <div className="flex w-full items-center gap-2">
        <span className="h-px flex-1 bg-stone-300" />
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ${
            back ? "text-emerald-700 ring-emerald-200" : "text-stone-700 ring-stone-300"
          }`}
        >
          {busy ? <Spinner className="h-3.5 w-3.5" /> : back ? <ArrowLeftIcon /> : <ArrowRightIcon />}
        </span>
        <span className="h-px flex-1 bg-stone-300" />
      </div>
      <p className="text-[13px] font-medium text-stone-800">{title}</p>
      {detail && <p className="text-xs text-stone-500">{detail}</p>}
    </div>
  );
}

function ScanningGate({ seconds, withGemma }: { seconds: number; withGemma: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-stone-200 border-t-stone-900" />
        <ShieldCheckIcon className="h-6 w-6 text-stone-900" />
      </div>
      <p className="text-[15px] font-medium text-stone-900">
        Scanning on this device
        {withGemma ? (
          <>
            {" "}
            with <span className="text-blue-700">Gemma 4</span>…
          </>
        ) : (
          " (rules only)…"
        )}
      </p>
      <p className="text-sm text-stone-500 tabular-nums">{seconds}s · nothing has left this machine</p>
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
            <Card label="Your text" className={scanning ? "scan-sweep" : ""}>
              {scan ? (
                <HighlightedText text={text} entities={entities} mode="original" />
              ) : (
                <p className="whitespace-pre-wrap break-words">{text}</p>
              )}
            </Card>
            {scan && (
              <Legend
                items={[
                  [MARK.rule, "Caught by a rule"],
                  [MARK.gemma, "Caught by Gemma"],
                ]}
              />
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
              <Card label={sent ? "Sent to the cloud" : "Ready to send"}>
                <HighlightedText text={scan.sanitized_text} entities={entities} mode="sanitized" />
              </Card>
              <Legend
                items={[
                  [MARK.placeholder, "Restored later"],
                  [MARK.redacted, "Never restored"],
                ]}
              />
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
                <Card label="You asked">
                  <p className="whitespace-pre-wrap break-words">{turn.question}</p>
                </Card>
              }
              gate={<Connector direction="out" title="Sanitized" detail="Same placeholders as before" />}
              cloud={
                <Card label="Sent to the cloud">
                  <HighlightedText text={turn.answer.cloud_saw} entities={entities} mode="sanitized" />
                </Card>
              }
            />
          )}
          <Row
            device={
              <Card label="What you see · restored here" restored>
                <HighlightedText text={turn.answer.response} entities={entities} mode="response" />
              </Card>
            }
            gate={<Connector direction="back" title="Restored locally" detail={restoredSummary(turn.answer, entities)} />}
            cloud={
              <Card
                label="Cloud replied"
                meta={turn.answer.timings_ms.cloud != null ? `${turn.answer.timings_ms.cloud} ms` : undefined}
              >
                <HighlightedText text={turn.answer.cloud_response_raw} entities={entities} mode="sanitized" />
              </Card>
            }
          />
        </Fragment>
      ))}

      {asking && (
        <Row
          device={
            pendingQuestion ? (
              <Card label="You asked">
                <p className="whitespace-pre-wrap break-words">{pendingQuestion}</p>
              </Card>
            ) : (
              <Sealed>The answer will be restored here.</Sealed>
            )
          }
          gate={<Connector direction="out" title="Sending placeholders only" busy />}
          cloud={<Typing label="The cloud model is answering…" />}
        />
      )}

      {askError && !asking && <Row gate={<ErrorBanner {...askError} />} />}
    </div>
  );
}
