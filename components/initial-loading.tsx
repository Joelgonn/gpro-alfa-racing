'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

export default function InitialLoading() {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [frame, setFrame] = useState(1);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const startTime = Date.now();
    const log = (msg: string) => {
      const elapsed = Date.now() - startTime;
      console.log(`${msg} +${elapsed}ms`);
    };

    console.log('INITIAL_LOADING_MOUNT +0ms');
    log('FRAME_1');

    let hasHiddenNative = false;
    const hideNativeSplash = async () => {
      if (hasHiddenNative) return;
      hasHiddenNative = true;
      log('NATIVE_SPLASH_HIDE');
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide();
      } catch {}
    };

    // 1. Garantir que o HTML está visível antes de esconder a splash nativa
    // Dois rAF garantem que o primeiro paint do InitialLoading ocorreu
    // Depois 500ms para transição suave nativa (solid #030712) → HTML (mesmo #030712) sem flash preto/branco
    // Não esconder em 0ms (causava tela preta enquanto WebView remoto ainda buscava https://gpro-alfa-racing.vercel.app)
    let nativeDelayTimer: any;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        nativeDelayTimer = window.setTimeout(() => {
          hideNativeSplash();
        }, 500);
        (window as any)._nativeDelayTimer = nativeDelayTimer;
      });
    });

    // 2. Controle central único: 2800ms
    const duration = 2800;
    let raf: any;
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
      if (pct < 100) {
        raf = requestAnimationFrame(tick);
      } else {
        log('PROGRESS_100');
      }
    };
    raf = requestAnimationFrame(tick);

    // 3. Três frames
    let t2: any;
    let t3: any;
    t2 = window.setTimeout(() => {
      setFrame(2);
      log('FRAME_2');
    }, 900);
    t3 = window.setTimeout(() => {
      setFrame(3);
      log('FRAME_3');
    }, 1800);

    // 4. Após 2800ms, completa e esconde com fade 500ms => 3300ms total
    const mainTimer: any = window.setTimeout(() => {
      setProgress(100);
      log('PROGRESS_100');
      const completeTimer = window.setTimeout(() => {
        setIsVisible(false);
        log('INITIAL_LOADING_COMPLETE');
        hideNativeSplash();
      }, 500);
      // @ts-ignore
      (window as any)._completeTimer = completeTimer;
    }, duration);

    // 5. Safety fallback 4000ms (não interfere no fluxo normal)
    const safetyTimer: any = window.setTimeout(() => {
      log('SAFETY_TIMEOUT');
      setProgress(100);
      log('PROGRESS_100');
      setIsVisible(false);
      log('INITIAL_LOADING_COMPLETE');
      hideNativeSplash();
    }, 4000);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(nativeDelayTimer);
      clearTimeout(mainTimer);
      clearTimeout(safetyTimer);
      const ct = (window as any)._completeTimer;
      if (ct) clearTimeout(ct);
      const ndt = (window as any)._nativeDelayTimer;
      if (ndt) clearTimeout(ndt);
    };
  }, []);

  const frameStyle = (f: number) => {
    if (prefersReducedMotion) return {};
    if (f === 1) return { filter: 'brightness(1) contrast(1)', transform: 'scale(1)' } as any;
    if (f === 2) return { filter: 'brightness(1.06) contrast(1.02) drop-shadow(0 0 12px rgba(34,197,94,0.15))', transform: 'scale(1.015)' } as any;
    return { filter: 'brightness(1.12) contrast(1.04) drop-shadow(0 0 18px rgba(34,197,94,0.22))', transform: 'scale(1.03)' } as any;
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.2 : 0.6, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#030712] overflow-hidden"
          aria-label="Carregando GPRO Alfa Racing Brasil"
          role="status"
          aria-live="polite"
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/[0.04] blur-[120px] rounded-full" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-amber-500/[0.03] blur-[120px] rounded-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-blue-500/[0.02] blur-[130px] rounded-full" />
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-[420px] px-6 py-6">
            {/* Diagnóstico visual temporário */}
            <div className="mb-3 flex flex-col items-center gap-1">
              <span className="text-[10px] font-black tracking-[0.2em] text-white bg-white/10 border border-white/20 px-3 py-1 rounded-full">
                LOADING HTML
              </span>
              <span className="text-[10px] font-mono text-white/60">FRAME {frame} / 3 — PROGRESS: {Math.round(progress)}%</span>
            </div>

            <div className="relative w-full flex flex-col items-center">
              {!prefersReducedMotion && (
                <motion.div
                  animate={{ opacity: frame === 3 ? 0.9 : 0.6 }}
                  transition={{ duration: 0.6 }}
                  className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[280px] h-[280px] bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none"
                />
              )}

              <div className="relative w-full aspect-[1214/1295] max-h-[52vh] sm:max-h-[58vh] flex items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={frame}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: 'easeInOut' }}
                    className="absolute inset-0"
                    style={frameStyle(frame)}
                  >
                    <Image
                      src="/splash/splash-gpro-800.webp"
                      alt="GPRO Alfa Racing Brasil - Lobo Alfa"
                      fill
                      priority
                      sizes="(max-width: 420px) 90vw, 420px"
                      className="object-contain object-top drop-shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                    />
                  </motion.div>
                </AnimatePresence>

                {/* Cobertura da barra estática da imagem */}
                <div className="absolute left-0 right-0 bottom-[22%] h-[14%] bg-[#030712] pointer-events-none" aria-hidden="true" />
                <div className="absolute left-0 right-0 bottom-[14%] h-[6%] bg-[#030712] pointer-events-none" />
                <div className="absolute left-0 right-0 bottom-[0%] h-[10%] bg-gradient-to-t from-[#030712] via-[#030712]/80 to-transparent pointer-events-none" />
              </div>

              <div className="flex gap-1.5 mt-3" aria-hidden="true">
                {[1, 2, 3].map((f) => (
                  <span key={f} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${frame === f ? 'bg-white w-4' : 'bg-white/20'}`} />
                ))}
              </div>
            </div>

            {/* Barra HTML real - diagnóstico: fundo branco, preenchimento verde, 12px, 80% */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="relative z-10 w-full mt-5 flex flex-col items-center"
            >
              <div className="relative z-10 h-[12px] w-[80%] max-w-[340px] bg-white border border-white/20 rounded-full overflow-hidden p-[2px] shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                <motion.div
                  className="h-full rounded-full bg-[#22c55e]"
                  style={{ boxShadow: '0 0 12px rgba(34,197,94,0.8)' }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.08, ease: 'linear' }}
                />
              </div>

              <div className="relative z-10 flex flex-col items-center gap-2 mt-4">
                <p className="text-[11px] sm:text-xs font-black tracking-[0.32em] text-white uppercase" style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' }}>
                  CARREGANDO...
                </p>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.28em] text-white/60 uppercase">PAIXÃO QUE MOVE</span>
                  <div className="flex gap-1">
                    <span className="w-8 sm:w-10 h-[3px] rounded-full bg-[#009739]" />
                    <span className="w-8 sm:w-10 h-[3px] rounded-full bg-[#FFCC29]" />
                    <span className="w-8 sm:w-10 h-[3px] rounded-full bg-[#002776]" />
                  </div>
                </div>
              </div>

              <p className="relative z-10 text-[10px] font-mono text-white/40 text-center mt-2 tabular-nums">
                {Math.round(progress)}% — FRAME {frame}
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[8px] font-bold tracking-[0.2em] text-white/20 uppercase whitespace-nowrap"
          >
            <span className="w-1 h-1 rounded-full bg-emerald-500/50" />
            LOBO ALFA • GPRO • BRASIL
            <span className="w-1 h-1 rounded-full bg-amber-500/50" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
