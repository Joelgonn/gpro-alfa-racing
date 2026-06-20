'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useGame } from '@/app/context/GameContext';
import he from 'he';
import {
  User, Trophy, Coins, Cpu, CheckCircle2, XCircle, AlertCircle, 
  Loader2, Sparkles, Activity, ShieldAlert, Zap, Globe, 
  Camera, Gauge, Layers
} from 'lucide-react';

interface ManagerData {
  source?: string;
  lastSyncAt?: string;
  manager: {
    id: number;
    firstName: string;
    lastName: string;
    country: string;
    group: string;
    groupShort: string;
    cash: number;
    credits: number;
    teamId: number | null;
    teamCredits: number;
    champs: number;
    accStatus: string;
    apiRequestsRemaining: number;
    driverId: number | null;
  };
  driver: {
    id: number;
    name: string;
    energy: number;
    concentration: number;
    talent: number;
    aggressiveness: number;
    experience: number;
    technique: number;
    stamina: number;
    charisma: number;
    motivation: number;
    reputation: number;
    weight: number;
    age: number;
    overall: number;
    salary: string;
    racesLeft: string;
  } | null;
  car: Array<{
    name: string;
    lvl: number;
    wear: number;
  }>;
  race: {
    season: string;
    race: string;
    track: string;
    trackId: string;
    points: string;
    position: string;
    average: string;
    champs: string;
    qual1Pos: string;
    qual2Pos: string;
    donePractice: string;
    doneQ1: string;
    doneQ2: string;
  };
  weather: any;
  testPoints: any;
}

