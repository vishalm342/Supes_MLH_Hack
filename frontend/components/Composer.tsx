import { CloudIcon, LockIcon, ShieldCheckIcon, SparkleIcon } from "./Icons";
import { Spinner } from "./Badges";
import type { Sample } from "@/lib/samples";

const HOW_IT_WORKS = [
  {
    icon: ShieldCheckIcon,
    title: "Scanned on this device",
    body: "Rules catch keys and emails. Gemma 4 runs locally and catches the context.",
    tone: "text-violet-300",
  },
  {
    icon: CloudIcon,
    title: "Only placeholders leave",
    body: "Priya becomes [PERSON_1]. The cloud model still has enough to reason.",
    tone: "text-sky-300",
  },
  {
    icon: SparkleIcon,
    title: "Answer restored here",
    body: "Real names come back on your machine. Secrets never do.",
    tone: "text-emerald-300",
  },
];

export function Composer({
  text,
  onTextChange,
  samples,
  onScan,
  scanning,
  notice,
}: {
  text: string;
  onTextChange: (text: string) => void;
  samples: Sample[];
  onScan: () => void;
  scanning: boolean;
  notice?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-[2.6rem] font-black leading-tight tracking-tight text-white">
        Use the cloud&apos;s brain.
        <br />
        <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
          Keep your secrets here.
        </span>
      </h1>
      <p className="mt-2 max-w-2xl text-lg text-slate-400">
        Paste what you&apos;d normally send to a cloud AI. Airlock finds the private parts on this device and only
        placeholders ever leave.
      </p>

      {notice && <div className="mt-5">{notice}</div>}

      <div className="mt-6 overflow-hidden rounded-2xl bg-slate-900/80 shadow-2xl shadow-black/40 ring-1 ring-slate-700/80 transition focus-within:ring-2 focus-within:ring-violet-500/80">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-violet-300">
          <LockIcon className="h-3.5 w-3.5" />
          Private text · stays on this device
        </div>
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onScan();
          }}
          spellCheck={false}
          autoFocus
          placeholder="Paste anything you'd normally send to a cloud AI…"
          className="block h-44 w-full resize-none bg-transparent px-4 py-3 text-base leading-relaxed text-slate-100 placeholder:text-slate-600 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 bg-slate-950/40 px-3 py-2.5">
          <span className="px-1 text-xs font-medium text-slate-500">Try:</span>
          {samples.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onTextChange(s.text)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                text === s.text
                  ? "bg-violet-500/25 text-violet-100 ring-violet-400/70"
                  : "bg-slate-800/80 text-slate-300 ring-slate-700 hover:bg-slate-700"
              }`}
            >
              {s.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">Ctrl+Enter</span>
            <button
              type="button"
              onClick={onScan}
              disabled={!text.trim() || scanning}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-violet-900/50 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {scanning ? <Spinner /> : <ShieldCheckIcon className="h-4.5 w-4.5" />}
              Scan locally
            </button>
          </div>
        </div>
      </div>

      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {HOW_IT_WORKS.map(({ icon: Icon, title, body, tone }, i) => (
          <li key={title} className="rounded-xl bg-slate-900/40 p-4 ring-1 ring-slate-800">
            <div className={`flex items-center gap-2 text-sm font-semibold ${tone}`}>
              <Icon className="h-4.5 w-4.5" />
              <span className="text-slate-500">{i + 1}.</span> {title}
            </div>
            <p className="mt-1.5 text-sm leading-snug text-slate-400">{body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-xs text-slate-600">
        Airlock is a local privacy-assistance layer: rules plus a small local model. Detection is not perfect — it
        reduces exposure, it doesn&apos;t guarantee it.
      </p>
    </div>
  );
}
