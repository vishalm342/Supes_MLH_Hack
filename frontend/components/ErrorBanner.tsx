export function ErrorBanner({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg bg-rose-950/60 p-4 ring-1 ring-rose-500/50">
      <span aria-hidden className="mt-0.5 text-lg leading-none text-rose-300">
        ⚠
      </span>
      <div className="flex-1">
        <p className="font-semibold text-rose-200">{title}</p>
        <p className="mt-0.5 text-sm text-rose-100/90">{message}</p>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="rounded-md bg-rose-500/20 px-3 py-1.5 text-sm font-medium text-rose-100 ring-1 ring-rose-400/50 hover:bg-rose-500/30"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
