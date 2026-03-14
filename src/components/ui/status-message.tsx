import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export function ErrorMessage({
  message,
  compact = false,
  mono = false,
  onDismiss,
}: {
  message: string;
  compact?: boolean;
  mono?: boolean;
  onDismiss?: () => void;
}) {
  if (compact) {
    return (
      <div className="flex items-start gap-1.5 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive leading-tight">
        <AlertCircle size={11} className="shrink-0 mt-px" />
        <span className="break-all flex-1">{message}</span>
        {onDismiss && (
          <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
            <X size={10} />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
      <AlertCircle size={15} className="shrink-0 mt-0.5" />
      <span className={`flex-1 ${mono ? 'font-mono break-all' : 'wrap-break-word'}`}>
        {message}
      </span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity mt-0.5">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export function SuccessMessage({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2.5 text-sm text-green-700 dark:text-green-500">
      <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity mt-0.5">
          <X size={13} />
        </button>
      )}
    </div>
  );
}
