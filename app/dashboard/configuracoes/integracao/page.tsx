'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { Lock, Save, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function IntegracaoGPRO() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserAndToken() {
      setLoading(true);
      
      // 1. Verificar sessão
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      setUserId(session.user.id);
      
      // 2. Buscar token existente
      const { data: userState, error: fetchError } = await supabase
        .from('user_state')
        .select('gpro_token')
        .eq('user_id', session.user.id)
        .single();
      
      if (userState?.gpro_token) {
        setToken(userState.gpro_token);
      }
      
      setLoading(false);
    }
    
    loadUserAndToken();
  }, [router]);

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
    
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      {/* Botão voltar */}
      <Link 
        href="/dashboard" 
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
        <span className="text-xs font-black uppercase tracking-wider">Voltar ao Dashboard</span>
      </Link>
      
      {/* Card principal */}
      <div className="bg-gray-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
          <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <Lock className="text-yellow-400" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-wider text-white">
              Integração GPRO
            </h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
              Configuração da API
            </p>
          </div>
        </div>
        
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          Insira seu token de API do GPRO para importar dados automaticamente. 
          O token será armazenado com segurança e usado apenas para sincronização.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">
              Token da API GPRO
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole seu token aqui..."
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm font-mono text-white placeholder:text-slate-600 focus:border-yellow-500 focus:outline-none transition-colors"
            />
            <p className="text-[9px] text-slate-600 mt-2 font-mono">
              Seu token nunca é compartilhado. Você pode gerar um novo a qualquer momento no painel do GPRO.
            </p>
          </div>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-xs font-mono">{error}</p>
            </div>
          )}
          
          <button
            onClick={saveToken}
            disabled={saving}
            className={`
              flex items-center justify-center gap-2 w-full rounded-lg py-3 font-bold text-sm transition-all
              ${saving 
                ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed' 
                : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 active:scale-[0.98]'
              }
            `}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                Salvando...
              </>
            ) : saved ? (
              <>
                <CheckCircle size={16} />
                Token Salvo!
              </>
            ) : (
              <>
                <Save size={16} />
                Salvar Token
              </>
            )}
          </button>
        </div>
        
        {/* Informação adicional */}
        <div className="mt-6 pt-4 border-t border-white/5">
          <p className="text-[10px] text-slate-600 text-center font-mono">
            Após salvar o token, volte ao Dashboard e clique em 🔄 GPRO para importar os dados.
          </p>
        </div>
      </div>
    </div>
  );
}