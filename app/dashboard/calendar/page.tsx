'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, Loader2, 
  Zap, Activity, Wind, Timer, 
  Gauge, Move, Sparkles, CalendarDays, ExternalLink, Star, CheckCircle,
  Trophy, Flag, Rocket, Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// --- CONFIGURAÇÃO: IDs DAS PISTAS DO GPRO (para links) ---
const TRACK_IDS: Record<string, string> = {
  "buenos aires": "2", "rafaela oval": "54", "adelaide": "19", "melbourne": "34",
  "a1-ring": "12", "oesterreichring": "24", "baku city": "58", "sakhir": "29",
  "spa": "10", "zolder": "26", "brasilia": "31", "interlagos": "1",
  "montreal": "6", "shanghai": "33", "grobnik": "59", "brno": "41",
  "jyllands-ringen": "60", "ahvenisto": "47", "magny cours": "7", "paul ricard": "25",
  "avus": "56", "hockenheim": "17", "nurburgring": "21", "serres": "53",
  "hungaroring": "9", "irungattukottai": "43", "new delhi": "48", "fiorano": "32",
  "monza": "11", "mugello": "28", "fuji": "37", "suzuka": "13",
  "kaunas": "50", "sepang": "15", "mexico city": "22", "monte carlo": "4",
  "zandvoort": "27", "poznan": "42", "estoril": "18", "portimao": "49",
  "losail": "63", "bucharest ring": "45", "sochi": "55", "imola": "3",
  "jeddah": "61", "singapore": "38", "slovakiaring": "52", "kyalami": "20",
  "yeongam": "44", "barcelona": "5", "jerez": "14", "valencia": "39",
  "anderstorp": "30", "bremgarten": "57", "istanbul": "36", "yas marina": "40",
  "brands hatch": "23", "silverstone": "8", "austin": "51", "indianapolis": "16",
  "indianapolis oval": "46", "laguna seca": "35", "las vegas": "64", "miami": "62"
};

// --- HELPERS ---

// Normaliza texto para garantir matches
const normalizarTexto = (texto: string) => {
  if (!texto) return "";
  return texto.toString().trim().toLowerCase();
};

// Extrai nome da pista do formato "A1-Ring GP (Áustria)"
const extrairNomePista = (trackName: string) => {
  if (!trackName) return "";
  return trackName.replace(/\s*GP\s*\([^)]*\)\s*$/i, '').trim();
};

// Limpa HTML do campo dateEvent
const limparHtml = (texto: string) => {
  if (!texto) return '';
  return String(texto)
    .replace(/<[^>]*>/g, '') // Remove todas as tags HTML
    .replace(/\s+/g, ' ')    // Normaliza espaços
    .trim();
};

// Verifica se a data contém "Hoje" (do HTML original)
const contemHoje = (texto: string) => {
  if (!texto) return false;
  return String(texto).toLowerCase().includes('hoje');
};

// --- HELPER: Cores Vibrantes (Estilo Neon/Pílula) ---
const formatarDadosGPRO = (valor: any) => {
  if (typeof valor === 'number') {
    return { pt: valor.toString(), cor: "bg-zinc-800 text-white border-zinc-700" };
  }

  const t = String(valor || "").toLowerCase().trim();
  
  const mapa: Record<string, { pt: string; cor: string }> = {
    "very low": { pt: "Muito Baixa", cor: "bg-emerald-500 text-black font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)] border-emerald-400" },
    "low": { pt: "Baixo", cor: "bg-lime-400 text-black font-bold shadow-[0_0_15px_rgba(163,230,53,0.4)] border-lime-300" },
    "easy": { pt: "Fácil", cor: "bg-lime-400 text-black font-bold border-lime-300" },
    "very soft": { pt: "Muito Macia", cor: "bg-emerald-500 text-black font-bold border-emerald-400" },
    "soft": { pt: "Macia", cor: "bg-lime-400 text-black font-bold border-lime-300" },
    "medium": { pt: "Médio", cor: "bg-amber-400 text-black font-bold shadow-[0_0_15px_rgba(251,191,36,0.3)] border-amber-300" },
    "normal": { pt: "Normal", cor: "bg-amber-400 text-black font-bold border-amber-300" },
    "high": { pt: "Alto", cor: "bg-orange-500 text-white font-bold border-orange-400" },
    "very high": { pt: "Muito Alto", cor: "bg-rose-600 text-white font-bold shadow-[0_0_15px_rgba(225,29,72,0.5)] border-rose-500" },
    "very elevated": { pt: "Muito Elevado", cor: "bg-rose-600 text-white font-bold border-rose-500" },
    "difficult": { pt: "Difícil", cor: "bg-orange-500 text-white font-bold border-orange-400" },
    "very difficult": { pt: "Muito Difícil", cor: "bg-rose-600 text-white font-bold border-rose-500" },
    "hard": { pt: "Dura", cor: "bg-orange-500 text-white font-bold border-orange-400" },
    "very hard": { pt: "Muito Dura", cor: "bg-rose-600 text-white font-bold border-rose-500" },
  };

  return mapa[t] || { pt: valor, cor: "bg-zinc-800/80 text-zinc-300 border border-white/5" };
};