export default function ManagerPage() {
  const { isGlobalLoading } = useGame();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [managerData, setManagerData] = useState<ManagerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function getUserId() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserId(session.user.id);
          setAvatarUrl(session.user.user_metadata?.avatar_url || null);
        }
      } catch (error) {
        console.error('Erro ao obter userId:', error);
      }
    }
    getUserId();
  }, []);

  async function loadManagerData(forceRefresh: boolean = false) {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsRefreshing(forceRefresh);
    if (!forceRefresh) setIsLoading(true);

    try {
      const url = forceRefresh 
        ? `/api/manager/profile?refresh=true` 
        : '/api/manager/profile';
      
      const response = await fetch(url, {
        headers: {
          'user-id': userId,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar dados');
      }

      const data = await response.json();
      setManagerData(data);
      setError(null);
    } catch (error: any) {
      console.error('Erro:', error);
      setError(error.message || 'Erro ao carregar dados do gerente');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadManagerData();
  }, [userId]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Selecione uma imagem de até 3MB.');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/profile-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateAuthError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateAuthError) throw updateAuthError;

      await supabase
        .from('user_state')
        .update({ avatar_url: publicUrl })
        .eq('user_id', userId);

      setAvatarUrl(publicUrl);
    } catch (err: any) {
      console.error('Erro ao enviar imagem:', err);
      alert('Erro ao carregar imagem: ' + (err.message || err));
    } finally {
      setIsUploading(false);
    }
  };

  const formatCash = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  // Função para decodificar HTML entities usando a biblioteca 'he'
  const decodeText = (text: string | null | undefined): string => {
    if (!text) return '';
    return he.decode(text);
  };

  if (isLoading || isGlobalLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] bg-[#020204] text-slate-400 p-6">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-16 h-16 border-2 border-cyan-500/10 rounded-full absolute"></div>
          <div className="w-16 h-16 border-2 border-t-cyan-400 rounded-full animate-spin"></div>
          <Sparkles className="text-cyan-400 absolute animate-pulse" size={20} />
        </div>
        <p className="font-mono text-[10px] tracking-[0.3em] text-cyan-400/80 uppercase animate-pulse">Carregando dados...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] bg-[#020204] p-4">
        <div className="text-center max-w-md bg-zinc-950/40 border border-rose-500/20 p-6 sm:p-8 rounded-2xl">
          <div className="text-rose-500 mb-4 flex justify-center">
            <span className="p-3 bg-rose-500/10 rounded-full border border-rose-500/20">
              <AlertCircle size={32} />
            </span>
          </div>
          <h2 className="text-lg font-black text-white uppercase tracking-tight mb-2">Erro ao carregar</h2>
          <p className="text-slate-400 text-xs sm:text-sm mb-6">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => loadManagerData(true)}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs tracking-wider uppercase"
            >
              🔄 Tentar novamente
            </button>
            <a
              href="/dashboard/configuracoes/integracao"
              className="bg-zinc-900 hover:bg-zinc-800 text-slate-300 font-bold px-5 py-2.5 rounded-xl text-xs tracking-wider uppercase border border-white/5"
            >
              ⚙️ Integração
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!managerData) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] bg-[#020204] p-4">
        <div className="text-center max-w-md bg-zinc-950/40 border border-cyan-500/20 p-6 sm:p-8 rounded-2xl">
          <div className="text-cyan-400 mb-4 flex justify-center">
            <span className="p-3 bg-cyan-500/10 rounded-full border border-cyan-500/20 animate-pulse">
              <Activity size={32} />
            </span>
          </div>
          <h2 className="text-lg font-black text-white uppercase tracking-tight mb-2">Configure sua integração</h2>
          <p className="text-slate-400 text-xs sm:text-sm mb-6">Conecte sua chave GPRO para carregar os dados.</p>
          <a
            href="/dashboard/configuracoes/integracao"
            className="inline-flex bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-6 py-3 rounded-xl text-xs tracking-wider uppercase"
          >
            ⚙️ Configurar
          </a>
        </div>
      </div>
    );
  }

  const { manager, driver, car, race, source } = managerData;

  // Decodificar nomes do gerente
  const decodedFirstName = decodeText(manager.firstName);
  const decodedLastName = decodeText(manager.lastName);
  const decodedDriverName = decodeText(driver?.name);

  const energy = driver?.energy ?? 0;
  const energiaStatus = energy >= 80 ? "Boa" : energy >= 50 ? "Média" : "Baixa";
  const energiaColor = energy >= 80 ? "text-emerald-400" : energy >= 50 ? "text-amber-400" : "text-rose-500";

  const totalParts = car?.length || 0;
  const avgWear = totalParts > 0 
    ? car.reduce((acc, part) => acc + part.wear, 0) / totalParts 
    : 0;
  const carHealth = Math.round(100 - avgWear);
  const carStatus = carHealth >= 80 ? "Bom" : carHealth >= 50 ? "Regular" : "Crítico";
  const carColor = carHealth >= 80 ? "text-emerald-400" : carHealth >= 50 ? "text-amber-400" : "text-rose-500";

  const isQ1Done = race?.doneQ1 === '1';
  const isQ2Done = race?.doneQ2 === '1';
  const qualyStatus = (isQ1Done && isQ2Done) ? "✅ Completa" : (isQ1Done || isQ2Done) ? "⏳ Parcial" : "❌ Pendente";
  const qualyColor = (isQ1Done && isQ2Done) ? "text-emerald-400" : (isQ1Done || isQ2Done) ? "text-amber-400" : "text-slate-500";

  const practiceDone = race?.donePractice === '1';
  const prepStatus = practiceDone ? "✅ Feito" : "❌ Pendente";
  const prepColor = practiceDone ? "text-emerald-400" : "text-amber-400";

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 pb-24 md:pb-12">

      {/* Input oculto para foto */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleAvatarUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* ==========================================
          HEADER
          ========================================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <span className="inline-flex text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-0.5 rounded font-black tracking-widest uppercase">
            👨‍✈️ Gerente
          </span>
          <div className="flex items-center gap-2 mt-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${source === 'gpro-fallback' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${source === 'gpro-fallback' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {source === 'gpro-fallback' ? 'Dados ao vivo da GPRO' : 'Dados sincronizados'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center w-full sm:w-auto gap-2.5">
          <span className="text-[9px] px-3 py-2 bg-zinc-900 text-slate-400 border border-white/5 rounded-lg font-black uppercase text-center flex-1 sm:flex-initial">
            Status: <span className="text-green-400">{manager.accStatus || 'Ativo'}</span>
          </span>
          <button
            onClick={() => loadManagerData(true)}
            disabled={isRefreshing}
            className="text-[9px] bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-4 py-2.5 rounded-lg uppercase tracking-wider transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 flex-1 sm:flex-initial"
          >
            {isRefreshing ? <Loader2 size={11} className="animate-spin" /> : null}
            {isRefreshing ? 'Atualizando...' : '🔄 Atualizar'}
          </button>
        </div>
      </div>

      {/* ==========================================
          PERFIL DO GERENTE (COM TOOLTIP NO AVATAR)
          ========================================== */}
      <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-white/10 rounded-2xl p-5 sm:p-6 relative">
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none z-0">
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-10"></div>
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          <div className="lg:col-span-6 flex flex-col sm:flex-row gap-4 items-center text-center sm:text-left">
            
            {/* Contêiner de Avatar com Tooltip */}
            <div className="relative group/avatar-box shrink-0 z-30">
              <button
                onClick={() => !isUploading && fileInputRef.current?.click()}
                disabled={isUploading}
                className="relative w-16 h-16 rounded-xl bg-black border-2 border-cyan-500/30 flex items-center justify-center text-2xl font-black text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)] overflow-hidden transition-all active:scale-95 group/button"
                title="Trocar foto"
              >
                {isUploading ? (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
                    <Loader2 className="animate-spin text-cyan-400" size={18} />
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/75 opacity-0 group-hover/button:opacity-100 flex flex-col items-center justify-center transition-opacity duration-300 z-10 text-[8px] text-cyan-400 font-bold gap-1">
                    <Camera size={14} />
                    <span>FOTO</span>
                  </div>
                )}

                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={`Foto de ${decodedFirstName} ${decodedLastName}`} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/button:scale-110" 
                  />
                ) : (
                  <span>
                    {decodedFirstName.charAt(0) || '?'}
                    {decodedLastName.charAt(0) || ''}
                  </span>
                )}
              </button>

              {/* TOOLTIP INTEGRADO */}
              <div className="absolute left-1/2 -translate-x-1/2 top-full sm:left-full sm:translate-x-0 sm:top-0 mt-3 sm:mt-0 sm:ml-4 w-52 p-3 bg-zinc-950/95 border border-cyan-500/30 rounded-xl text-[9px] text-slate-300 font-mono opacity-0 pointer-events-none group-hover/avatar-box:opacity-100 transition-opacity duration-300 shadow-[0_0_25px_rgba(0,0,0,0.9)] z-50 leading-relaxed text-left">
                <span className="text-cyan-400 font-black block mb-1.5 border-b border-cyan-500/10 pb-1">⚙️ DIRETRIZES DA FOTO</span>
                • PROPORÇÃO: Quadrada (1:1)<br />
                • DIMENSÃO: 256px ou 512px<br />
                • FORMATO: WebP, PNG ou JPG<br />
                • PESO LIMITE: Até 3 MB
              </div>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase leading-none">
                {decodedFirstName} <span className="text-cyan-400">{decodedLastName}</span>
              </h2>
              <p className="text-xs text-slate-400 font-bold flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                <Globe size={12} className="text-indigo-400" />
                <span className="text-white">{manager.group || 'Rookie'}</span>
                <span className="text-slate-600">|</span>
                <span>ID: {manager.id || 'N/A'}</span>
              </p>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t lg:border-t-0 lg:border-l border-white/5 pt-4 lg:pt-0 lg:pl-6">
            <div className="p-2.5 bg-black/40 border border-white/5 rounded-lg text-center">
              <span className="text-[8px] text-slate-500 uppercase font-bold tracking-wider block">💰 Dinheiro</span>
              <p className="text-sm font-black text-green-400 mt-1">${formatCash(manager.cash || 0)}</p>
            </div>
            <div className="p-2.5 bg-black/40 border border-white/5 rounded-lg text-center">
              <span className="text-[8px] text-slate-500 uppercase font-bold tracking-wider block">⭐ Créditos</span>
              <p className="text-sm font-black text-amber-400 mt-1">{manager.credits || 0}</p>
            </div>
            <div className="p-2.5 bg-black/40 border border-white/5 rounded-lg text-center">
              <span className="text-[8px] text-slate-500 uppercase font-bold tracking-wider block">🏆 Títulos</span>
              <p className="text-sm font-black text-white mt-1">{manager.champs || 0}</p>
            </div>
            <div className="p-2.5 bg-black/40 border border-white/5 rounded-lg text-center">
              <span className="text-[8px] text-slate-500 uppercase font-bold tracking-wider block">📡 API</span>
              <p className="text-sm font-black text-cyan-400 mt-1">{manager.apiRequestsRemaining || 0}</p>
            </div>
          </div>

        </div>
      </div>

      {/* ==========================================
          STATUS RÁPIDO (4 cards)
          ========================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-black/40 border border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest block">⚡ Energia</span>
            <span className="text-lg font-black text-white">{driver ? `${driver.energy}%` : 'N/A'}</span>
          </div>
          <span className={`text-xs font-black ${energiaColor}`}>{energiaStatus}</span>
        </div>

        <div className="bg-black/40 border border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest block">📊 OA</span>
            <span className="text-lg font-black text-cyan-400">{driver ? driver.overall : '0'}</span>
          </div>
          <span className="text-xs font-black text-cyan-400">Overall</span>
        </div>

        <div className="bg-black/40 border border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest block">🚗 Carro</span>
            <span className={`text-lg font-black ${carColor}`}>{carHealth}%</span>
          </div>
          <span className={`text-xs font-black ${carColor}`}>{carStatus}</span>
        </div>

        <div className="bg-black/40 border border-white/5 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest block">🏁 Corrida</span>
            <span className={`text-lg font-black ${prepColor}`}>{race?.position || '-'}</span>
          </div>
          <span className={`text-xs font-black ${prepColor}`}>{prepStatus}</span>
        </div>
      </div>

      {/* ==========================================
          DIAGNÓSTICO RÁPIDO (4 status)
          ========================================== */}
      <div className="bg-zinc-950/80 border border-white/5 rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
          <span className="text-sm">📋</span>
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Status Para a Próxima Etapa</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-black/20">
            <span className="text-xs font-bold uppercase text-slate-400">Piloto</span>
            <span className={`text-xs font-black ${energiaColor}`}>{energiaStatus}</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-black/20">
            <span className="text-xs font-bold uppercase text-slate-400">Carro</span>
            <span className={`text-xs font-black ${carColor}`}>{carStatus}</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-black/20">
            <span className="text-xs font-bold uppercase text-slate-400">Qualificação</span>
            <span className={`text-xs font-black ${qualyColor}`}>{qualyStatus}</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-black/20">
            <span className="text-xs font-bold uppercase text-slate-400">Treino</span>
            <span className={`text-xs font-black ${prepColor}`}>{prepStatus}</span>
          </div>
        </div>
      </div>

      {/* ==========================================
          CORRIDA ATUAL (COM GRADIENTE)
          ========================================== */}
      <div className="bg-zinc-950 border border-cyan-500/20 rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-950/60 to-black px-4 py-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🏁</span>
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Resumo para a corrida</h3>
            </div>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider bg-white/5 px-2.5 py-1 rounded-lg">
              Temporada {race?.season || '?'} • Corrida {race?.race || '?'}
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            <div className="md:col-span-7 grid grid-cols-2 gap-3">
              <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Pista</span>
                <p className="text-lg font-black text-white mt-1">{race?.track || 'N/A'}</p>
              </div>
              <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Posição</span>
                <p className="text-lg font-black text-white mt-1">{race?.position || 'N/A'}</p>
              </div>
              <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Pontos</span>
                <p className="text-lg font-black text-cyan-400 mt-1">{race?.points || '0'}</p>
              </div>
              <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Média</span>
                <p className="text-lg font-black text-white mt-1">{race?.average || '-'}</p>
              </div>
            </div>

            <div className="md:col-span-5 flex flex-col justify-center space-y-2 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-5">
              <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-white/5">
                <span className="text-[10px] font-bold uppercase text-slate-400">Q1</span>
                <span className={`text-xs font-black ${isQ1Done ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {isQ1Done ? '✅ Feito' : '❌ Pendente'}
                </span>
              </div>
              <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-white/5">
                <span className="text-[10px] font-bold uppercase text-slate-400">Q2</span>
                <span className={`text-xs font-black ${isQ2Done ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {isQ2Done ? '✅ Feito' : '❌ Pendente'}
                </span>
              </div>
              <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-white/5">
                <span className="text-[10px] font-bold uppercase text-slate-400">Prática</span>
                <span className={`text-xs font-black ${practiceDone ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {practiceDone ? '✅ Feito' : '❌ Pendente'}
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ==========================================
          PILOTO (COM GRADIENTE)
          ========================================== */}
      {driver ? (
        <div className="bg-zinc-950 border border-cyan-500/20 rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-950/60 to-black px-4 py-3 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">🏎️</span>
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Piloto</h3>
              </div>
              <span className="text-[9px] text-cyan-400 bg-cyan-950/50 border border-cyan-500/30 px-2 py-0.5 rounded font-black">
                OA: {driver.overall || 0}
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {/* Dados básicos do piloto */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <div>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Nome</span>
                <p className="text-white font-black mt-0.5">{decodedDriverName || 'N/A'}</p>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Idade</span>
                <p className="text-white font-black mt-0.5">{driver.age || 0} anos</p>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Peso</span>
                <p className="text-white font-black mt-0.5">{driver.weight || 0} kg</p>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Salário</span>
                <p className="text-white font-black mt-0.5">${driver.salary || '0'}</p>
              </div>
            </div>

            {/* Atributos principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Energia</span>
                  <span className="text-sm font-black text-white">{driver.energy}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden mt-1.5">
                  <div className={`h-full rounded ${driver.energy >= 80 ? 'bg-emerald-400' : driver.energy >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.min(100, driver.energy)}%` }} />
                </div>
              </div>
              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Concentração</span>
                  <span className="text-sm font-black text-white">{driver.concentration}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden mt-1.5">
                  <div className="h-full rounded bg-cyan-400" style={{ width: `${Math.min(100, (driver.concentration / 250) * 100)}%` }} />
                </div>
              </div>
              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Talento</span>
                  <span className="text-sm font-black text-white">{driver.talent}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden mt-1.5">
                  <div className="h-full rounded bg-cyan-400" style={{ width: `${Math.min(100, (driver.talent / 250) * 100)}%` }} />
                </div>
              </div>
              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Agressividade</span>
                  <span className="text-sm font-black text-white">{driver.aggressiveness}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden mt-1.5">
                  <div className="h-full rounded bg-cyan-400" style={{ width: `${Math.min(100, (driver.aggressiveness / 250) * 100)}%` }} />
                </div>
              </div>
              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Experiência</span>
                  <span className="text-sm font-black text-white">{driver.experience}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden mt-1.5">
                  <div className="h-full rounded bg-indigo-400" style={{ width: `${Math.min(100, (driver.experience / 250) * 100)}%` }} />
                </div>
              </div>
            </div>

            {/* Atributos estendidos */}
            <div className="border-t border-white/5 pt-4">
              <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">Atributos complementares</span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
                <div className="bg-black/20 p-2.5 rounded-lg border border-white/5 text-center">
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight block">Técnica</span>
                  <span className="text-sm font-black text-white">{driver.technique || 0}</span>
                </div>
                <div className="bg-black/20 p-2.5 rounded-lg border border-white/5 text-center">
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight block">Resistência</span>
                  <span className="text-sm font-black text-white">{driver.stamina || 0}</span>
                </div>
                <div className="bg-black/20 p-2.5 rounded-lg border border-white/5 text-center">
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight block">Carisma</span>
                  <span className="text-sm font-black text-white">{driver.charisma || 0}</span>
                </div>
                <div className="bg-black/20 p-2.5 rounded-lg border border-white/5 text-center">
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight block">Motivação</span>
                  <span className="text-sm font-black text-white">{driver.motivation || 0}</span>
                </div>
                <div className="bg-black/20 p-2.5 rounded-lg border border-white/5 text-center">
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight block">Reputação</span>
                  <span className="text-sm font-black text-white">{driver.reputation || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
          <p className="text-slate-400 font-bold uppercase text-xs tracking-wider">Nenhum piloto contratado</p>
        </div>
      )}

      {/* ==========================================
          CARRO (COM GRADIENTE)
          ========================================== */}
      {car && car.length > 0 && (
        <div className="bg-zinc-950 border border-emerald-500/20 rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-950/60 to-black px-4 py-3 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">🚗</span>
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Carro</h3>
            </div>
            <div className="flex items-center gap-2.5 bg-black/60 px-3 py-1 rounded border border-white/5">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Integridade</span>
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <span key={i} className={`w-1 h-3 rounded-sm transition-all duration-300 ${i < Math.round(carHealth / 10) ? 'bg-emerald-400' : 'bg-zinc-800'}`} />
                  ))}
                </div>
                <span className={`text-[10px] font-black ${carColor}`}>{carHealth}%</span>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {car.map((part) => {
                const statusColor = part.wear > 80 ? 'text-rose-400' : part.wear > 50 ? 'text-amber-400' : 'text-emerald-400';
                const barColor = part.wear > 80 ? 'bg-rose-400' : part.wear > 50 ? 'bg-amber-400' : 'bg-emerald-400';
                return (
                  <div key={part.name} className="bg-black/50 border border-white/5 rounded-xl p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">{part.name}</span>
                      <span className={`text-xs font-black ${statusColor}`}>{part.wear}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden mt-1.5">
                      <div className={`h-full rounded ${barColor}`} style={{ width: `${part.wear}%` }} />
                    </div>
                    <span className="text-[9px] text-slate-500 font-bold mt-1 block">Nível {part.lvl}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          AÇÕES RÁPIDAS
          ========================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <a
          href="/dashboard/setup"
          className="bg-black/50 border border-white/5 rounded-xl p-3 text-center hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-1"
        >
          <span className="text-lg">🔧</span>
          <span className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-wider">Setup</span>
        </a>
        <a
          href="/dashboard/strategy"
          className="bg-black/50 border border-white/5 rounded-xl p-3 text-center hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-1"
        >
          <span className="text-lg">📊</span>
          <span className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-wider">Estratégia</span>
        </a>
        <a
          href="/dashboard/tests"
          className="bg-black/50 border border-white/5 rounded-xl p-3 text-center hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-1"
        >
          <span className="text-lg">🧪</span>
          <span className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-wider">Testes</span>
        </a>
        <a
          href="/dashboard"
          className="bg-black/50 border border-white/5 rounded-xl p-3 text-center hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-1"
        >
          <span className="text-lg">📋</span>
          <span className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-wider">Dashboard</span>
        </a>
      </div>

      {/* ==========================================
          FOOTER
          ========================================== */}
      {managerData?.lastSyncAt && (
        <div className="text-center text-[9px] text-slate-600 tracking-wider uppercase pt-4">
          Última atualização: {new Date(managerData.lastSyncAt).toLocaleString()}
        </div>
      )}

    </div>
  );
}