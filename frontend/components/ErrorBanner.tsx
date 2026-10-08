import { AlertIcon } from "./Icons";

export interface ErrorInfo {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

const ACTION =
  "shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-red-800 shadow-sm ring-1 ring-red-200 transition hover:bg-red-100";

// `inline` is the slim one-line strip used under the header; the default is a stacked card.
export function ErrorBanner({ title, message, action, inline = false }: ErrorInfo & { inline?: boolean }) {
  if (inline) {
    return (
      <div role="alert" className="flex items-center gap-3 text-sm">
        <AlertIcon className="h-4.5 w-4.5 shrink-0 text-red-600" />
        <p className="min-w-0 flex-1 truncate text-red-800">
          <span className="font-semibold text-red-900">{title}.</span> {message}
        </p>
        {action && (
          <button type="button" onClick={action.onClick} className={ACTION}>
            {action.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div role="alert" className="rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
      <div className="flex items-start gap-3">
        <AlertIcon className="mt-px h-5 w-5 shrink-0 text-red-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-900">{title}</p>
          <p className="mt-0.5 break-words text-sm text-red-800/90">{message}</p>
          {action && (
            <button type="button" onClick={action.onClick} className={`mt-3 ${ACTION}`}>
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