export default function CalendarioOficialGPRO() {
  const [loading, setLoading] = useState(true);
  const [allTracks, setAllTracks] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  
  // --- DADOS OFICIAIS DA GPRO ---
  const [currentSeason, setCurrentSeason] = useState<any[]>([]);
  const [nextSeason, setNextSeason] = useState<any[]>([]);
  const [currentTestTrack, setCurrentTestTrack] = useState<{name: string, id: string} | null>(null);
  const [nextTestTrack, setNextTestTrack] = useState<{name: string, id: string} | null>(null);
  const [currentRaceIndex, setCurrentRaceIndex] = useState<number>(-1);
  const [groupName, setGroupName] = useState<string>("");
  
  // --- TABS ---
  const [activeTab, setActiveTab] = useState<'current' | 'next'>('current');

  useEffect(() => {
    let mounted = true;

    async function carregarDados() {
      try {
        // 1. Busca sessão do usuário
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id ?? null;
        
        if (!mounted) return;
        setUserId(currentUserId);

        // 2. Busca calendário (com userId)
        const url = currentUserId 
          ? `/api/calendar?userId=${currentUserId}`
          : '/api/calendar';
        
        const res = await fetch(url);
        const apiData = await res.json();
        
        if (!mounted) return;
        
        if (apiData.sucesso) {
          const tracks = apiData.tracks || [];
          setAllTracks(tracks);
          
          // 3. Processa o calendário da GPRO
          if (apiData.calendarRaw?.events) {
            const events = apiData.calendarRaw.events;
            
            // Separa eventos em corridas e teste
            const raceEvents = events.filter((e: any) => e.eventType === 'R');
            const testEvents = events.filter((e: any) => e.eventType === 'T' || e.eventType === 'Test');
            
            // Mapeia corridas
            const mappedRaces = raceEvents.map((event: any, index: number) => {
              const trackName = extrairNomePista(event.trackName || '');
              const trackData = tracks.find((t: any) => 
                normalizarTexto(t.name) === normalizarTexto(trackName)
              );
              
              const rawDate = event.dateEvent || '';
              const cleanDate = limparHtml(rawDate);
              const isToday = contemHoje(rawDate);
              
              return {
                race: Number(event.idx || index + 1),
                trackId: String(event.trackId || ''),
                trackName: trackName,
                trackFullName: event.trackName || '',
                date: cleanDate,
                dateRaw: rawDate,
                isToday: isToday,
                current: Boolean(event.isCurrentRace),
                favorite: Boolean(event.isFavTrack),
                natCode: event.trackNatCode || '',
                ...trackData
              };
            });
            
            setCurrentSeason(mappedRaces);
            
            // Encontra a corrida atual
            const currentIdx = mappedRaces.findIndex((r: any) => r.current);
            if (currentIdx !== -1) {
              setCurrentRaceIndex(currentIdx);
            }
            
            // Busca pista de testes atual
            if (testEvents.length > 0) {
              const testEvent = testEvents[0];
              const testName = extrairNomePista(testEvent.trackName || '');
              setCurrentTestTrack({
                name: testName,
                id: String(testEvent.trackId || '')
              });
            } else if (apiData.calendarRaw.testTrackName) {
              // Fallback para o campo testTrackName se existir
              setCurrentTestTrack({
                name: extrairNomePista(apiData.calendarRaw.testTrackName),
                id: String(apiData.calendarRaw.testTrackId || '')
              });
            }
            
            // Busca grupo do usuário
            if (apiData.calendarRaw.group) {
              setGroupName(apiData.calendarRaw.group);
            }
          }
          
          // 4. Processa a próxima temporada
          if (apiData.calendarRaw?.nextSeasonEvents) {
            const nextEvents = apiData.calendarRaw.nextSeasonEvents;
            
            // Separa eventos da próxima temporada
            const nextRaceEvents = nextEvents.filter((e: any) => e.eventType === 'R');
            const nextTestEvents = nextEvents.filter((e: any) => e.eventType === 'T' || e.eventType === 'Test');
            
            // Mapeia corridas da próxima temporada
            const mappedNextRaces = nextRaceEvents.map((event: any, index: number) => {
              const trackName = extrairNomePista(event.trackName || '');
              const trackData = tracks.find((t: any) => 
                normalizarTexto(t.name) === normalizarTexto(trackName)
              );
              
              const rawDate = event.dateEvent || '';
              const cleanDate = limparHtml(rawDate);
              const isToday = contemHoje(rawDate);
              
              return {
                race: Number(event.idx || index + 1),
                trackId: String(event.trackId || ''),
                trackName: trackName,
                trackFullName: event.trackName || '',
                date: cleanDate,
                dateRaw: rawDate,
                isToday: isToday,
                current: false,
                favorite: Boolean(event.isFavTrack),
                natCode: event.trackNatCode || '',
                ...trackData
              };
            });
            
            setNextSeason(mappedNextRaces);
            
            // Busca pista de testes da próxima temporada
            if (nextTestEvents.length > 0) {
              const testEvent = nextTestEvents[0];
              const testName = extrairNomePista(testEvent.trackName || '');
              setNextTestTrack({
                name: testName,
                id: String(testEvent.trackId || '')
              });
            }
          }
        }
      } catch (e) {
        console.error('Erro ao carregar dados:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    
    carregarDados();

    return () => {
      mounted = false;
    };
  }, []);

  const currentRaces = useMemo(() => {
    return currentSeason.map((race, index) => ({
      ...race,
      isHighlight: index === currentRaceIndex
    }));
  }, [currentSeason, currentRaceIndex]);

  // Determina qual pista de testes mostrar baseado na aba ativa
  const activeTestTrack = activeTab === 'current' ? currentTestTrack : nextTestTrack;
  const isNextTest = activeTab === 'next';

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#050507]"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>;

  return (
    <div className="p-4 md:p-8 space-y-8 md:space-y-10 pb-40 font-sans max-w-[1600px] mx-auto text-slate-200">
      
      {/* HEADER */}
      <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/5 p-4 md:p-6 rounded-[24px] md:rounded-[32px] flex flex-col md:flex-row justify-between items-center sticky top-0 z-50 shadow-2xl gap-4 md:gap-0">
        <div className="flex items-center gap-3 md:gap-5 w-full md:w-auto justify-center md:justify-start flex-wrap">
          <CalendarIcon className="text-indigo-400 shrink-0" size={24} />
          <h1 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter text-center">
            Calendário Oficial GPRO
          </h1>
          
          <span className="hidden md:block text-zinc-600">•</span>
          
          {groupName && (
            <span className="text-[9px] md:text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              {groupName}
            </span>
          )}
          
          <span className="text-[9px] md:text-[10px] font-black text-zinc-300 bg-zinc-800/50 px-3 py-1 rounded-full border border-white/5">
            Temporada 111
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Pista de Testes - depende da aba ativa */}
          {activeTestTrack && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
              isNextTest 
                ? 'bg-purple-500/10 border-purple-500/20' 
                : 'bg-amber-500/10 border-amber-500/20'
            }`}>
              <Rocket size={14} className={isNextTest ? 'text-purple-400' : 'text-amber-400'} />
              <span className={`text-[9px] md:text-[10px] font-black uppercase whitespace-nowrap ${
                isNextTest ? 'text-purple-400' : 'text-amber-400'
              }`}>
                {isNextTest ? 'Próximo Teste:' : 'Teste:'} {activeTestTrack.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* BADGE: CORRIDA ATUAL - só mostra na aba atual */}
      {activeTab === 'current' && currentRaceIndex !== -1 && currentSeason[currentRaceIndex] && (
        <div className="flex items-center justify-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-6 py-3 mx-auto w-fit">
          <CheckCircle size={18} className="text-emerald-400" />
          <span className="text-[10px] md:text-xs font-black text-emerald-400 uppercase tracking-widest">
            Próxima Corrida: {currentSeason[currentRaceIndex].trackName}
          </span>
          {currentSeason[currentRaceIndex].isToday ? (
            <span className="text-[9px] font-black text-yellow-400 animate-pulse">
              HOJE
            </span>
          ) : (
            <span className="text-[9px] text-emerald-400/60 font-bold">
              {currentSeason[currentRaceIndex].date}
            </span>
          )}
        </div>
      )}

      {/* TABS */}
      <div className="flex items-center gap-4 border-b border-white/5 pb-4">
        <button
          onClick={() => setActiveTab('current')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'current'
              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Flag size={16} />
          Temporada Atual
        </button>
        {nextSeason.length > 0 && (
          <button
            onClick={() => setActiveTab('next')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'next'
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Rocket size={16} />
            Próxima Temporada
          </button>
        )}
      </div>

      {/* GRID EXIBIÇÃO */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8"
        >
          {(activeTab === 'current' ? currentRaces : nextSeason).map((race, i) => (
            <CardExibicao 
              key={i} 
              index={race.race || i + 1}
              slot={{name: race.trackName, date: race.date, isToday: race.isToday}} 
              allTracks={allTracks}
              isHighlight={race.isHighlight}
              isFavorite={race.favorite}
              trackId={race.trackId}
              isNext={activeTab === 'next'}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* CARD DE TESTES - depende da aba ativa */}
      {activeTestTrack && (
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <Rocket size={18} className={isNextTest ? 'text-purple-400' : 'text-amber-400'} />
            <h2 className={`text-xs font-black uppercase tracking-widest ${
              isNextTest ? 'text-purple-400' : 'text-white'
            }`}>
              {isNextTest ? 'Próxima Pista de Testes' : 'Pista de Testes Ativa'}
            </h2>
            {isNextTest && (
              <span className="text-[8px] font-black text-purple-400/60 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                Inativa
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CardExibicao 
              index={null}
              slot={{name: activeTestTrack.name, date: isNextTest ? "Próxima Temporada" : "Pista Ativa", isToday: false}} 
              allTracks={allTracks} 
              isTest 
              isNextTest={isNextTest}
              trackId={activeTestTrack.id}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CardExibicao({ index, slot, allTracks, isTest = false, isNextTest = false, isHighlight = false, isFavorite = false, trackId = null, isNext = false }: any) {
  // Encontra a pista
  const pista = allTracks.find((t: any) => 
    normalizarTexto(t.name) === normalizarTexto(slot.name)
  );
  
  // Encontra o ID do GPRO para o Link
  const finalTrackId = trackId || (pista ? TRACK_IDS[normalizarTexto(pista.name)] : null);
  const gproUrl = finalTrackId ? `https://www.gpro.net/br/TrackDetails.asp?id=${finalTrackId}` : "#";

  // Determina cor do card
  let cardStyle = 'bg-gradient-to-br from-indigo-900/20 via-zinc-950 to-black border border-white/10 hover:border-indigo-500/30 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]';
  
  if (isTest && isNextTest) {
    cardStyle = 'bg-gradient-to-br from-purple-900/30 via-zinc-950 to-black border border-purple-500/40 shadow-[0_0_40px_rgba(168,85,247,0.1)]';
  } else if (isTest) {
    cardStyle = 'bg-gradient-to-br from-amber-900/20 to-black border border-amber-500/30';
  } else if (isHighlight) {
    cardStyle = 'bg-gradient-to-br from-emerald-900/30 via-zinc-950 to-black border border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.1)]';
  } else if (isFavorite) {
    cardStyle = 'bg-gradient-to-br from-yellow-900/20 via-zinc-950 to-black border border-yellow-500/30';
  } else if (isNext) {
    cardStyle = 'bg-gradient-to-br from-purple-900/20 via-zinc-950 to-black border border-purple-500/20 hover:border-purple-500/30';
  }

  return (
    <motion.div 
      layout 
      className={`relative overflow-hidden rounded-[24px] md:rounded-[32px] transition-all duration-500 group ${cardStyle}`}
    >
      {/* Efeito Glow Topo */}
      <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${isTest && isNextTest ? 'from-purple-500/20' : isTest ? 'from-amber-500/10' : isHighlight ? 'from-emerald-500/20' : isFavorite ? 'from-yellow-500/10' : isNext ? 'from-purple-500/10' : 'from-indigo-500/10'} to-transparent pointer-events-none`} />

      {/* HEADER DO CARD */}
      <div className="relative p-4 md:p-6 flex items-start justify-between z-10">
        <div className="flex items-center gap-3 md:gap-4">
          
          {/* Badge com Bandeira */}
          <a href={gproUrl} target="_blank" rel="noreferrer" className={`flex flex-col items-center justify-center p-1.5 md:p-2 rounded-xl ${isTest ? 'bg-amber-500/10 hover:bg-amber-500/20' : 'bg-white/5 hover:bg-indigo-500/20'} backdrop-blur-md border border-white/5 transition-colors cursor-pointer shrink-0 relative`}>
             <span className={`text-[9px] md:text-[10px] font-black leading-none mb-1 ${isTest && isNextTest ? 'text-purple-400' : isTest ? 'text-amber-500' : isHighlight ? 'text-emerald-400' : isFavorite ? 'text-yellow-400' : isNext ? 'text-purple-400' : 'text-indigo-400'}`}>
               {isTest ? (
                 isNextTest ? "🔮" : "TEST"
               ) : (
                 `#${index}`
               )}
             </span>
             {pista?.flag && pista.flag !== 'xx' && (
                <img 
                  src={`/flags/${pista.flag}.png`} 
                  alt={pista.name} 
                  className="w-7 h-4.5 md:w-8 md:h-5 object-cover rounded shadow-sm"
                  onError={(e) => (e.currentTarget.style.display = 'none')} 
                />
             )}
             {isHighlight && (
               <div className="absolute -top-1 -right-1">
                 <div className="bg-emerald-500 rounded-full p-0.5 shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                   <CheckCircle size={10} className="text-black" />
                 </div>
               </div>
             )}
             {isFavorite && !isHighlight && (
               <div className="absolute -top-1 -right-1">
                 <div className="bg-yellow-500 rounded-full p-0.5 shadow-[0_0_10px_rgba(234,179,8,0.5)]">
                   <Star size={10} className="text-black" fill="black" />
                 </div>
               </div>
             )}
             {(isNext || (isTest && isNextTest)) && !isHighlight && !isFavorite && (
               <div className="absolute -top-1 -right-1">
                 <div className="bg-purple-500 rounded-full p-0.5 shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                   <Clock size={10} className="text-black" />
                 </div>
               </div>
             )}
          </a>

          {/* Nome da Pista */}
          <div className="flex flex-col min-w-0">
            <a href={gproUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 group-hover:opacity-80 transition-opacity">
               <h2 className={`text-xl md:text-2xl font-black uppercase tracking-tighter italic leading-none hover:text-indigo-400 transition-colors cursor-pointer truncate ${isTest && isNextTest ? 'text-purple-400' : isTest ? 'text-amber-400' : isHighlight ? 'text-emerald-400' : isFavorite ? 'text-yellow-400' : isNext ? 'text-purple-400' : 'text-white'}`}>
                 {slot.name || "---"}
               </h2>
               {finalTrackId && <ExternalLink size={12} className="text-zinc-600 group-hover:text-indigo-400 shrink-0" />}
            </a>
            {pista && <span className="text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5 md:mt-1 truncate">GP de {pista.name}</span>}
          </div>
        </div>

        {/* Data */}
        {slot.date && slot.date !== 'TBD' && (
          <div className="flex flex-col items-end shrink-0 pl-2">
             <div className="flex items-center gap-1.5 md:gap-2 bg-white/5 px-2.5 py-1.5 md:px-3 rounded-lg border border-white/5 backdrop-blur-sm shadow-lg">
                <CalendarDays size={12} className="text-zinc-400" />
                {slot.isToday ? (
                  <span className="text-[9px] md:text-[10px] font-black text-yellow-400 animate-pulse uppercase">
                    HOJE
                  </span>
                ) : (
                  <span className="text-[9px] md:text-[10px] font-bold text-zinc-300 uppercase">
                    {slot.date}
                  </span>
                )}
             </div>
          </div>
        )}
      </div>

      {/* CONTEÚDO */}
      <div className="p-4 md:p-6 pt-0 md:pt-2 space-y-5 md:space-y-6 relative z-10">
        {pista ? (
          <>
            <div className="grid grid-cols-3 gap-2">
               <InfoTopo label="Vel. Média" value={pista.avgSpeed} sulfixo="km/h" icon={Gauge} />
               <InfoTopo label="Curvas" value={pista.corners} icon={Move} />
               <InfoTopo label="Pitstop" value={pista.pit} sulfixo="s" icon={Timer} destaque />
            </div>

            <div className="space-y-3 bg-white/5 p-3 md:p-4 rounded-2xl border border-white/5 shadow-inner">
              <Barra label="Potência" value={pista.power} from="from-rose-500" to="to-orange-500" icon={Zap} />
              <Barra label="Dirigibilidade" value={pista.handling} from="from-indigo-500" to="to-cyan-400" icon={Activity} />
              <Barra label="Aceleração" value={pista.accel} from="from-emerald-500" to="to-lime-400" icon={Wind} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Tag label="Apoio Aero" value={pista.downforce} />
              <Tag label="Ultrapassagem" value={pista.overtaking} />
              <Tag label="Suspensão" value={pista.suspension} />
              <Tag label="Aderência" value={pista.grip} />
              <Tag label="Combustível" value={pista.fuel} />
              <Tag label="Desgaste" value={pista.wear} />
              <div className="col-span-3 grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-white/5">
                 <TagMini label="Voltas" value={pista.laps} />
                 <TagMini label="Extensão" value={`${pista.lapLen}km`} />
                 <TagMini label="Distância" value={`${pista.dist}km`} />
              </div>
            </div>
          </>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center opacity-20">
             <div className="w-16 h-16 rounded-full border-2 border-dashed border-white mb-4 animate-spin-slow" />
             <span className="uppercase font-black tracking-widest text-[10px]">Aguardando seleção</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// --- COMPONENTES AUXILIARES ---

function Tag({ label, value }: any) {
  const { pt, cor } = formatarDadosGPRO(value);
  return (
    <div className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all border ${cor}`}>
      <span className="text-[6px] md:text-[7px] uppercase font-black opacity-80 mb-0.5 tracking-wider">{label}</span>
      <span className="text-[9px] md:text-[10px] font-black uppercase text-center leading-none">{pt}</span>
    </div>
  );
}

function TagMini({ label, value }: any) {
  return (
    <div className="flex flex-col items-center justify-center">
      <span className="text-[6px] md:text-[7px] text-zinc-500 uppercase font-bold">{label}</span>
      <span className="text-[9px] md:text-[10px] text-zinc-300 font-bold">{value}</span>
    </div>
  );
}

function Barra({ label, value, from, to, icon: Icon }: any) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-5 md:w-6 flex justify-center"><Icon size={14} className="text-zinc-500" /></div>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-[8px] md:text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{label}</span>
          <span className="text-[8px] md:text-[9px] font-bold text-white">{value}</span>
        </div>
        <div className="h-1.5 md:h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: `${(value / 25) * 100}%` }} 
            className={`h-full bg-gradient-to-r ${from} ${to} rounded-full shadow-[0_0_10px_rgba(255,255,255,0.2)]`} 
          />
        </div>
      </div>
    </div>
  );
}

function InfoTopo({ label, value, sulfixo = "", icon: Icon, destaque }: any) {
  return (
    <div className="bg-black/30 p-2.5 md:p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group hover:bg-white/5 transition-colors">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-tr ${destaque ? 'from-indigo-500' : 'from-zinc-500'} to-transparent`} />
      <Icon size={14} className={`mb-1 md:mb-1.5 ${destaque ? 'text-indigo-400' : 'text-zinc-500'}`} />
      <span className={`text-base md:text-lg font-black italic tracking-tighter ${destaque ? 'text-white' : 'text-zinc-200'}`}>
        {value}<span className="text-[9px] md:text-[10px] not-italic text-zinc-500 ml-0.5 font-bold">{sulfixo}</span>
      </span>
      <span className="text-[5px] md:text-[6px] font-black uppercase tracking-widest text-zinc-600">{label}</span>
    </div>
  );
}