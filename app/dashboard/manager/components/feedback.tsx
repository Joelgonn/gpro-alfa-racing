'use client';

// ALFA-015.1 — Feedback visual da área Manager (substitui alert()/confirm() nativos).
//
// Por que existe: no WebView do APK (Capacitor) os diálogos nativos aparecem com o título
// "localhost" e bloqueiam a thread de renderização. Aqui o feedback é DOM puro (ARIA + focus).
//
// Visual: imita o padrão já usado em app/dashboard/manual e app/dashboard/sponsors
// (barra colorida no topo, título uppercase, botões arredondados) — sem criar linguagem nova.
// Acessibilidade que o padrão antigo NÃO tinha: role=dialog, aria-modal, foco inicial,
// focus trap, Esc e restauração de foco.
//
// Sem dependências novas: usa apenas react + framer-motion + lucide-react (já instalados).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

type ToastItem = { id: number; kind: ToastKind; title: string; message?: string };

type ToastContextValue = {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Duração do auto-dismiss. `error` é intencionalmente persistente. */
const TOAST_TIMEOUT_MS: Record<ToastKind, number | null> = {
  success: 4000,
  warning: 6000,
  info: 5000,
  error: null,
};

const TOAST_STYLE: Record<ToastKind, { bar: string; icon: ReactNode; role: 'status' | 'alert' }> = {
  success: { bar: 'bg-gradient-to-r from-emerald-500 to-emerald-600', icon: <CheckCircle2 size={14} className="text-emerald-500" aria-hidden />, role: 'status' },
  error: { bar: 'bg-gradient-to-r from-rose-500 to-rose-600', icon: <AlertTriangle size={14} className="text-rose-500" aria-hidden />, role: 'alert' },
  warning: { bar: 'bg-gradient-to-r from-amber-500 to-amber-600', icon: <AlertTriangle size={14} className="text-amber-500" aria-hidden />, role: 'status' },
  info: { bar: 'bg-gradient-to-r from-emerald-500 to-amber-500', icon: <Info size={14} className="text-emerald-500" aria-hidden />, role: 'status' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, title: string, message?: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, kind, title, message }]);
    const timeout = TOAST_TIMEOUT_MS[kind];
    if (timeout) {
      timers.current.set(id, setTimeout(() => dismiss(id), timeout));
    }
  }, [dismiss]);

  // Limpa timers pendentes ao desmontar (evita setState em componente desmontado)
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  // Esc fecha o toast mais recente (não bloqueia a página como o alert() nativo)
  useEffect(() => {
    if (toasts.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss(toasts[toasts.length - 1].id);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toasts, dismiss]);

  const value = useMemo<ToastContextValue>(() => ({
    success: (t, m) => push('success', t, m),
    error: (t, m) => push('error', t, m),
    warning: (t, m) => push('warning', t, m),
    info: (t, m) => push('info', t, m),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Região viva única: leitores de tela anunciam aqui. Não intercepta cliques. */}
      <div
        className="fixed bottom-4 right-4 z-[120] flex w-[calc(100vw-2rem)] max-w-xs flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const style = TOAST_STYLE[toast.kind];
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                role={style.role}
                className="pointer-events-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              >
                <div className={`h-1 w-full ${style.bar}`} />
                <div className="flex items-start gap-2 p-4">
                  <span className="mt-0.5 shrink-0">{style.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-800">{toast.title}</p>
                    {toast.message && (
                      <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500 break-words">{toast.message}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    aria-label="Fechar aviso"
                    className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    <X size={14} aria-hidden />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/** Feedback não bloqueante. Lança se usado fora do ToastProvider (erro de programação, não de runtime do usuário). */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return ctx;
}

// ---------------------------------------------------------------------------
// FeedbackDialog — confirmação acessível (substituto do confirm() nativo)
// ---------------------------------------------------------------------------

export type FeedbackDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  /** 'alert' = apenas ciência · 'confirm' = confirmação de rotina · 'destructive' = ação irreversível */
  type?: 'alert' | 'confirm' | 'destructive';
  /** Label explícito do botão de confirmação — nunca usar "OK" genérico */
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
};

/**
 * Diálogo modal acessível.
 * - role=dialog + aria-modal + aria-labelledby/aria-describedby
 * - foco inicial no botão de confirmação; Tab preso dentro do diálogo
 * - Esc fecha; Cancelar sempre presente; foco restaurado ao fechar
 * - 'destructive' exige confirmação explícita e bloquear o backdrop NÃO fecha (evita perda acidental)
 */
export function FeedbackDialog({
  isOpen,
  onClose,
  title,
  message,
  type = 'confirm',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
}: FeedbackDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Foco inicial + restauração
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    return () => { previouslyFocused.current?.focus?.(); };
  }, [isOpen]);

  // Esc + focus trap
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const isDestructive = type === 'destructive';
  const bar = isDestructive
    ? 'bg-gradient-to-r from-rose-500 to-rose-600'
    : type === 'confirm'
      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
      : 'bg-gradient-to-r from-amber-500 to-amber-600';
  const icon = isDestructive
    ? <AlertTriangle size={14} className="text-rose-500" aria-hidden />
    : type === 'confirm'
      ? <CheckCircle2 size={14} className="text-emerald-500" aria-hidden />
      : <Info size={14} className="text-amber-500" aria-hidden />;
  const titleId = 'alfa-feedback-dialog-title';
  const messageId = 'alfa-feedback-dialog-message';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={isDestructive ? undefined : onClose}
          />
          <motion.div
            ref={dialogRef}
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            className="relative z-10 w-full max-w-xs overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className={`h-1 w-full ${bar}`} />
            <div className="bg-white p-5 text-left">
              <h3 id={titleId} className="mb-2 flex items-center gap-1.5 text-sm font-black uppercase text-slate-800">
                {icon}
                {title}
              </h3>
              <p id={messageId} className="mb-6 text-[11px] font-bold leading-relaxed text-slate-500">{message}</p>
              <div className="flex gap-2">
                {type === 'alert' ? (
                  <button
                    ref={confirmRef}
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-xl bg-slate-100 py-2.5 text-[9px] font-black uppercase text-slate-700 shadow-sm transition-all duration-300 hover:bg-slate-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    Entendido
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 rounded-xl bg-slate-100 py-2.5 text-[9px] font-black uppercase text-slate-700 shadow-sm transition-all duration-300 hover:bg-slate-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      {cancelLabel}
                    </button>
                    <button
                      ref={confirmRef}
                      type="button"
                      onClick={() => { onConfirm?.(); onClose(); }}
                      className={`flex-1 rounded-xl py-2.5 text-[9px] font-black uppercase tracking-widest text-white shadow-md transition-all duration-300 hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 ${
                        isDestructive
                          ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 focus-visible:ring-rose-400'
                          : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 focus-visible:ring-emerald-400'
                      }`}
                    >
                      {confirmLabel}
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
