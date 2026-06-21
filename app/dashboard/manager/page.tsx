'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useGame } from '@/app/context/GameContext';
import he from 'he';
import {
  User, Trophy, Coins, Cpu, CheckCircle2, XCircle, AlertCircle,
  Loader2, Sparkles, Activity, ShieldAlert, Zap, Globe,
  Camera, Gauge, Layers, RefreshCw, Clock, TrendingUp,
  Shield, Award, MapPin, Dumbbell, Brain, Wrench, Heart
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
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
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
        cache: forceRefresh ? 'no-store' : 'default',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao buscar dados');
      }

      const data = await response.json();
      setManagerData(data);
      setLastUpdated(new Date().toISOString());
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
      return `${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  const formatTimeAgo = (date: string | null) => {
    if (!date) return 'Nunca';
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diff < 60) return 'Agora mesmo';
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return `${Math.floor(diff / 86400)}d atrás`;
  };

  const decodeText = (text: string | null | undefined): string => {
    if (!text) return '';
    return he.decode(text);
  };

  if (isLoading || isGlobalLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-gradient-to-br from-[#030307] via-[#080810] to-[#030307] p-6">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-16 h-16 border border-cyan-500/10 rounded-full absolute animate-pulse"></div>
          <div className="w-16 h-16 border-2 border-t-cyan-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          <Sparkles className="text-cyan-400 absolute animate-pulse" size={20} />
        </div>
        <p className="font-mono text-xs tracking-widest text-cyan-400/80 uppercase animate-pulse">Sincronizando Telemetria...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] bg-gradient-to-br from-[#030307] via-[#080810] to-[#030307] p-4">
        <div className="text-center max-w-sm bg-zinc-950/80 backdrop-blur-md border border-rose-500/20 p-6 rounded-2xl shadow-2xl">
          <div className="text-rose-500 mb-4 flex justify-center">
            <span className="p-3 bg-rose-500/10 rounded-full border border-rose-500/20">
              <AlertCircle size={28} />
            </span>
          </div>
          <h2 className="text-base font-bold text-white uppercase tracking-wider mb-2">Erro de Conexão</h2>
          <p className="text-slate-400 text-xs mb-6">{error}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => loadManagerData(true)}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
            >
              <RefreshCw size={12} className="inline mr-2" />
              Tentar Novamente
            </button>
            <a
              href="/dashboard/configuracoes/integracao"
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-slate-300 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider border border-white/5 transition-all text-center"
            >
              Ajustar Integração
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!managerData) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] bg-gradient-to-br from-[#030307] via-[#080810] to-[#030307] p-4">
        <div className="text-center max-w-sm bg-zinc-950/80 backdrop-blur-md border border-cyan-500/20 p-6 rounded-2xl shadow-2xl">
          <div className="text-cyan-400 mb-4 flex justify-center">
            <span className="p-3 bg-cyan-500/10 rounded-full border border-cyan-500/20 animate-pulse">
              <Activity size={28} />
            </span>
          </div>
          <h2 className="text-base font-bold text-white uppercase tracking-wider mb-2">Conectar GPRO</h2>
          <p className="text-slate-400 text-xs mb-6">Importe os dados em tempo real da sua conta de forma integrada.</p>
          <a
            href="/dashboard/configuracoes/integracao"
            className="inline-flex items-center justify-center gap-2 w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/10"
          >
            <Zap size={14} />
            Vincular Conta GPRO
          </a>
        </div>
      </div>
    );
  }

  const { manager, driver, car, race, source } = managerData;

  const decodedFirstName = decodeText(manager.firstName);
  const decodedLastName = decodeText(manager.lastName);
  const decodedDriverName = decodeText(driver?.name);

  const energy = driver?.energy ?? 0;
  const energiaStatus = energy >= 80 ? "Excelente" : energy >= 50 ? "Média" : "Crítica";
  const energiaColor = energy >= 80 ? "text-emerald-400" : energy >= 50 ? "text-amber-400" : "text-rose-500";
  const energiaProgress = energy >= 80 ? "bg-emerald-400" : energy >= 50 ? "bg-amber-400" : "bg-rose-500";

  const totalParts = car?.length || 0;
  const avgWear = totalParts > 0 
    ? car.reduce((acc, part) => acc + part.wear, 0) / totalParts 
    : 0;
  const carHealth = Math.round(100 - avgWear);
  const carStatus = carHealth >= 80 ? "Excelente" : carHealth >= 50 ? "Regular" : "Crítico";
  const carColor = carHealth >= 80 ? "text-emerald-400" : carHealth >= 50 ? "text-amber-400" : "text-rose-500";
  const carProgress = carHealth >= 80 ? "bg-emerald-400" : carHealth >= 50 ? "bg-amber-400" : "bg-rose-500";

  const isQ1Done = race?.doneQ1 === '1';
  const isQ2Done = race?.doneQ2 === '1';
  const qualyStatus = (isQ1Done && isQ2Done) ? "✅ Completa" : (isQ1Done || isQ2Done) ? "⏳ Parcial" : "❌ Pendente";
  const qualyColor = (isQ1Done && isQ2Done) ? "text-emerald-400" : (isQ1Done || isQ2Done) ? "text-amber-400" : "text-slate-500";

  const practiceDone = race?.donePractice === '1';
  const prepStatus = practiceDone ? "✅ Feito" : "❌ Pendente";
  const prepColor = practiceDone ? "text-emerald-400" : "text-amber-400";

  const getStatusIcon = (status: string) => {
    if (status === 'Excelente' || status === '✅ Completa' || status === '✅ Feito') 
      return <CheckCircle2 size={12} className="text-emerald-400" />;
    if (status === 'Média' || status === 'Regular' || status === '⏳ Parcial') 
      return <AlertCircle size={12} className="text-amber-400" />;
    return <XCircle size={12} className="text-rose-400" />;
  };

  return (
    <div className="min-h-screen bg-[#030307] text-slate-100 pb-20 md:pb-8">
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleAvatarUpload} 
        accept="image/*" 
        className="hidden" 
      />

      <div className="max-w-5xl mx-auto px-4 pt-4 space-y-4 sm:space-y-6">

        {/* HEADER */}
        <div className="flex items-center justify-between p-3.5 bg-zinc-950/60 backdrop-blur-md border border-white/5 rounded-2xl shadow-xl">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${source === 'gpro-fallback' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${source === 'gpro-fallback' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
              {source === 'gpro-fallback' ? 'GPRO LIVE MODE' : 'CONEXÃO ESTÁVEL'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-500 font-mono hidden sm:inline">
              Sincronizado: {formatTimeAgo(lastUpdated)}
            </span>
            <button
              onClick={() => loadManagerData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              <RefreshCw size={10} className={`${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Syncing' : 'Atualizar'}
            </button>
          </div>
        </div>

        {/* PERFIL DO GERENTE */}
        <div className="bg-gradient-to-b from-zinc-950 to-zinc-900/40 border border-white/5 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col sm:flex-row gap-5 items-center justify-between relative z-10">
            <div className="flex flex-col sm:flex-row gap-4 items-center text-center sm:text-left">
              
              {/* Avatar Uploader */}
              <div className="relative group shrink-0">
                <button
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-xl font-bold text-cyan-400 overflow-hidden transition-transform active:scale-95 shadow-md"
                >
                  {isUploading ? (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 backdrop-blur-xs">
                      <Loader2 className="animate-spin text-cyan-400" size={18} />
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-[8px] font-bold gap-1 z-10">
                      <Camera size={14} />
                      <span>EDITAR</span>
                    </div>
                  )}

                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt={`${decodedFirstName}`} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <span>
                      {decodedFirstName.charAt(0)}
                      {decodedLastName.charAt(0)}
                    </span>
                  )}
                </button>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight uppercase">
                  {decodedFirstName} <span className="text-cyan-400">{decodedLastName}</span>
                </h2>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 font-semibold text-slate-300">
                    <Globe size={11} className="text-cyan-500" />
                    {manager.group || 'Rookie'}
                  </span>
                  <span className="text-slate-700">•</span>
                  <span className="font-mono">ID {manager.id}</span>
                </div>
              </div>
            </div>

            {/* Finanças e status do Gerente */}
            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
              <div className="bg-zinc-950/40 border border-white/5 rounded-xl px-3.5 py-2">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block">Saldo</span>
                <p className="text-sm font-black text-emerald-400 mt-0.5">${formatCash(manager.cash || 0)}</p>
              </div>
              <div className="bg-zinc-950/40 border border-white/5 rounded-xl px-3.5 py-2">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block">Créditos</span>
                <p className="text-sm font-black text-amber-400 mt-0.5">{manager.credits || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* METRICAS DE DIAGNÓSTICO */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Driver Integrity */}
          <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Piloto</span>
              <span className={`text-[10px] font-bold ${energiaColor}`}>{driver?.energy}%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${energiaProgress}`} style={{ width: `${energy}%` }} />
            </div>
          </div>

          {/* Car Integrity */}
          <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Carro</span>
              <span className={`text-[10px] font-bold ${carColor}`}>{carHealth}%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${carProgress}`} style={{ width: `${carHealth}%` }} />
            </div>
          </div>

          {/* Qualy Info */}
          <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-3 flex flex-col justify-center">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Qualificação</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-black ${qualyColor}`}>{qualyStatus}</span>
            </div>
          </div>

          {/* Practice Info */}
          <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-3 flex flex-col justify-center">
            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Treinos Livres</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-black ${prepColor}`}>{prepStatus}</span>
            </div>
          </div>
        </div>

        {/* CORRIDA ATUAL / PRÓXIMO GP */}
        <div className="bg-gradient-to-b from-zinc-950 to-zinc-950/80 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-4 py-3 bg-white/2 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2">
              <MapPin size={13} className="text-cyan-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">GP Atual</h3>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded-md font-semibold">
              S{race?.season || '?'} • R{race?.race || '?'}
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Circuito</span>
              <p className="text-sm font-black text-white truncate">{race?.track || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Última Pos. Concluída</span>
              <p className="text-sm font-black text-cyan-400">{race?.position || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Média Geral do GP</span>
              <p className="text-sm font-black text-slate-300">{race?.average || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* DETALHES DO PILOTO */}
        {driver ? (
          <div className="bg-zinc-950/80 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-white/2 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-2">
                <Shield size={13} className="text-cyan-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                  {decodedDriverName || 'Contratado'}
                </h3>
              </div>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-950/30 border border-amber-500/20 px-2 py-0.5 rounded-md">
                OA {driver.overall}
              </span>
            </div>

            <div className="p-4 space-y-4">
              {/* Informações Básicas */}
              <div className="grid grid-cols-3 gap-2.5 bg-zinc-900/30 p-2.5 rounded-xl border border-white/5">
                <div className="text-center">
                  <span className="text-[8px] text-slate-500 font-semibold block uppercase">Idade</span>
                  <span className="text-xs font-bold text-white">{driver.age} anos</span>
                </div>
                <div className="text-center border-x border-white/5">
                  <span className="text-[8px] text-slate-500 font-semibold block uppercase">Peso</span>
                  <span className="text-xs font-bold text-white">{driver.weight} kg</span>
                </div>
                <div className="text-center">
                  <span className="text-[8px] text-slate-500 font-semibold block uppercase">Contrato</span>
                  <span className="text-xs font-bold text-amber-400">{driver.racesLeft} corridas</span>
                </div>
              </div>

              {/* Atributos Mapeados */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Técnico */}
                <div className="bg-zinc-900/10 p-3 rounded-xl border border-white/5 space-y-2.5">
                  <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                    <Wrench size={12} className="text-cyan-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Técnico</span>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-400">Talento</span>
                        <span className="font-bold text-white">{driver.talent}</span>
                      </div>
                      <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500" style={{ width: `${Math.min(100, (driver.talent / 250) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-400">Técnica</span>
                        <span className="font-bold text-white">{driver.technique}</span>
                      </div>
                      <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500" style={{ width: `${Math.min(100, (driver.technique / 250) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-400">Experiência</span>
                        <span className="font-bold text-white">{driver.experience}</span>
                      </div>
                      <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500" style={{ width: `${Math.min(100, (driver.experience / 250) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mental */}
                <div className="bg-zinc-900/10 p-3 rounded-xl border border-white/5 space-y-2.5">
                  <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                    <Brain size={12} className="text-indigo-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Mental</span>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-400">Concentração</span>
                        <span className="font-bold text-white">{driver.concentration}</span>
                      </div>
                      <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (driver.concentration / 250) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-400">Agressividade</span>
                        <span className="font-bold text-white">{driver.aggressiveness}</span>
                      </div>
                      <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (driver.aggressiveness / 250) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-400">Motivação</span>
                        <span className="font-bold text-white">{driver.motivation}</span>
                      </div>
                      <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (driver.motivation / 250) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Físico & Imagem */}
                <div className="bg-zinc-900/10 p-3 rounded-xl border border-white/5 space-y-2.5">
                  <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                    <Dumbbell size={12} className="text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Físico & Outros</span>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-400">Resistência</span>
                        <span className="font-bold text-white">{driver.stamina}</span>
                      </div>
                      <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (driver.stamina / 250) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-400">Carisma</span>
                        <span className="font-bold text-white">{driver.charisma}</span>
                      </div>
                      <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (driver.charisma / 250) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-400">Reputação</span>
                        <span className="font-bold text-white">{driver.reputation}</span>
                      </div>
                      <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (driver.reputation / 250) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-950/80 border border-white/5 rounded-2xl p-6 text-center shadow-md">
            <User size={24} className="text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">Nenhum piloto contratado</p>
          </div>
        )}

        {/* STATUS DO CARRO POR PEÇA */}
        {car && car.length > 0 && (
          <div className="bg-zinc-950/80 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-white/2 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-2">
                <Gauge size={13} className="text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">Componentes do Carro</h3>
              </div>
              <span className={`text-[10px] font-semibold ${carColor}`}>Desgaste Médio {avgWear.toFixed(1)}%</span>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {car.map((part) => {
                  const partWear = part.wear;
                  const isCritical = partWear > 80;
                  const isWarning = partWear > 50 && partWear <= 80;
                  
                  const statusColor = isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400';
                  const progressColor = isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';

                  return (
                    <div key={part.name} className="bg-zinc-900/20 border border-white/5 rounded-xl p-2.5 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[80px]">{part.name}</span>
                          <span className={`text-[10px] font-black ${statusColor}`}>{partWear}%</span>
                        </div>
                        <span className="text-[8px] text-slate-500">Nível {part.lvl}</span>
                      </div>
                      <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden mt-2">
                        <div className={`h-full ${progressColor}`} style={{ width: `${partWear}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* AÇÕES E LINKS RÁPIDOS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <a
            href="/dashboard/setup"
            className="flex flex-col items-center justify-center p-3.5 bg-zinc-950/60 border border-white/5 rounded-xl hover:bg-zinc-900/40 transition-colors"
          >
            <span className="text-base mb-1">🔧</span>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Ajustar Setup</span>
          </a>
          <a
            href="/dashboard/strategy"
            className="flex flex-col items-center justify-center p-3.5 bg-zinc-950/60 border border-white/5 rounded-xl hover:bg-zinc-900/40 transition-colors"
          >
            <span className="text-base mb-1">📊</span>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Estratégia</span>
          </a>
          <a
            href="/dashboard/tests"
            className="flex flex-col items-center justify-center p-3.5 bg-zinc-950/60 border border-white/5 rounded-xl hover:bg-zinc-900/40 transition-colors"
          >
            <span className="text-base mb-1">🧪</span>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Pista de Testes</span>
          </a>
          <a
            href="/dashboard"
            className="flex flex-col items-center justify-center p-3.5 bg-zinc-950/60 border border-white/5 rounded-xl hover:bg-zinc-900/40 transition-colors"
          >
            <span className="text-base mb-1">📋</span>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Geral</span>
          </a>
        </div>

        {/* FOOTER */}
        <div className="text-center text-[9px] font-mono text-slate-600 space-y-1 pt-4">
          <p>ÚLTIMA SINCRONIZAÇÃO EM {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'N/A'}</p>
          <p className="tracking-widest">SISTEMA INTEGRADO v2.1.0</p>
        </div>

      </div>
    </div>
  );
}