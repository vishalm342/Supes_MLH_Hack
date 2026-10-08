"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/Badges";
import { Composer } from "@/components/Composer";
import { ErrorBanner, type ErrorInfo } from "@/components/ErrorBanner";
import { Header } from "@/components/Header";
import { ArrowLeftIcon, ArrowRightIcon, CloudIcon, RefreshIcon, SendIcon } from "@/components/Icons";
import type { HealthState } from "@/components/StatusPill";
import { Workspace, type Turn } from "@/components/Workspace";
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

function askErrorTitle(err: unknown): string {
  if (errorMessage(err).includes("Refusing to send")) return "Blocked: a secret was about to leave";
  if (err instanceof ApiError && err.status === 502) return "Cloud model error";
  return "Ask failed";
}

export default function Home() {
  const [useMock, setUseMock] = useState(MOCK_BY_DEFAULT);
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  const [view, setView] = useState<"compose" | "workspace">("compose");
  const [text, setText] = useState(SAMPLES[0].text);
  const [scannedText, setScannedText] = useState("");
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<{ message: string; status: number | null } | null>(null);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [asking, setAsking] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string>();
  const [askError, setAskError] = useState<unknown>(null);
  const [question, setQuestion] = useState("");

  const endRef = useRef<HTMLDivElement>(null);
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
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, asking, askError]);

  const runScan = useCallback(async () => {
    const input = text.trim();
    if (!input || scanning) return;
    setView("workspace");
    setScannedText(input);
    setScan(null);
    setScanning(true);
    setScanError(null);
    setAskError(null);
    setTurns([]);
    try {
      setScan(await api.scan(input));
    } catch (err) {
      setScanError({ message: errorMessage(err), status: err instanceof ApiError ? err.status : null });
    } finally {
      setScanning(false);
    }
  }, [api, text, scanning]);

  const runAsk = useCallback(
    async (followUp?: string) => {
      if (!scan || asking) return;
      const q = followUp?.trim() || undefined;
      setAsking(true);
      setPendingQuestion(q);
      setAskError(null);
      if (q) setQuestion("");
      try {
        const answer = await api.ask(q ? { scan_id: scan.scan_id, question: q } : { scan_id: scan.scan_id });
        setTurns((prev) => [...prev, { question: q, answer }]);
      } catch (err) {
        setAskError(err);
        if (q) setQuestion(q);
      } finally {
        setAsking(false);
        setPendingQuestion(undefined);
      }
    },
    [api, scan, asking],
  );

  const backToCompose = () => {
    setView("compose");
    setScan(null);
    setScanError(null);
    setTurns([]);
    setAskError(null);
  };

  const gemmaExpected = health.status !== "ok" || health.health.gemma_loaded;
  const gemmaLoading = health.status === "ok" && health.health.gemma_status === "loading";
  const step = view === "compose" ? 1 : turns.length > 0 ? 3 : 2;

  const scanErrorInfo: ErrorInfo | null = scanError && {
    title: scanError.status === 503 ? "Not ready yet" : "Scan failed",
    message: scanError.message,
    action: { label: "Retry", onClick: runScan },
  };
  const askErrorInfo: ErrorInfo | null = askError
    ? {
        title: askErrorTitle(askError),
        message: errorMessage(askError),
        action:
          askError instanceof ApiError && askError.status === 404 ? { label: "Scan again", onClick: runScan } : undefined,
      }
    : null;

  return (
    <div className="flex h-dvh flex-col">
      <Header step={step} health={health} useMock={useMock} onToggleMock={() => setUseMock((m) => !m)} apiUrl={API_URL} />

      {health.status === "down" && !useMock && (
        <div className="border-b border-rose-900/60 bg-rose-950/40 px-6 py-2">
          <ErrorBanner
            title="Can't reach the Airlock backend"
            message={`${health.error} You can switch to mock data to keep going.`}
            action={{ label: "Use mock data", onClick: () => setUseMock(true) }}
          />
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        {view === "compose" ? (
          <Composer
            text={text}
            onTextChange={setText}
            samples={SAMPLES}
            onScan={runScan}
            scanning={scanning}
            notice={
              gemmaLoading && (
                <p className="rounded-lg bg-sky-500/10 px-4 py-2.5 text-sm text-sky-200 ring-1 ring-sky-500/40">
                  Gemma is still loading on the backend (about a minute after startup). Scans will work once it&apos;s
                  ready.
                </p>
              )
            }
          />
        ) : (
          <>
            <Workspace
              text={scannedText}
              scan={scan}
              scanning={scanning}
              scanSeconds={scanSeconds}
              gemmaExpected={gemmaExpected}
              scanError={scanErrorInfo}
              turns={turns}
              asking={asking}
              pendingQuestion={pendingQuestion}
              askError={askErrorInfo}
            />
            <div ref={endRef} />
          </>
        )}
      </main>

      {view === "workspace" && (
        <footer className="border-t border-slate-800 bg-[#07090f]/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 px-6 py-3">
            <button
              type="button"
              onClick={backToCompose}
              disabled={scanning || asking}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 ring-1 ring-slate-700 transition hover:bg-slate-800 disabled:opacity-40"
            >
              {turns.length > 0 ? <RefreshIcon /> : <ArrowLeftIcon />}
              {turns.length > 0 ? "New scan" : "Edit text"}
            </button>

            {scanning && (
              <p className="flex items-center gap-2 text-sm text-violet-200">
                <Spinner className="h-3.5 w-3.5" /> Scanning locally — nothing leaves this device.
              </p>
            )}

            {scan && turns.length === 0 && (
              <>
                <p className="ml-auto hidden text-sm text-slate-400 md:block">
                  Only the <span className="font-semibold text-sky-300">right-hand lane</span> will be sent.
                </p>
                <button
                  type="button"
                  onClick={() => runAsk()}
                  disabled={asking}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-base font-bold text-white shadow-lg shadow-emerald-900/50 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 max-md:ml-auto"
                >
                  {asking ? <Spinner /> : <CloudIcon className="h-5 w-5" />}
                  {asking ? "Asking the cloud…" : "Ask the cloud safely"}
                  {!asking && <ArrowRightIcon />}
                </button>
              </>
            )}

            {scan && turns.length > 0 && (
              <form
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (question.trim()) runAsk(question);
                }}
              >
                {FOLLOW_UPS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => runAsk(q)}
                    disabled={asking}
                    className="rounded-full bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a follow-up — same placeholders, same session"
                  aria-label="Follow-up question"
                  className="min-w-56 flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-[15px] text-slate-100 ring-1 ring-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={asking || !question.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {asking ? <Spinner /> : <SendIcon />}
                  Send
                </button>
              </form>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
