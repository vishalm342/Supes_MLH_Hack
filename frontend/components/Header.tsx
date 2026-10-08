import { CheckIcon, LogoMark } from "./Icons";
import { StatusPill, type HealthState } from "./StatusPill";

const STEPS = ["Paste", "Scan locally", "Ask safely"];

function Stepper({ step }: { step: number }) {
  return (
    <ol className="hidden items-center md:flex">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex items-center">
            {i > 0 && <span aria-hidden className={`mx-2 h-px w-8 ${done || current ? "bg-stone-400" : "bg-stone-200"}`} />}
            <span
              className={`flex items-center gap-2 text-[13px] font-medium ${
                current ? "text-stone-900" : done ? "text-stone-600" : "text-stone-400"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                  done || current ? "bg-stone-900 text-white" : "bg-white text-stone-400 ring-1 ring-stone-300"
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

function ModeSwitch({ useMock, onChange, apiUrl }: { useMock: boolean; onChange: (mock: boolean) => void; apiUrl: string }) {
  const base = "rounded-md px-2.5 py-1 text-xs font-medium transition";
  return (
    <div role="group" aria-label="Data source" className="flex rounded-lg bg-stone-100 p-0.5 ring-1 ring-stone-200">
      <button
        type="button"
        onClick={() => onChange(false)}
        title={`Backend at ${apiUrl}`}
        aria-pressed={!useMock}
        className={`${base} ${!useMock ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:text-stone-800"}`}
      >
        Live
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        title="Built-in simulated responses"
        aria-pressed={useMock}
        className={`${base} ${useMock ? "bg-amber-50 text-amber-800 shadow-sm ring-1 ring-amber-300" : "text-stone-500 hover:text-stone-800"}`}
      >
        Mock data
      </button>
    </div>
  );
}

export function Header({
  step,
  health,
  useMock,
  onMockChange,
  apiUrl,
}: {
  step: number;
  health: HealthState;
  useMock: boolean;
  onMockChange: (mock: boolean) => void;
  apiUrl: string;
}) {
  return (
    <header className="z-20 border-b border-stone-200 bg-paper/85 backdrop-blur">
      <div className="flex h-14 items-center gap-6 px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <span className="font-display text-[1.3rem] leading-none tracking-[-0.01em] text-stone-950">Airlock</span>
        </div>

        <div className="mx-auto">
          <Stepper step={step} />
        </div>

        <div className="flex items-center gap-2">
          <StatusPill state={health} />
          <ModeSwitch useMock={useMock} onChange={onMockChange} apiUrl={apiUrl} />
        </div>
      </div>
    </header>
  );
}
