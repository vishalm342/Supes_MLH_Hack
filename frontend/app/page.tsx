"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AskTurn, type Turn } from "@/components/AskTurn";
import { RiskBadge, Spinner } from "@/components/Badges";
import { EntityTable } from "@/components/EntityTable";
import { ErrorBanner } from "@/components/ErrorBanner";
import { HighlightedText } from "@/components/HighlightedText";
import { StatusPill, type HealthState } from "@/components/StatusPill";
import { API_URL, ApiError, MOCK_BY_DEFAULT, errorMessage, getApi } from "@/lib/api";
import { SAMPLES } from "@/lib/samples";
import type { ScanResponse } from "@/lib/types";

const HEALTH_POLL_MS = 10_000;
const FOLLOW_UPS = ["What was the API key?", "Make it shorter and friendlier."];

function useElapsedSeconds(running: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    setSeconds(0);
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(id);
  }, [running]);
  return seconds;
}

function StepHeading({ step, title, children }: { step: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-slate-200 ring-1 ring-slate-600">
        {step}
      </span>
      <h2 className="text-lg font-bold text-slate-100">{title}</h2>
      {children}
    </div>
  );
}

export default function Home() {
  const [useMock, setUseMock] = useState(MOCK_BY_DEFAULT);
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  const [text, setText] = useState(SAMPLES[0].text);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [scannedText, setScannedText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<ApiError | Error | null>(null);
  const [question, setQuestion] = useState("");

  const turnsEndRef = useRef<HTMLDivElement>(null);
  const scanSeconds = useElapsedSeconds(scanning);
  const api = getApi(useMock);

  // ?mock=1 / ?mock=0 overrides the env default, handy on the demo machine.
  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get("mock");
    if (flag === "1" || flag === "true") setUseMock(true);
    if (flag === "0" || flag === "false") setUseMock(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      getApi(useMock)
        .health()
        .then((h) => !cancelled && setHealth({ status: "ok", health: h }))
        .catch((err) => !cancelled && setHealth({ status: "down", error: errorMessage(err) }));
    setHealth({ status: "loading" });
    check();
    const id = setInterval(check, HEALTH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [useMock]);

  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length]);

  const runScan = useCallback(async () => {
    const input = text.trim();
    if (!input || scanning) return;
    setScanning(true);
    setScanError(null);
    setAskError(null);
    setTurns([]);
    try {
      const result = await api.scan(input);
      setScan(result);
      setScannedText(input);
    } catch (err) {
      setScan(null);
      setScanError(errorMessage(err));
    } finally {
      setScanning(false);
    }
  }, [api, text, scanning]);

  const runAsk = useCallback(
    async (followUp?: string) => {
      if (!scan || asking) return;
      const q = followUp?.trim() || undefined;
      setAsking(true);
      setAskError(null);
      try {
        const answer = await api.ask(q ? { scan_id: scan.scan_id, question: q } : { scan_id: scan.scan_id });
        setTurns((prev) => [...prev, { question: q, answer }]);
        if (q) setQuestion("");
      } catch (err) {
        setAskError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setAsking(false);
      }
    },
    [api, scan, asking],
  );

  const gemmaExpected = health.status !== "ok" || health.health.gemma_loaded;
  const textChanged = scan !== null && text.trim() !== scannedText;
  const gemmaCount = scan?.entities.filter((e) => e.source === "gemma").length ?? 0;
  const ruleCount = (scan?.entities.length ?? 0) - gemmaCount;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-black tracking-tight text-white">
              <span className="text-violet-400">⛨</span> Airlock
            </h1>
            <p className="text-sm text-slate-400">Your data stays here. Only placeholders leave.</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <StatusPill state={health} />
            <button
              type="button"
              onClick={() => setUseMock((m) => !m)}
              title={useMock ? "Using built-in mock responses" : `Using backend at ${API_URL}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                useMock
                  ? "bg-fuchsia-500/20 text-fuchsia-200 ring-fuchsia-400/60"
                  : "bg-slate-800/80 text-slate-400 ring-slate-700 hover:text-slate-200"
              }`}
            >
              {useMock ? "MOCK DATA" : "Live API"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {health.status === "down" && !useMock && (
          <ErrorBanner
            title="Can't reach the Airlock backend"
            message={`${health.error} You can switch to mock data to keep going.`}
            action={{ label: "Use mock data", onClick: () => setUseMock(true) }}
          />
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Step 1: input */}
          <section className="rounded-2xl bg-slate-900/60 p-5 ring-1 ring-slate-800 lg:col-span-5">
            <StepHeading step={1} title="Paste private text" />
            <div className="mb-3 flex flex-wrap gap-2">
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setText(s.text)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                    text === s.text
                      ? "bg-violet-500/25 text-violet-100 ring-violet-400/60"
                      : "bg-slate-800 text-slate-300 ring-slate-700 hover:bg-slate-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) runScan();
              }}
              spellCheck={false}
              placeholder="Paste anything you'd normally send to a cloud AI…"
              className="h-64 w-full resize-y rounded-lg bg-slate-950 p-3 text-[15px] leading-relaxed text-slate-100 ring-1 ring-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runScan}
                disabled={!text.trim() || scanning}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanning ? <Spinner /> : <span aria-hidden>⛨</span>}
                {scanning ? "Scanning…" : "Scan Locally"}
              </button>
              <span className="text-xs text-slate-500">Ctrl+Enter · nothing leaves this device</span>
            </div>
          </section>

          {/* Step 2: scan results */}
          <section className="rounded-2xl bg-slate-900/60 p-5 ring-1 ring-slate-800 lg:col-span-7">
            <StepHeading step={2} title="Local scan">
              {scan && !scanning && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-sm text-slate-400">Overall risk</span>
                  <RiskBadge risk={scan.risk} size="lg" />
                </div>
              )}
            </StepHeading>

            {scanning && (
              <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl bg-violet-500/5 ring-1 ring-violet-500/30">
                <Spinner className="h-8 w-8 text-violet-400" />
                <p className="text-lg font-semibold text-violet-200">
                  {gemmaExpected ? "Scanning on this device with Gemma 4…" : "Scanning on this device (rules only)…"}
                </p>
                <p className="text-sm text-slate-400">{scanSeconds}s · no data is leaving this machine</p>
              </div>
            )}

            {!scanning && scanError && (
              <ErrorBanner title="Scan failed" message={scanError} action={{ label: "Retry", onClick: runScan }} />
            )}

            {!scanning && !scanError && !scan && (
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-700 text-center text-slate-500">
                <p>
                  Pick a sample or paste your own text, then hit <span className="font-semibold text-slate-300">Scan Locally</span>.
                  <br />
                  Rules catch the obvious. Gemma catches the context.
                </p>
              </div>
            )}

            {!scanning && scan && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-slate-300">
                    <span className="font-bold text-white">{scan.entities.length}</span> sensitive items
                  </span>
                  <span className="text-slate-400">
                    <span className="font-semibold text-slate-200">{ruleCount}</span> by rules
                  </span>
                  <span className="font-medium text-violet-300">
                    <span className="font-bold text-violet-200">{gemmaCount}</span> only Gemma understood
                  </span>
                  {textChanged && <span className="text-amber-300">· text changed, scan again</span>}
                </div>
                {!scan.gemma_used && (
                  <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-500/40">
                    Gemma wasn&apos;t available for this scan — showing rule results only. Contextual items may be missed.
                  </p>
                )}
                <div className="max-h-80 overflow-y-auto">
                  <EntityTable entities={scan.entities} />
                </div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="font-semibold text-emerald-400">✓ Processed locally</span>
                  {scan.timings_ms.rules != null && <span>rules {scan.timings_ms.rules} ms</span>}
                  {scan.timings_ms.gemma != null && <span>Gemma {scan.timings_ms.gemma} ms</span>}
                  {scan.timings_ms.total != null && <span>total {scan.timings_ms.total} ms</span>}
                </p>
              </div>
            )}
          </section>
        </div>

        {scan && !scanning && (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-900/60 p-5 ring-1 ring-slate-800">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Original · stays on this device</h3>
              <HighlightedText text={scannedText} entities={scan.entities} mode="original" className="text-[15px] text-slate-200" />
              <p className="mt-3 flex gap-4 text-xs text-slate-500">
                <span>
                  <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-400/60" />
                  Rule
                </span>
                <span>
                  <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-violet-400/80" />
                  Gemma (local AI)
                </span>
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900/60 p-5 ring-1 ring-slate-800">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Sanitized · what can leave</h3>
              <HighlightedText text={scan.sanitized_text} entities={scan.entities} mode="sanitized" className="text-[15px] text-slate-200" />
              <p className="mt-3 flex gap-4 text-xs text-slate-500">
                <span>
                  <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-400/60" />
                  Placeholder (restored later)
                </span>
                <span>
                  <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-rose-400/70" />
                  Redacted (never restored)
                </span>
              </p>
            </div>
          </section>
        )}

        {/* Step 3: ask the cloud */}
        {scan && !scanning && (
          <section className="rounded-2xl bg-slate-900/60 p-5 ring-1 ring-slate-800">
            <StepHeading step={3} title="Ask the cloud safely">
              <span className="text-sm text-slate-500">Only the sanitized text is sent. Answers are restored here.</span>
            </StepHeading>

            {turns.length === 0 && (
              <button
                type="button"
                onClick={() => runAsk()}
                disabled={asking}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {asking ? <Spinner /> : <span aria-hidden>☁</span>}
                {asking ? "Asking the cloud model…" : "Ask Safely"}
              </button>
            )}

            <div className="space-y-8">
              {turns.map((turn, i) => (
                <AskTurn key={i} turn={turn} index={i} entities={scan.entities} />
              ))}
            </div>
            <div ref={turnsEndRef} />

            {askError && (
              <div className="mt-4">
                <ErrorBanner
                  title={askError instanceof ApiError && askError.status === 502 ? "Cloud model error" : "Ask failed"}
                  message={askError.message}
                  action={
                    askError instanceof ApiError && askError.status === 404
                      ? { label: "Scan again", onClick: runScan }
                      : undefined
                  }
                />
              </div>
            )}

            {turns.length > 0 && (
              <form
                className="mt-6 border-t border-slate-800 pt-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (question.trim()) runAsk(question);
                }}
              >
                <label htmlFor="follow-up" className="mb-2 block text-sm font-semibold text-slate-300">
                  Follow up (same session, same placeholders)
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="follow-up"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Try the leak test: What was the API key?"
                    className="min-w-0 flex-1 rounded-lg bg-slate-950 px-3 py-2.5 text-[15px] text-slate-100 ring-1 ring-slate-700 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={asking || !question.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {asking && <Spinner />}
                    {asking ? "Asking…" : "Send"}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {FOLLOW_UPS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuestion(q)}
                      className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </form>
            )}
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-6 pb-8 text-xs text-slate-600">
        Airlock is a local privacy-assistance layer: rules plus a small local model. Detection is not perfect — it reduces
        exposure, it doesn&apos;t guarantee it.
      </footer>
    </div>
  );
}
