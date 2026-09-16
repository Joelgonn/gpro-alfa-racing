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

import { TRACK_FLAGS } from '@/app/lib/tracks';
import { calcStaffLevel } from '@/app/lib/staff';
import { ManagerHero } from './components/ManagerHero';
import { RaceStatusStrip } from './components/RaceStatusStrip';
import { DriverSummary } from './components/DriverSummary';
import { CarHealthCard } from './components/CarHealth';
import { TechDirectorCard } from './components/TechDirectorCard';
import { StaffCard } from './components/StaffCard';
import { EmptyState } from './components/EmptyState';
import { SyncBanner } from './components/SyncBanner';

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
    reloadUserState,
    lastImportAt,
    updatedAt
  } = useGame();
  
  // Estado local
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('Gerente');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
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

  // Timestamp real exposto pelo GameContext (updated_at / last_import_at), sem new Date() falso
  const lastUpdatedReal = lastImportAt || updatedAt || null;

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

  // ✅ Dados do CAMPEONATO (última corrida - do officeData)
  const championship = {
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

  // ✅ PEGA A BANDEIRA DO PAÍS DO PILOTO (mesmo sistema do Dashboard)
  const getFlagUrl = (nationality: string) => {
    if (!nationality) return null;
    const flagMap: Record<string, string> = {
      'Brazil': 'br',
      'United Kingdom': 'gb',
      'England': 'gb',
      'Great Britain': 'gb',
      'UK': 'gb',
      'United States': 'us',
      'USA': 'us',
      'Germany': 'de',
      'France': 'fr',
      'Italy': 'it',
      'Spain': 'es',
      'Portugal': 'pt',
      'Netherlands': 'nl',
      'Belgium': 'be',
      'Switzerland': 'ch',
      'Austria': 'at',
      'Finland': 'fi',
      'Sweden': 'se',
      'Norway': 'no',
      'Denmark': 'dk',
      'Japan': 'jp',
      'China': 'cn',
      'Australia': 'au',
      'New Zealand': 'nz',
      'Canada': 'ca',
      'Mexico': 'mx',
      'Argentina': 'ar',
      'Colombia': 'co',
      'Venezuela': 've',
      'Chile': 'cl',
      'Peru': 'pe',
      'India': 'in',
      'South Africa': 'za',
      'Russia': 'ru',
      'Poland': 'pl',
      'Czech Republic': 'cz',
      'Hungary': 'hu',
      'Romania': 'ro',
      'Bulgaria': 'bg',
      'Greece': 'gr',
      'Turkey': 'tr',
      'Israel': 'il',
      'United Arab Emirates': 'ae',
      'Qatar': 'qa',
      'Bahrain': 'bh',
      'Malaysia': 'my',
      'Singapore': 'sg',
      'South Korea': 'kr',
      'Thailand': 'th',
      'Indonesia': 'id',
      'Philippines': 'ph',
      'Pakistan': 'pk',
    };
    
    const code = flagMap[nationality] || nationality.toLowerCase().substring(0, 2);
    return `/flags/${code}.png`;
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

      try {
        await supabase
          .from('user_state')
          .update({ avatar_url: publicUrl } as any)
          .eq('user_id', userId);
      } catch (e: any) {
        if (e?.code !== '42703') console.warn('Avatar user_state não salvo:', e?.message);
      }

      setAvatarUrl(publicUrl);
    } catch (err: any) {
      console.error('Erro ao enviar imagem:', err);
      alert('Erro ao carregar imagem: ' + (err.message || err));
    } finally {
      setIsUploading(false);
    }
  };

  // ✅ Sincronização real com API (corrige regressão ALFA-003)
  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('loading');
    setSyncError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id || userId;
      if (!uid) throw new Error('Sessão expirada. Faça login novamente.');
      const response = await fetch('/api/gpro/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = payload?.error || `Falha na sincronização (${response.status})`;
        // Mensagens específicas para token
        if (response.status === 404 && msg.toLowerCase().includes('token')) {
          throw new Error('Integração não configurada. Configure seu token GPRO para sincronizar os dados.');
        }
        if (response.status === 401) throw new Error('Sessão expirada. Faça login novamente.');
        if (response.status === 403) throw new Error('Acesso negado. Verifique suas permissões.');
        if (msg.toLowerCase().includes('inválido') || msg.toLowerCase().includes('expirou')) {
          throw new Error('O token GPRO é inválido ou expirou. Atualize a integração.');
        }
        throw new Error(msg);
      }
      if (!payload.success) throw new Error(payload.error || 'Erro na sincronização');
      await reloadUserState();
      setSyncStatus('success');
    } catch (err: any) {
      const message = err?.message || 'Erro ao sincronizar. Tente novamente.';
      // Nunca expor gpro_token
      const safe = message.toLowerCase().includes('gpro_token') ? 'Erro na integração. Verifique o token.' : message;
      setSyncError(safe);
      setSyncStatus('error');
      console.error('Erro sync:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // ✅ Helpers
  const formatCash = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  const formatTimeAgo = (date: string | null) => {
    if (!date) return 'Sincronização não identificada';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Sincronização não identificada';
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
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
      <div className="flex flex-col h-[100dvh] items-center justify-center bg-[#030712] text-emerald-400 font-sans text-xs gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-emerald-500/20 rounded-full absolute"></div>
          <Loader2 className="animate-spin w-8 h-8 text-emerald-400" />
        </div>
        <span className="animate-pulse tracking-widest text-emerald-300 font-bold">CARREGANDO PERFIL...</span>
      </div>
    );
  }

  // Helpers para mensagens específicas por estado (sem expor token)
  const getMenuEmptyState = () => {
    if (syncStatus === 'error' && syncError) {
      if (syncError.toLowerCase().includes('token não encontrado') || syncError.toLowerCase().includes('integração não configurada')) return { title: 'Configure sua integração GPRO para carregar os dados da equipe.', action: 'Configurar Integração', href: '/dashboard/configuracoes/integracao' };
      if (syncError.toLowerCase().includes('inválido') || syncError.toLowerCase().includes('expirou')) return { title: 'Não foi possível autenticar na GPRO. Revise seu token.', action: 'Revisar token', href: '/dashboard/configuracoes/integracao' };
      return { title: 'Não foi possível atualizar este bloco agora.', action: 'Tentar novamente' };
    }
    if (isSyncing) return { title: 'Sincronizando dados da equipe...', action: null };
    return { title: 'Este módulo ainda não recebeu dados da GPRO.', action: 'Sincronizar Agora' };
  };
  const getOfficeEmptyState = () => {
    if (syncStatus === 'error' && syncError) {
      if (syncError.toLowerCase().includes('token não encontrado') || syncError.toLowerCase().includes('integração não configurada')) return { title: 'Configure sua integração GPRO para carregar a próxima corrida.', action: 'Configurar Integração', href: '/dashboard/configuracoes/integracao' };
      if (syncError.toLowerCase().includes('inválido') || syncError.toLowerCase().includes('expirou')) return { title: 'Não foi possível autenticar na GPRO. Revise seu token.', action: 'Revisar token', href: '/dashboard/configuracoes/integracao' };
      return { title: 'Não foi possível atualizar este bloco agora.', action: 'Tentar novamente' };
    }
    if (isSyncing) return { title: 'Sincronizando dados de corrida...', action: null };
    return { title: 'Este módulo ainda não recebeu dados da GPRO.', action: 'Sincronizar Agora' };
  };

  // ✅ Decode nomes
  const decodedFirstName = decodeText(manager.firstName);
  const decodedLastName = decodeText(manager.lastName);
  const decodedDriverName = decodeText(driver.name);
  const decodedNationalityName = decodeText(driver.nationalityName);

  return (
    <div className="min-h-screen bg-[#030712] text-zinc-100 font-sans pb-24 md:pb-12 selection:bg-yellow-500/20 selection:text-yellow-900 relative overflow-x-hidden">
      
      {/* GLOWS - reduzido para performance WebView */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/[0.06] blur-[80px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/[0.04] blur-[80px] rounded-full" />
      </div>

      {/* HEADER - SEM SELETOR DE PISTA */}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/10 bg-[#0a0f1f]/80 p-3 sm:p-4 relative shadow-sm transition-shadow duration-300">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.02] via-transparent to-emerald-500/[0.02] pointer-events-none" />
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 lg:gap-4 relative z-10">
          
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg sm:rounded-xl shadow-[0_4px_12px_rgba(16,185,129,0.15)] shrink-0">
              <User size={14} className="sm:w-4 sm:h-4 text-white" />
            </div>
            <div className="flex flex-col text-left">
              <h1 className="text-[10px] sm:text-[11px] font-black text-white uppercase tracking-widest leading-none mb-0.5 flex items-center gap-2">
                Perfil do Manager
                <span className="text-[10px] sm:text-[8px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-black">PRO</span>
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
              
              <div className="text-right border-l border-white/10 pl-3 sm:pl-4 shrink-0 flex flex-col justify-center">
                <p className="text-[10px] sm:text-[8px] text-slate-400 uppercase font-black tracking-widest leading-none mb-0.5 sm:mb-1">Última Sinc.</p>
                <p className="text-xs sm:text-sm font-black text-emerald-600 leading-none" aria-live="polite" aria-atomic="true">
                  {formatTimeAgo(lastUpdatedReal)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 max-w-[1600px] mx-auto space-y-5 animate-fadeIn relative z-10" aria-busy={isSyncing}>
        {/* Status global sincronização - aria-live */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {isSyncing ? 'Sincronizando dados com GPRO' : syncStatus === 'success' ? 'Sincronização concluída' : syncStatus === 'error' && syncError ? `Erro: ${syncError}` : ''}
        </div>
        {/* Banner integrado quando ambos ausentes - diferencia estados */}
        {(!menuData && !officeData) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center" role="status" aria-live="polite">
            <p className="text-sm font-black text-amber-800">{syncStatus === 'error' && syncError ? syncError : isSyncing ? 'Sincronizando dados da GPRO...' : 'Este módulo ainda não recebeu dados da GPRO. Configure sua integração e sincronize.'}</p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2 justify-center">
              <button onClick={handleSync} disabled={isSyncing} aria-label="Sincronizar dados da GPRO" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                {isSyncing ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Zap size={14} aria-hidden />} {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
              </button>
              <a href="/dashboard/configuracoes/integracao" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white border border-white/10 px-6 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">Configurar Integração</a>
            </div>
            {(!menuData || !officeData) && <p className="mt-2 text-xs font-bold text-amber-700">Algumas informações estão disponíveis. Tente atualizar os módulos pendentes.</p>}
          </div>
        )}
        
        {/* HERO - Gerente + Piloto */}
        <ManagerHero
          manager={manager}
          driver={driver}
          decodedFirstName={decodedFirstName}
          decodedLastName={decodedLastName}
          decodedDriverName={decodedDriverName}
          decodedNationalityName={decodedNationalityName}
          avatarUrl={avatarUrl}
          isUploading={isUploading}
          onAvatarClick={() => !isUploading && fileInputRef.current?.click()}
          getFlagUrl={getFlagUrl}
          formatCash={formatCash}
        />
        <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" aria-hidden />

                {/* RACE STATUS STRIP - Campeonato | Próxima | Clima */}
        <RaceStatusStrip
          championship={championship}
          nextRace={nextRace}
          weather={weather}
          getFlagUrlTrack={(n)=> TRACK_FLAGS[n] ? "/flags/"+TRACK_FLAGS[n]+".png" : null}
          officeData={officeData}
          getOfficeEmptyState={getOfficeEmptyState}
          isSyncing={isSyncing}
          onSync={handleSync}
        />

                {/* RESUMO PILOTO + CARRO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DriverSummary driver={driver} />
          <CarHealthCard car={car} />
        </div>

                {/* TECH DIRECTOR + STAFF */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TechDirectorCard techDirector={techDirector} />
          <StaffCard staffFacilities={staffFacilities} />
        </div>

                {/* FOOTER */}
        <div className="text-center text-[9px] font-mono text-slate-400 space-y-1 pt-4 border-t border-white/10/50" role="contentinfo" aria-live="polite">
          <p>ÚLTIMA SINCRONIZAÇÃO EM {lastUpdatedReal ? new Date(lastUpdatedReal).toLocaleString() : 'Sincronização não identificada'}</p>
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