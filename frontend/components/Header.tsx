import { CheckIcon, ShieldIcon } from "./Icons";
import { StatusPill, type HealthState } from "./StatusPill";

const STEPS = ["Paste", "Scan locally", "Ask safely"];

function Stepper({ step }: { step: number }) {
  return (
    <ol className="hidden items-center gap-1 md:flex">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className={`h-px w-6 ${done || current ? "bg-violet-400/60" : "bg-slate-700"}`} />}
            <span
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition ${
                current
                  ? "bg-violet-500/20 text-violet-100 ring-1 ring-violet-400/60"
                  : done
                    ? "text-violet-300"
                    : "text-slate-500"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  done ? "bg-violet-500 text-white" : current ? "bg-violet-400 text-slate-950" : "bg-slate-800 text-slate-400"
                }`}
              >
                {done ? <CheckIcon className="h-3 w-3" /> : n}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Header({
  step,
  health,
  useMock,
  onToggleMock,
  apiUrl,
}: {
  step: number;
  health: HealthState;
  useMock: boolean;
  onToggleMock: () => void;
  apiUrl: string;
}) {
  return (
    <header className="z-20 border-b border-slate-800/80 bg-[#07090f]/85 backdrop-blur">
      <div className="flex h-14 items-center gap-6 px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-900/50">
            <ShieldIcon className="h-4.5 w-4.5 text-white" />
          </span>
          <span className="text-xl font-black tracking-tight text-white">Airlock</span>
          <span className="hidden text-sm text-slate-500 2xl:inline">Your data stays here. Only placeholders leave.</span>
        </div>

        <div className="mx-auto">
          <Stepper step={step} />
        </div>

        <div className="flex items-center gap-2">
          <StatusPill state={health} />
          <button
            type="button"
            onClick={onToggleMock}
            title={useMock ? "Using built-in mock responses — click for the live API" : `Using backend at ${apiUrl} — click for mock data`}
            className={`rounded-full px-3 py-1 text-xs font-bold tracking-wide ring-1 transition ${
              useMock
                ? "bg-fuchsia-500/20 text-fuchsia-200 ring-fuchsia-400/70"
                : "bg-slate-900 text-slate-400 ring-slate-700 hover:text-slate-200"
            }`}
          >
            {useMock ? "MOCK DATA" : "Live API"}
          </button>
        </div>
      </div>
    </header>
  );
}
