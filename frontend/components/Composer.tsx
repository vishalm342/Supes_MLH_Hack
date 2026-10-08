import { Spinner } from "./Badges";
import { BracketsIcon, CloudIcon, LockIcon, ShieldCheckIcon } from "./Icons";
import type { Sample } from "@/lib/samples";

const HOW_IT_WORKS = [
  {
    icon: ShieldCheckIcon,
    title: "Scanned on this device",
    body: "Rules catch keys and emails. Gemma 4 runs locally and catches what only context reveals.",
  },
  {
    icon: BracketsIcon,
    title: "Only placeholders leave",
    body: "Priya becomes [PERSON_1], so the cloud model can still reason about the request.",
  },
  {
    icon: CloudIcon,
    title: "Answers restored here",
    body: "Real names are restored on your machine. Secrets never are.",
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
    <div className="mx-auto w-full max-w-[56rem] px-6 pb-10 pt-11">
      <h1 className="font-display text-[2.85rem] leading-[1.05] tracking-[-0.025em] text-stone-950">
        Use the cloud&apos;s intelligence.
        <br />
        <span className="text-stone-400">Keep your private data here.</span>
      </h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-stone-500">
        Paste what you&apos;d normally send to a cloud AI. Airlock finds the private parts on this device, and only
        placeholders ever leave it.
      </p>

      {notice && <div className="mt-5">{notice}</div>}

      <div className="mt-7 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(12,10,9,0.05),0_12px_32px_-16px_rgba(12,10,9,0.18)] ring-1 ring-stone-200 transition focus-within:ring-stone-400">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5 text-xs text-stone-500">
          <span className="flex items-center gap-1.5 font-medium">
            <LockIcon className="h-3.5 w-3.5" />
            Private text · stays on this device
          </span>
          <span className="tabular-nums text-stone-400">{text.length.toLocaleString()} characters</span>
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
          className="block h-40 w-full resize-none bg-transparent px-4 py-3.5 text-base leading-relaxed text-stone-900 placeholder:text-stone-400 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 bg-stone-50/70 px-3 py-2.5">
          <span className="px-1 text-xs text-stone-400">Samples</span>
          {samples.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onTextChange(s.text)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                text === s.text
                  ? "bg-stone-900 text-white ring-stone-900"
                  : "bg-white text-stone-600 ring-stone-200 hover:text-stone-900 hover:ring-stone-300"
              }`}
            >
              {s.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <kbd className="hidden rounded-md bg-white px-1.5 py-0.5 font-sans text-[11px] text-stone-500 shadow-sm ring-1 ring-stone-200 sm:inline">
              Ctrl ↵
            </kbd>
            <button
              type="button"
              onClick={onScan}
              disabled={!text.trim() || scanning}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {scanning ? <Spinner /> : <ShieldCheckIcon className="h-4.5 w-4.5" />}
              Scan locally
            </button>
          </div>
        </div>
      </div>

      <ol className="mt-9 grid gap-6 border-t border-stone-200 pt-6 sm:grid-cols-3">
        {HOW_IT_WORKS.map(({ icon: Icon, title, body }, i) => (
          <li key={title}>
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-stone-700 shadow-sm ring-1 ring-stone-200">
                <Icon className="h-4 w-4" />
              </span>
              <span className="font-mono text-[11px] text-stone-400">0{i + 1}</span>
              <span className="text-sm font-semibold text-stone-900">{title}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">{body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-7 text-xs text-stone-400">
        Airlock is a local privacy-assistance layer: rules plus a small local model. Detection is not perfect — it
        reduces exposure, it doesn&apos;t guarantee it.
      </p>
    </div>
  );
}
