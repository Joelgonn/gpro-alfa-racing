'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/app/context/GameContext';
import { supabase } from '@/app/lib/supabase';
import he from 'he';
import {
  User, Settings, Loader2, Zap, Globe,
  Camera, MapPin, Calendar, DollarSign, Trophy,
  ChevronDown, Search, X, ShieldCheck, Award, Clock, TrendingUp, Flag,
  Car, Wrench, Gauge, Users, Briefcase, Medal, Star, Target, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- MAPEAMENTO DE BANDEIRAS ---
const TRACK_FLAGS: { [key: string]: string } = {
  "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Austin": "us", "Avus": "de", "A1-Ring": "at",
  "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb", "Brasilia": "br", "Bremgarten": "ch", "Brno": "cz", "Bucharest Ring": "ro", "Buenos Aires": "ar",
  "Catalunya": "es", "Dijon-Prenois": "fr", "Donington": "gb",
  "Estoril": "pt", "Fiorano": "it", "Fuji": "jp",
  "Grobnik": "hr", "Hockenheim": "de", "Hungaroring": "hu",
  "Imola": "sm", "Indianapolis oval": "us", "Indianapolis": "us", "Interlagos": "br", "Istanbul": "tr", "Irungattukottai": "in",
  "Jarama": "es", "Jeddah": "sa", "Jerez": "es", "Kyalami": "za", "Jyllands-Ringen": "dk", "Kaunas": "lt",
  "Laguna Seca": "us", "Las Vegas": "us", "Le Mans": "fr", "Long Beach": "us", "Losail": "qa",
  "Magny Cours": "fr", "Melbourne": "au", "Mexico City": "mx", "Miami": "us", "Misano": "it", "Monte Carlo": "mc", "Montreal": "ca", "Monza": "it", "Mugello": "it",
  "Nurburgring": "de", "Oschersleben": "de", "New Delhi": "in", "Oesterreichring": "at",
  "Paul Ricard": "fr", "Portimao": "pt", "Poznan": "pl",
  "Red Bull Ring": "at", "Rio de Janeiro": "br", "Rafaela Oval": "ar",
  "Sakhir": "bh", "Sepang": "my", "Shanghai": "cn", "Silverstone": "gb", "Singapore": "sg", "Sochi": "ru", "Spa": "be", "Suzuka": "jp", "Serres": "gr", "Slovakiaring": "sk",
  "Valencia": "es", "Vallelunga": "it",
  "Yas Marina": "ae", "Yeongam": "kr", "Zandvoort": "nl", "Zolder": "be"
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function ManagerPage() {
  const router = useRouter();
  const { 
    isGlobalLoading, 
    menuData,
    officeData,
    driverStatic,
    driverEditable,
    weather,
    car,
    techDirector,
    staffFacilities,
    reloadUserState
  } = useGame();
  
  // Estado local
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('Gerente');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ Auth
  useEffect(() => {
    async function getUserId() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserId(session.user.id);
          setAvatarUrl(session.user.user_metadata?.avatar_url || null);
          if (session.user.email) setUserEmail(session.user.email);
        }
      } catch (error) {
        console.error('Erro ao obter userId:', error);
      }
    }
    getUserId();
  }, []);

  // ✅ Atualiza lastUpdated quando os dados do sync mudarem
  useEffect(() => {
    if (menuData || officeData) {
      setLastUpdated(new Date().toISOString());
    }
  }, [menuData, officeData]);

  // ✅ Dados do gerente (do sync)
  const manager = {
    firstName: menuData?.firstName || menuData?.fName || 'N/A',
    lastName: menuData?.lastName || menuData?.lName || 'N/A',
    group: menuData?.group || 'Rookie',
    id: menuData?.id || menuData?.IDM || null,
    cash: menuData?.cash || 0,
    credits: menuData?.credits || 0,
    champs: menuData?.champs || 0,
    status: menuData?.status || menuData?.accStatus || 'Activated',
  };

  // ✅ Dados da ÚLTIMA CORRIDA (apenas resultados - do officeData)
  const lastRace = {
    position: officeData?.position || officeData?.pos || 'N/A',
    points: officeData?.points || officeData?.pts || '0',
    average: officeData?.average || officeData?.avg || '0',
    season: officeData?.season || officeData?.seasonNb || '?',
    race: officeData?.race || officeData?.raceNb || '?',
  };

  // ✅ Dados da PRÓXIMA CORRIDA (pista e status - do officeData)
  const nextRace = {
    season: officeData?.season || officeData?.seasonNb || '?',
    race: officeData?.race || officeData?.raceNb || '?',
    track: officeData?.trackName || 'N/A',    
    donePractice: officeData?.donePractice || '0',
    doneQ1: officeData?.doneQ1 || '0',
    doneQ2: officeData?.doneQ2 || '0',
  };

  // ✅ Dados do piloto (do sync)
  const driver = {
    name: driverStatic?.name || 'N/A',
    overall: driverStatic?.overall || 0,
    nationality: driverStatic?.nationality || 'N/A',
    nationalityName: driverStatic?.nationalityName || '',
    salary: driverStatic?.salary || '0',
    racesLeft: driverStatic?.racesLeft || '0',
    races: driverStatic?.races || 0,
    wins: driverStatic?.wins || 0,
    podiums: driverStatic?.podiums || 0,
    points: driverStatic?.points || 0,
    trophies: driverStatic?.trophies || 0,
    poles: driverStatic?.poles || 0,
    fastLaps: driverStatic?.fastLaps || 0,
    energia: driverEditable?.energia || 0,
    concentracao: driverEditable?.concentracao || 0,
    talento: driverEditable?.talento || 0,
    experiencia: driverEditable?.experiencia || 0,
  };

  // ✅ Upload de avatar
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

      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

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

  // ✅ Helpers
  const formatCash = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  const formatTimeAgo = (date: string | null) => {
    if (!date) return 'Nunca';
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diff < 60) return 'Agora mesmo';
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const decodeText = (text: string | null | undefined): string => {
    if (!text) return '';
    return he.decode(text);
  };

  // ✅ Loading
  if (isGlobalLoading) {
    return (
      <div className="flex flex-col h-[100dvh] items-center justify-center bg-[#eef2f6] text-emerald-600 font-mono text-xs gap-4">
        <div className="w-12 h-12 border-2 border-emerald-500/10 rounded-full flex items-center justify-center relative">
          <div className="w-12 h-12 border-2 border-t-emerald-600 rounded-full animate-spin absolute" />
          <Settings size={16} className="animate-pulse text-emerald-600" />
        </div>
        <span className="tracking-widest uppercase font-bold text-xs">CARREGANDO PERFIL...</span>
      </div>
    );
  }

  // ✅ Sem dados do sync
  if (!menuData || !officeData) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#eef2f6] text-slate-800 p-6 relative overflow-hidden font-mono">
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px]" />
        </div>
        <div className="relative z-10 max-w-lg w-full bg-white/90 border border-slate-200 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center">
          <div className="mx-auto w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <Zap size={24} className="text-emerald-500 animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider mb-2">Aguardando Sincronização</h2>
          <p className="text-xs text-slate-500 font-bold leading-relaxed mb-8 px-4">
            Os dados do GPRO estão sendo sincronizados. <br/>
            Aguarde ou force a sincronização manual.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => reloadUserState()}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all duration-200 flex items-center justify-center gap-3 shadow-md hover:shadow-lg active:scale-95 group"
            >
              <Zap size={14} className="group-hover:rotate-180 transition-transform duration-500" />
              Sincronizar Agora
            </button>
            <a
              href="/dashboard/configuracoes/integracao"
              className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all duration-200 flex items-center justify-center gap-3 shadow-sm hover:shadow-md active:scale-95"
            >
              <Settings size={14} />
              Configurar Integração
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Decode nomes
  const decodedFirstName = decodeText(manager.firstName);
  const decodedLastName = decodeText(manager.lastName);
  const decodedDriverName = decodeText(driver.name);

  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-700 font-mono pb-24 md:pb-12 selection:bg-emerald-500/20 relative overflow-hidden">
      
      {/* GLOWS */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/[0.01] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/[0.01] blur-[120px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/[0.01] blur-[150px] rounded-full" />
      </div>

      {/* HEADER - SEM SELETOR DE PISTA */}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-slate-200 bg-white/90 p-3 sm:p-4 relative shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.02] via-transparent to-emerald-500/[0.02] pointer-events-none" />
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 lg:gap-4 relative z-10">
          
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg sm:rounded-xl shadow-[0_4px_12px_rgba(16,185,129,0.15)] shrink-0">
              <User size={14} className="sm:w-4 sm:h-4 text-white" />
            </div>
            <div className="flex flex-col text-left">
              <h1 className="text-[10px] sm:text-[11px] font-black text-slate-900 uppercase tracking-widest leading-none mb-0.5 flex items-center gap-2">
                Perfil do Manager
                <span className="text-[7px] sm:text-[8px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-black">PRO</span>
              </h1>
              <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase truncate max-w-[100px] sm:max-w-[120px]">{userEmail}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full lg:w-auto">
            
            {/* Apenas Status + Sincronização */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                <span className="text-[8px] sm:text-[10px] font-bold text-emerald-600">CONECTADO</span>
              </div>
              
              <div className="text-right border-l border-slate-200 pl-3 sm:pl-4 shrink-0 flex flex-col justify-center">
                <p className="text-[7px] sm:text-[8px] text-slate-400 uppercase font-black tracking-widest leading-none mb-0.5 sm:mb-1">Última Sinc.</p>
                <p className="text-xs sm:text-sm font-black text-emerald-600 leading-none">
                  {formatTimeAgo(lastUpdated)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 max-w-[1600px] mx-auto space-y-5 animate-fadeIn relative z-10">
        
        {/* PERFIL DO GERENTE */}
        <div className="relative bg-white/90 border border-slate-200 shadow-sm hover:shadow-md rounded-2xl overflow-hidden backdrop-blur-sm group transition-all duration-300 hover:border-slate-300">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          
          <div className="relative bg-zinc-50 p-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-600 rounded-lg shadow-sm">
                <User size={14} className="text-white" />
              </div>
              <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Perfil do Gerente</h2>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border text-emerald-600 bg-emerald-50 border-emerald-200">
              CONECTADO
            </span>
          </div>

          <div className="relative p-4 md:p-6 bg-white">
            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
              
              {/* Avatar */}
              <div className="relative group shrink-0">
                <button
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-slate-200 hover:border-emerald-400 flex items-center justify-center text-2xl font-black text-emerald-600 overflow-hidden transition-all duration-300 shadow-md hover:shadow-lg"
                >
                  {isUploading ? (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                      <Loader2 className="animate-spin text-emerald-600" size={24} />
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-[8px] font-black text-white gap-1 z-10 rounded-2xl">
                      <Camera size={18} />
                      <span>EDITAR</span>
                    </div>
                  )}
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={decodedFirstName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{decodedFirstName.charAt(0)}{decodedLastName.charAt(0)}</span>
                  )}
                </button>
                <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
              </div>

              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  {decodedFirstName} <span className="text-emerald-600">{decodedLastName}</span>
                </h2>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-1 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5 font-bold bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                    <Globe size={13} className="text-emerald-500" />
                    {manager.group}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-bold text-amber-600">{manager.champs || 0} 🏆</span>
                  <span className="text-slate-300">•</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${manager.status === 'Activated' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {manager.status}
                  </span>
                </div>
              </div>

              {/* Finanças */}
              <div className="grid grid-cols-2 gap-2.5 w-full md:w-auto">
                <div className="bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm hover:border-emerald-300 transition-all">
                  <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Saldo</span>
                  <p className="text-sm font-black text-emerald-600 mt-0.5">${formatCash(manager.cash || 0)}</p>
                </div>
                <div className="bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm hover:border-emerald-300 transition-all">
                  <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Créditos</span>
                  <p className="text-sm font-black text-amber-500 mt-0.5">{manager.credits || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARDS LADO A LADO: ÚLTIMA CORRIDA + PRÓXIMA CORRIDA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* ÚLTIMA CORRIDA - Apenas resultados */}
          <div className="relative bg-white/90 border border-slate-200 shadow-sm hover:shadow-md rounded-2xl overflow-hidden backdrop-blur-sm group transition-all duration-300 hover:border-slate-300">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="relative bg-zinc-50 p-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-600 rounded-lg shadow-sm">
                  <Flag size={14} className="text-white" />
                </div>
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Campeonato</h3>
              </div>
              <span className="text-[10px] font-mono font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                S{lastRace.season} • R{lastRace.race}
              </span>
            </div>

            <div className="relative p-4 bg-white grid grid-cols-3 gap-3">
              <div className="space-y-0.5 text-center">
                <span className="text-[7px] text-slate-400 font-black uppercase tracking-wider">Posição</span>
                <p className="text-lg font-black text-emerald-600">{lastRace.position}</p>
              </div>
              <div className="space-y-0.5 text-center">
                <span className="text-[7px] text-slate-400 font-black uppercase tracking-wider">Pontos</span>
                <p className="text-lg font-black text-amber-500">{lastRace.points}</p>
              </div>
              <div className="space-y-0.5 text-center">
                <span className="text-[7px] text-slate-400 font-black uppercase tracking-wider">Média</span>
                <p className="text-sm font-black text-slate-700">{lastRace.average}</p>
              </div>
            </div>
          </div>

          {/* PRÓXIMA CORRIDA - Pista com bandeira e status */}
          <div className="relative bg-white/90 border border-slate-200 shadow-sm hover:shadow-md rounded-2xl overflow-hidden backdrop-blur-sm group transition-all duration-300 hover:border-slate-300">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.01] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="relative bg-zinc-50 p-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-600 rounded-lg shadow-sm">
                  <Calendar size={14} className="text-white" />
                </div>
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Próxima Corrida</h3>
              </div>
              <span className="text-[10px] font-mono font-black text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                S{nextRace.season} • R{nextRace.race}
              </span>
            </div>

            <div className="relative p-4 bg-white">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Bandeira do país da pista */}
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl shadow-sm overflow-hidden">
                    {nextRace.track && TRACK_FLAGS[nextRace.track] ? (
                      <img 
                        src={`/flags/${TRACK_FLAGS[nextRace.track]}.png`} 
                        alt={nextRace.track} 
                        className="w-8 h-6 object-cover rounded-sm" 
                      />
                    ) : (
                      <span className="text-2xl">🏁</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800">{nextRace.track}</p>                    
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="flex-1 md:flex-none bg-[#f8fafc] rounded-xl px-3 py-2 border border-slate-200 shadow-sm">
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Treinos</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-black ${nextRace.donePractice === '1' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {nextRace.donePractice === '1' ? '✅' : '⏳'}
                      </span>
                      <span className={`text-[10px] font-black ${nextRace.donePractice === '1' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {nextRace.donePractice === '1' ? 'Feito' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex-1 md:flex-none bg-[#f8fafc] rounded-xl px-3 py-2 border border-slate-200 shadow-sm">
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block">Qualificação</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-black ${nextRace.doneQ1 === '1' && nextRace.doneQ2 === '1' ? 'text-emerald-500' : nextRace.doneQ1 === '1' || nextRace.doneQ2 === '1' ? 'text-amber-500' : 'text-slate-400'}`}>
                        {nextRace.doneQ1 === '1' && nextRace.doneQ2 === '1' ? '✅' : nextRace.doneQ1 === '1' || nextRace.doneQ2 === '1' ? '⏳' : '❌'}
                      </span>
                      <span className={`text-[10px] font-black ${nextRace.doneQ1 === '1' && nextRace.doneQ2 === '1' ? 'text-emerald-500' : nextRace.doneQ1 === '1' || nextRace.doneQ2 === '1' ? 'text-amber-500' : 'text-slate-400'}`}>
                        {nextRace.doneQ1 === '1' && nextRace.doneQ2 === '1' ? 'Completa' : nextRace.doneQ1 === '1' || nextRace.doneQ2 === '1' ? 'Parcial' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* INFO RÁPIDA: PILOTO + CLIMA + CARRO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Piloto */}
          <div className="relative bg-white/90 border border-slate-200 shadow-sm hover:shadow-md rounded-2xl overflow-hidden backdrop-blur-sm group transition-all duration-300 hover:border-slate-300">
            <div className="relative bg-zinc-50 p-3 border-b border-slate-200 flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-600" />
              <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Piloto</h4>
            </div>
            <div className="relative p-3 bg-white">
              <p className="text-sm font-black text-slate-800 truncate">{decodedDriverName}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-600 font-black">OA {driver.overall}</span>
                <span>•</span>
                <span>{driver.racesLeft} corridas</span>
                <span>•</span>
                <span className={`font-bold ${driver.energia >= 80 ? 'text-emerald-500' : driver.energia >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                  🔋 {driver.energia}%
                </span>
              </div>
            </div>
          </div>

          {/* Clima */}
          <div className="relative bg-white/90 border border-slate-200 shadow-sm hover:shadow-md rounded-2xl overflow-hidden backdrop-blur-sm group transition-all duration-300 hover:border-slate-300">
            <div className="relative bg-zinc-50 p-3 border-b border-slate-200 flex items-center gap-2">
              <Activity size={14} className="text-amber-600" />
              <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Clima</h4>
            </div>
            <div className="relative p-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{weather?.weatherRace === 'Wet' ? '🌧️' : '☀️'}</span>
                  <span className="text-sm font-black text-slate-800">{weather?.weatherRace === 'Wet' ? 'Chuva' : 'Seca'}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-emerald-600">{weather?.tempQ2 || 0}°C</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                <span>Q1: {weather?.tempQ1 || 0}°C</span>
                <span>•</span>
                <span>Q2: {weather?.tempQ2 || 0}°C</span>
              </div>
            </div>
          </div>

          {/* Carro - Resumo */}
          <div className="relative bg-white/90 border border-slate-200 shadow-sm hover:shadow-md rounded-2xl overflow-hidden backdrop-blur-sm group transition-all duration-300 hover:border-slate-300">
            <div className="relative bg-zinc-50 p-3 border-b border-slate-200 flex items-center gap-2">
              <Car size={14} className="text-indigo-600" />
              <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Carro</h4>
            </div>
            <div className="relative p-3 bg-white">
              {car && car.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-800">
                      {(car.reduce((acc, part) => acc + part.lvl, 0) / car.length).toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-500">Nível Médio</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                    <span>Peças: {car.length}</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-black">
                      {Math.round(100 - car.reduce((acc, part) => acc + part.wear, 0) / car.length)}% saúde
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* STAFF & TECH DIRECTOR - RESUMO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Tech Director */}
          <div className="relative bg-white/90 border border-slate-200 shadow-sm hover:shadow-md rounded-2xl overflow-hidden backdrop-blur-sm group transition-all duration-300 hover:border-slate-300">
            <div className="relative bg-zinc-50 p-3 border-b border-slate-200 flex items-center gap-2">
              <Briefcase size={14} className="text-cyan-600" />
              <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Diretor Técnico</h4>
            </div>
            <div className="relative p-3 bg-white">
              <p className="text-sm font-black text-slate-800 truncate">{techDirector?.name || 'Nenhum'}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span className="bg-cyan-50 px-2 py-0.5 rounded text-cyan-600 font-black">OA {techDirector?.overall || '0'}</span>
                <span>•</span>
                <span>{techDirector?.racesLeft || '0'} corridas</span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-500">
                <span>🔧 {techDirector?.rdMecanico || 0}</span>
                <span>⚡ {techDirector?.rdEletronico || 0}</span>
                <span>🌀 {techDirector?.rdAerodinamico || 0}</span>
              </div>
            </div>
          </div>

          {/* Staff */}
          <div className="relative bg-white/90 border border-slate-200 shadow-sm hover:shadow-md rounded-2xl overflow-hidden backdrop-blur-sm group transition-all duration-300 hover:border-slate-300">
            <div className="relative bg-zinc-50 p-3 border-b border-slate-200 flex items-center gap-2">
              <Users size={14} className="text-purple-600" />
              <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Equipe (Staff)</h4>
            </div>
            <div className="relative p-3 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-800">Nível</span>
                <span className="text-xs font-black text-emerald-600">
                  {Math.round((staffFacilities?.toleranciaPressao || 0 + staffFacilities?.concentracao || 0) / 2)}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-500">
                <span>🔄 Tolerância: {staffFacilities?.toleranciaPressao || 0}</span>
                <span>🧠 Concentração: {staffFacilities?.concentracao || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="text-center text-[9px] font-mono text-slate-400 space-y-1 pt-4 border-t border-slate-200/50">
          <p>ÚLTIMA SINCRONIZAÇÃO EM {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'N/A'}</p>
          <p className="tracking-widest font-black">SISTEMA INTEGRADO v2.1.0</p>
        </div>

      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16, 185, 129, 0.2); }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.6s ease-out forwards; }
      `}</style>
    </div>
  );
}