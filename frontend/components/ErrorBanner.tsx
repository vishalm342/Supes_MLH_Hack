export interface ErrorInfo {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export function ErrorBanner({ title, message, action }: ErrorInfo) {
  return (
    <div role="alert" className="rounded-xl bg-rose-950/70 p-4 ring-1 ring-rose-500/50">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-lg leading-none text-rose-300">
          ⚠
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-rose-100">{title}</p>
          <p className="mt-0.5 break-words text-sm text-rose-100/85">{message}</p>
        </div>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-3 rounded-lg bg-rose-500/20 px-3 py-1.5 text-sm font-semibold text-rose-100 ring-1 ring-rose-400/50 hover:bg-rose-500/30"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
