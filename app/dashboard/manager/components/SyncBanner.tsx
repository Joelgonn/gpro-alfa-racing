'use client';
import { Loader2, Zap, Settings } from 'lucide-react';

type SyncBannerProps = {
  isSyncing: boolean;
  syncStatus: 'idle' | 'loading' | 'success' | 'error';
  syncError: string | null;
  onSync: () => void;
  hasData: boolean;
};

export function SyncBanner({ isSyncing, syncStatus, syncError, onSync, hasData }: SyncBannerProps) {
  const isBothMissing = !hasData;
  if (!isBothMissing && syncStatus !== 'error' && !isSyncing) return null;
  // Só mostra quando ambos ausentes ou erro
  if (!isBothMissing && syncStatus !== 'error') return null;

  const title =
    syncStatus === 'error' && syncError
      ? syncError
      : isSyncing
        ? 'Sincronizando dados da GPRO...'
        : 'Este módulo ainda não recebeu dados da GPRO. Configure sua integração e sincronize.';

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-center" role="status" aria-live="polite">
      <p className="text-sm font-bold text-amber-200">{title}</p>
      <div className="mt-3 flex flex-col sm:flex-row gap-2 justify-center">
        <button
          onClick={onSync}
          disabled={isSyncing}
          aria-label="Sincronizar dados da GPRO"
          aria-busy={isSyncing}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {isSyncing ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Zap size={14} aria-hidden />}
          {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
        </button>
        <a
          href="/dashboard/configuracoes/integracao"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.06] border border-white/10 px-6 text-xs font-black uppercase tracking-widest text-zinc-200 hover:bg-white/[0.10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
          <Settings size={14} aria-hidden />
          Configurar Integração
        </a>
      </div>
      {hasData === false && <p className="mt-2 text-xs font-bold text-amber-300/80">Algumas informações estão disponíveis. Tente atualizar os módulos pendentes.</p>}
    </div>
  );
}
