'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { 
  Lock, Save, CheckCircle, ArrowLeft, Loader2, 
  Sparkles, Crown, Shield, Key, Rocket, Zap,
  Fingerprint, Database, Cloud, Globe, Cpu,
  ShieldCheck, Star, Award
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function IntegracaoGPRO() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Efeito de partículas para o fundo
  const particlesRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function loadUserAndToken() {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      setUserId(session.user.id);
      
      const { data: userState, error: fetchError } = await supabase
        .from('user_state')
        .select('gpro_token')
        .eq('user_id', session.user.id)
        .single();
      
      if (userState?.gpro_token) {
        setToken(userState.gpro_token);
        setCharCount(userState.gpro_token.length);
      }
      
      setLoading(false);
    }
    
    loadUserAndToken();
  }, [router]);

  // Efeito de partículas
  useEffect(() => {
    const canvas = particlesRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: { x: number; y: number; vx: number; vy: number; radius: number; opacity: number }[] = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.3 + 0.1,
      });
    }

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251, 191, 36, ${p.opacity})`;
        ctx.fill();
      });

      // Linhas entre partículas próximas
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(251, 191, 36, ${0.05 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const saveToken = async () => {
    if (!userId) return;
    
    setSaving(true);
    setError(null);
    
    const { error: upsertError } = await supabase
      .from('user_state')
      .upsert({ 
        user_id: userId, 
        gpro_token: token 
      });
    
    if (upsertError) {
      setError(upsertError.message);
      setSaving(false);
      return;
    }
    
    setSaved(true);
    setSaving(false);
    setCharCount(token.length);
    
    setTimeout(() => setSaved(false), 4000);
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToken(e.target.value);
    setCharCount(e.target.value.length);
  };

  const getTokenStrength = () => {
    const len = charCount;
    if (len === 0) return { label: 'Aguardando token', color: 'text-slate-400', bar: 'bg-slate-200' };
    if (len < 20) return { label: 'Token curto', color: 'text-amber-500', bar: 'bg-amber-400' };
    if (len < 40) return { label: 'Token médio', color: 'text-emerald-500', bar: 'bg-emerald-400' };
    return { label: 'Token robusto', color: 'text-emerald-600', bar: 'bg-emerald-500' };
  };

  const strength = getTokenStrength();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[#eef2f6] font-mono relative overflow-hidden">
        <canvas ref={particlesRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-amber-500/20 rounded-full animate-spin border-t-amber-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Cpu size={24} className="text-amber-500 animate-pulse" />
            </div>
          </div>
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.3em] animate-pulse">
            Estabelecendo conexão segura...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eef2f6] via-white to-[#eef2f6] font-mono pb-24 relative overflow-hidden">
      
      {/* Canvas de Partículas */}
      <canvas ref={particlesRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      {/* Glows Ambientais */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-amber-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/3 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-6 relative z-10">
        
        {/* Botão voltar com animação */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-slate-500 hover:text-amber-600 transition-all duration-300 mb-6 group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform duration-300 text-slate-400 group-hover:text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-wider group-hover:tracking-[0.3em] transition-all duration-300">
              Voltar ao Dashboard
            </span>
          </Link>
        </motion.div>
        
        {/* Card principal com animação premium */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, type: "spring", damping: 25 }}
          className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-xl hover:shadow-2xl transition-all duration-500 relative overflow-hidden group"
        >
          {/* Brilho Dourado */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl group-hover:opacity-100 opacity-0 transition-opacity duration-1000" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl group-hover:opacity-100 opacity-0 transition-opacity duration-1000" />

          {/* Bordas Glow no hover */}
          <div className="absolute inset-0 rounded-[2rem] border border-transparent group-hover:border-amber-500/20 transition-all duration-500 pointer-events-none" />

          {/* Header com efeito premium */}
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-200/50 relative">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-amber-500/20 rounded-xl blur-xl animate-pulse" />
              <div className="relative p-3 bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-300/30 rounded-xl shadow-lg shadow-amber-500/10">
                <Crown size={22} className="text-amber-500" />
              </div>
            </motion.div>
            
            <div className="flex-1">
              <motion.h1 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-xl font-black uppercase tracking-wider text-slate-900 leading-none flex items-center gap-2"
              >
                Integração GPRO
                <Sparkles size={14} className="text-amber-400" />
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5"
              >
                <ShieldCheck size={10} className="text-emerald-500" />
                Conexão API Segura
              </motion.p>
            </div>

            {/* Status Indicator */}
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-500 ${
                charCount > 0 
                  ? 'bg-emerald-50 border-emerald-300' 
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${charCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">
                {charCount > 0 ? 'Conectado' : 'Aguardando'}
              </span>
            </motion.div>
          </div>
          
          {/* Descrição com ícones */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-start gap-3 mb-6 bg-gradient-to-r from-amber-50/30 to-emerald-50/30 p-4 rounded-xl border border-amber-200/20"
          >
            <Shield size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-600 text-[11px] leading-relaxed font-bold">
                Insira seu token de API do GPRO para importar dados automaticamente.
              </p>
              <p className="text-[9px] text-slate-400 font-bold mt-0.5 flex items-center gap-1">
                <Lock size={10} /> O token será armazenado com segurança e usado apenas para sincronização.
              </p>
            </div>
          </motion.div>
          
          {/* Input do Token com visual premium */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Key size={12} className="text-amber-500" />
                  Token da API GPRO
                </label>
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] font-black uppercase transition-all duration-300 ${strength.color}`}>
                    {strength.label}
                  </span>
                  <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((charCount / 50) * 100, 100)}%` }}
                      className={`h-full ${strength.bar} rounded-full transition-all duration-500`}
                    />
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-emerald-500/5 rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                <input
                  ref={inputRef}
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={handleTokenChange}
                  placeholder="Cole seu token aqui..."
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl p-4 text-sm font-mono text-slate-800 placeholder:text-slate-300 focus:border-amber-400 focus:outline-none transition-all duration-300 shadow-inner hover:shadow-md focus:shadow-lg focus:shadow-amber-500/10 relative z-10"
                  autoFocus
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors z-10 p-1 rounded-lg hover:bg-slate-100"
                >
                  {showToken ? <Lock size={16} /> : <Key size={16} />}
                </button>
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-px bg-gradient-to-r from-amber-500/20 via-transparent to-emerald-500/20" />
                <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest whitespace-nowrap">
                  {charCount > 0 ? `${charCount} caracteres` : 'Aguardando token'}
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/20 via-transparent to-amber-500/20" />
              </div>
            </div>
            
            {/* Mensagem de erro com animação */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-rose-50 border border-rose-200 rounded-xl p-3 overflow-hidden"
                >
                  <p className="text-rose-600 text-xs font-bold flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                    {error}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Botão Salvar com animações */}
            <motion.button
              whileHover={!saving && !saved ? { scale: 1.01 } : {}}
              whileTap={!saving && !saved ? { scale: 0.98 } : {}}
              onClick={saveToken}
              disabled={saving}
              className={`
                flex items-center justify-center gap-2 w-full rounded-xl py-3.5 font-black text-xs uppercase tracking-widest transition-all duration-500 relative overflow-hidden shadow-md
                ${saving 
                  ? 'bg-slate-100 text-slate-400 border border-slate-200/50 cursor-not-allowed' 
                  : saved
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 border border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white border border-amber-400 shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 active:scale-[0.98]'
                }
              `}
            >
              {/* Brilho no hover */}
              {!saving && !saved && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              )}
              
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : saved ? (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <CheckCircle size={18} />
                  </motion.div>
                  <span>Token Salvo com Sucesso!</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Salvar Token</span>
                  <Zap size={12} className="opacity-70" />
                </>
              )}
            </motion.button>
          </div>
          
          {/* Informação adicional com ícones */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6 pt-4 border-t border-slate-200/50"
          >
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center p-2 rounded-xl bg-slate-50/50 border border-slate-200/50">
                <Database size={14} className="text-amber-400 mb-1" />
                <span className="text-[8px] text-slate-500 font-black uppercase text-center">Dados Seguros</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-slate-50/50 border border-slate-200/50">
                <Cloud size={14} className="text-emerald-400 mb-1" />
                <span className="text-[8px] text-slate-500 font-black uppercase text-center">Sincronização</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-xl bg-slate-50/50 border border-slate-200/50">
                <Globe size={14} className="text-indigo-400 mb-1" />
                <span className="text-[8px] text-slate-500 font-black uppercase text-center">API GPRO</span>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 text-center font-bold mt-3 flex items-center justify-center gap-1.5">
              <Rocket size={10} className="text-amber-400" />
              Após salvar o token, volte ao Dashboard e clique em <span className="text-amber-500">GPRO SYNC</span> para importar os dados.
              <Rocket size={10} className="text-amber-400" />
            </p>
          </motion.div>
        </motion.div>

        {/* Badge de Segurança */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6 flex items-center justify-center gap-2"
        >
          <div className="flex items-center gap-1.5 px-4 py-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full shadow-sm">
            <ShieldCheck size={12} className="text-emerald-500" />
            <span className="text-[8px] text-slate-500 font-black uppercase tracking-wider">
              Conexão Criptografada
            </span>
            <span className="w-px h-3 bg-slate-200" />
            <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider">
              SSL Secure
            </span>
            <span className="w-px h-3 bg-slate-200" />
            <Award size={10} className="text-amber-400" />
          </div>
        </motion.div>
      </div>

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}