'use client';
import { Loader2, Zap } from 'lucide-react';

type EmptyStateProps = {
  title: string;
  actionLabel?: string | null;
  href?: string;
  onRetry?: () => void;
  isSyncing?: boolean;
};

export function EmptyState({ title, actionLabel, href, onRetry, isSyncing }: EmptyStateProps) {
  return (
    <div className="py-6 text-center" role="status" aria-live="polite">
      <p className="text-sm font-bold text-zinc-300">{title}</p>
      {actionLabel && (
        <div className="mt-3 flex justify-center">
          {href ? (
            <a
              href={href}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 px-6 text-xs font-black uppercase tracking-widest text-zinc-200 hover:bg-white/[0.10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              {actionLabel}
            </a>
          ) : (
            <button
              onClick={onRetry}
              disabled={isSyncing}
              aria-label={actionLabel}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {isSyncing ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Zap size={12} aria-hidden />}
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
