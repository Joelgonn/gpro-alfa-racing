'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { 
  Calendar as CalendarIcon, Loader2, 
  Zap, Activity, Wind, Timer, 
  Gauge, Move, Sparkles, CalendarDays, ExternalLink, Star, CheckCircle,
  Trophy, Flag, Rocket, Clock, Crown
} from 'lucide-react'; 
import Image from 'next/image'; 
import { motion, AnimatePresence } from 'framer-motion';

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

const normalizarTexto = (texto: string) => {
  if (!texto) return "";
  return texto.toString().trim().toLowerCase();
};

const extrairNomePista = (trackName: string) => {
  if (!trackName) return "";
  return trackName.replace(/\s*GP\s*\([^)]*\)\s*$/i, '').trim();
};

const limparHtml = (texto: string) => {
  if (!texto) return '';
  return String(texto)
    .replace(/<[^>]*>/g, '') 
    .replace(/\s+/g, ' ')    
    .trim();
};

const contemHoje = (texto: string) => {
  if (!texto) return false;
  return String(texto).toLowerCase().includes('hoje');
};

const formatarDadosGPRO = (valor: any) => {
  if (typeof valor === 'number') {
    return { pt: valor.toString(), cor: "bg-slate-50 text-slate-800 border-slate-200 shadow-sm" };
  }

  const t = String(valor || "").toLowerCase().trim();
  
  const mapa: Record<string, { pt: string; cor: string }> = {
    "very low": { pt: "Muito Baixa", cor: "bg-emerald-50 text-emerald-700 border-emerald-300 font-black shadow-sm" },
    "low": { pt: "Baixo", cor: "bg-emerald-50 text-emerald-600 border-emerald-250 font-black shadow-sm" },
    "easy": { pt: "Fácil", cor: "bg-emerald-50 text-emerald-600 border-emerald-250 font-black" },
    "very soft": { pt: "Muito Macia", cor: "bg-emerald-50 text-emerald-700 border-emerald-300 font-black" },
    "soft": { pt: "Macia", cor: "bg-emerald-50 text-emerald-600 border-emerald-250 font-black" },
    "medium": { pt: "Médio", cor: "bg-amber-50 text-amber-700 border-amber-300 font-black shadow-sm" },
    "normal": { pt: "Normal", cor: "bg-amber-50 text-amber-700 border-amber-300 font-black" },
    "high": { pt: "Alto", cor: "bg-orange-50 text-orange-700 border-orange-300 font-black" },
    "very high": { pt: "Muito Alto", cor: "bg-rose-50 text-rose-600 border-rose-300 font-black shadow-sm" },
    "very elevated": { pt: "Muito Elevado", cor: "bg-rose-50 text-rose-600 border-rose-300 font-black" },
    "difficult": { pt: "Difícil", cor: "bg-orange-50 text-orange-700 border-orange-300 font-black" },
    "very difficult": { pt: "Muito Difícil", cor: "bg-rose-50 text-rose-600 border-rose-300 font-black" },
    "hard": { pt: "Dura", cor: "bg-orange-50 text-orange-700 border-orange-300 font-black" },
    "very hard": { pt: "Muito Dura", cor: "bg-rose-50 text-rose-600 border-rose-300 font-black" },
  };

  return mapa[t] || { pt: valor, cor: "bg-[#f8fafc] text-slate-600 border border-slate-200" };
};

export default function CalendarioOficialGPRO() {
  const [loading, setLoading] = useState(true);
  const [allTracks, setAllTracks] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [currentSeason, setCurrentSeason] = useState<any[]>([]);
  const [nextSeason, setNextSeason] = useState<any[]>([]);
  const [currentTestTrack, setCurrentTestTrack] = useState<{name: string, id: string} | null>(null);
  const [nextTestTrack, setNextTestTrack] = useState<{name: string, id: string} | null>(null);
  const [currentRaceIndex, setCurrentRaceIndex] = useState<number>(-1);
  const [groupName, setGroupName] = useState<string>("");
  
  const [activeTab, setActiveTab] = useState<'current' | 'next'>('current');

  useEffect(() => {
    let mounted = true;

    async function carregarDados() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id ?? null;
        
        if (!mounted) return;
        setUserId(currentUserId);

        const url = currentUserId 
          ? `/api/calendar?userId=${currentUserId}`
          : '/api/calendar';
        
        const res = await fetch(url);
        const apiData = await res.json();
        
        if (!mounted) return;
        
        if (apiData.sucesso) {
          const tracks = apiData.tracks || [];
          setAllTracks(tracks);
          
          if (apiData.calendarRaw?.events) {
            const events = apiData.calendarRaw.events;
            
            const raceEvents = events.filter((e: any) => e.eventType === 'R');
            const testEvents = events.filter((e: any) => e.eventType === 'T' || e.eventType === 'Test');
            
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
            
            const currentIdx = mappedRaces.findIndex((r: any) => r.current);
            if (currentIdx !== -1) {
              setCurrentRaceIndex(currentIdx);
            }
            
            if (testEvents.length > 0) {
              const testEvent = testEvents[0];
              const testName = extrairNomePista(testEvent.trackName || '');
              setCurrentTestTrack({
                name: testName,
                id: String(testEvent.trackId || '')
              });
            } else if (apiData.calendarRaw.testTrackName) {
              setCurrentTestTrack({
                name: extrairNomePista(apiData.calendarRaw.testTrackName),
                id: String(apiData.calendarRaw.testTrackId || '')
              });
            }
            
            if (apiData.calendarRaw.group) {
              setGroupName(apiData.calendarRaw.group);
            }
          }
          
          if (apiData.calendarRaw?.nextSeasonEvents) {
            const nextEvents = apiData.calendarRaw.nextSeasonEvents;
            
            const nextRaceEvents = nextEvents.filter((e: any) => e.eventType === 'R');
            const nextTestEvents = nextEvents.filter((e: any) => e.eventType === 'T' || e.eventType === 'Test');
            
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

    return () => { mounted = false; };
  }, []);

  const currentRaces = useMemo(() => {
    return currentSeason.map((race, index) => ({
      ...race,
      isHighlight: index === currentRaceIndex
    }));
  }, [currentSeason, currentRaceIndex]);

  const activeTestTrack = activeTab === 'current' ? currentTestTrack : nextTestTrack;
  const isNextTest = activeTab === 'next';

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#eef2f6]">
      <Loader2 className="animate-spin text-amber-500" size={40} />
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-8 md:space-y-10 pb-40 font-mono max-w-[1600px] mx-auto text-slate-700">
      
      {/* HEADER BAR COM TOQUE DOURADO */}
      <div className="bg-white border border-slate-200 p-4 md:p-6 rounded-[24px] md:rounded-[32px] flex flex-col md:flex-row justify-between items-center sticky top-4 z-50 shadow-sm hover:shadow-md transition-all duration-300 gap-4 md:gap-0 hover:border-amber-300/30">
        <div className="flex items-center gap-3 md:gap-5 w-full md:w-auto justify-center md:justify-start flex-wrap">
          <div className="p-2 bg-gradient-to-br from-amber-50 to-emerald-50 rounded-xl border border-amber-200/50 shadow-sm">
            <CalendarIcon className="text-amber-500 shrink-0" size={24} />
          </div>
          <h1 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tighter text-center flex items-center gap-1.5">
            Calendário GPRO
            <Sparkles size={16} className="text-amber-400" />
          </h1>
          
          <span className="hidden md:block text-slate-300">•</span>
          
          {groupName && (
            <span className="text-[10px] md:text-[11px] font-black text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 shadow-sm">
              {groupName}
            </span>
          )}
          
          <span className="text-[10px] md:text-[11px] font-black text-slate-600 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
            Temporada 111
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {activeTestTrack && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm transition-all hover:shadow-md ${
              isNextTest 
                ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 text-indigo-600' 
                : 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 text-amber-600'
            }`}>
              <Rocket size={14} className={isNextTest ? 'text-indigo-500' : 'text-amber-500'} />
              <span className={`text-[10px] md:text-[11px] font-black uppercase whitespace-nowrap ${
                isNextTest ? 'text-indigo-600' : 'text-amber-600'
              }`}>
                {isNextTest ? 'Próximo Teste:' : 'Teste:'} {activeTestTrack.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* BADGE: CORRIDA ATUAL COM TOQUE DOURADO */}
      {activeTab === 'current' && currentRaceIndex !== -1 && currentSeason[currentRaceIndex] && (
        <div className="flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-50 to-amber-50 border border-emerald-200/50 rounded-full px-6 py-3 mx-auto w-fit shadow-sm hover:shadow-md transition-all duration-300">
          <Crown size={18} className="text-amber-500" />
          <span className="text-[11px] md:text-xs font-black text-emerald-600 uppercase tracking-widest">
            Próxima Corrida: {currentSeason[currentRaceIndex].trackName}
          </span>
          {currentSeason[currentRaceIndex].isToday ? (
            <span className="text-[10px] font-black text-amber-500 animate-pulse">
              HOJE
            </span>
          ) : (
            <span className="text-[10px] text-emerald-600/70 font-bold">
              {currentSeason[currentRaceIndex].date}
            </span>
          )}
        </div>
      )}

      {/* TABS COM TOQUE DOURADO */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
        <button
          onClick={() => setActiveTab('current')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] md:text-xs font-black uppercase tracking-widest transition-all duration-300 hover:shadow-md ${
            activeTab === 'current'
              ? 'bg-gradient-to-r from-white to-amber-50/50 border border-amber-300/50 text-amber-700 shadow-sm'
              : 'text-slate-400 bg-slate-50 border border-slate-200 hover:text-amber-600 hover:border-amber-300/30'
          }`}
        >
          <Flag size={16} className={activeTab === 'current' ? 'text-amber-500' : ''} />
          Temporada Atual
        </button>
        {nextSeason.length > 0 && (
          <button
            onClick={() => setActiveTab('next')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] md:text-xs font-black uppercase tracking-widest transition-all duration-300 hover:shadow-md ${
              activeTab === 'next'
                ? 'bg-gradient-to-r from-white to-indigo-50/50 border border-indigo-300/50 text-indigo-700 shadow-sm'
                : 'text-slate-400 bg-slate-50 border border-slate-200 hover:text-indigo-600 hover:border-indigo-300/30'
            }`}
          >
            <Rocket size={16} className={activeTab === 'next' ? 'text-indigo-500' : ''} />
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

      {/* CARD DE TESTES COM TOQUE DOURADO */}
      {activeTestTrack && (
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <Rocket size={18} className={isNextTest ? 'text-purple-500' : 'text-amber-500'} />
            <h2 className={`text-xs font-black uppercase tracking-widest ${
              isNextTest ? 'text-purple-600' : 'text-amber-700'
            }`}>
              {isNextTest ? 'Próxima Pista de Testes' : 'Pista de Testes Ativa'}
            </h2>
            {isNextTest && (
              <span className="text-[9px] font-black text-purple-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 shadow-sm">
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
  const pista = allTracks.find((t: any) => 
    normalizarTexto(t.name) === normalizarTexto(slot.name)
  );
  
  const finalTrackId = trackId || (pista ? TRACK_IDS[normalizarTexto(pista.name)] : null);
  const gproUrl = finalTrackId ? `https://www.gpro.net/br/TrackDetails.asp?id=${finalTrackId}` : "#";

  let cardStyle = 'bg-white border border-slate-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5';
  
  if (isTest && isNextTest) {
    cardStyle = 'bg-gradient-to-br from-indigo-50/50 to-purple-50/50 border border-indigo-300 shadow-sm hover:shadow-md hover:border-indigo-400';
  } else if (isTest) {
    cardStyle = 'bg-gradient-to-br from-amber-50/50 to-yellow-50/50 border border-amber-300 shadow-sm hover:shadow-md hover:border-amber-400';
  } else if (isHighlight) {
    cardStyle = 'bg-gradient-to-br from-emerald-50 to-amber-50/30 border border-emerald-300 shadow-sm hover:shadow-md hover:border-emerald-400';
  } else if (isFavorite) {
    cardStyle = 'bg-gradient-to-br from-amber-50/20 to-yellow-50/20 border border-amber-250 shadow-sm hover:shadow-md hover:border-amber-400';
  } else if (isNext) {
    cardStyle = 'bg-gradient-to-br from-white to-indigo-50/10 border border-slate-200 hover:shadow-md hover:border-indigo-300/50';
  }

  return (
    <motion.div 
      layout 
      className={`relative overflow-hidden rounded-[24px] md:rounded-[32px] transition-all duration-500 group ${cardStyle}`}
    >
      <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${
        isTest && isNextTest ? 'from-indigo-500/10 via-purple-500/5' : 
        isTest ? 'from-amber-500/10 via-yellow-500/5' : 
        isHighlight ? 'from-emerald-500/10 via-amber-500/5' : 
        isFavorite ? 'from-amber-500/8' : 
        isNext ? 'from-indigo-500/8' : 
        'from-slate-100/50'
      } to-transparent pointer-events-none`} />

      {/* HEADER DO CARD */}
      <div className="relative p-4 md:p-6 flex items-start justify-between z-10">
        <div className="flex items-center gap-3 md:gap-4">
          
          {/* Badge com Bandeira */}
          <a href={gproUrl} target="_blank" rel="noreferrer" className={`flex flex-col items-center justify-center p-1.5 md:p-2 rounded-xl border border-slate-200/60 transition-all cursor-pointer shrink-0 relative bg-white shadow-sm hover:shadow-md hover:border-amber-300`}>
             <span className={`text-[10px] md:text-[11px] font-black leading-none mb-1 ${
               isTest && isNextTest ? 'text-indigo-600' : 
               isTest ? 'text-amber-600' : 
               isHighlight ? 'text-emerald-600' : 
               isFavorite ? 'text-amber-600' : 
               isNext ? 'text-indigo-600' : 
               'text-slate-800'
             }`}>
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
                 <div className="bg-emerald-500 rounded-full p-0.5 shadow-sm">
                   <CheckCircle size={10} className="text-white" />
                 </div>
               </div>
             )}
             {isFavorite && !isHighlight && (
               <div className="absolute -top-1 -right-1">
                 <div className="bg-amber-500 rounded-full p-0.5 shadow-sm">
                   <Star size={10} className="text-white fill-white" />
                 </div>
               </div>
             )}
             {(isNext || (isTest && isNextTest)) && !isHighlight && !isFavorite && (
               <div className="absolute -top-1 -right-1">
                 <div className="bg-indigo-500 rounded-full p-0.5 shadow-sm">
                   <Clock size={10} className="text-white" />
                 </div>
               </div>
             )}
          </a>

          {/* Nome da Pista */}
          <div className="flex flex-col min-w-0">
            <a href={gproUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">
               <h2 className={`text-xl md:text-2xl font-black uppercase tracking-tighter italic leading-none hover:text-amber-600 transition-colors cursor-pointer truncate ${
                 isTest && isNextTest ? 'text-indigo-600' : 
                 isTest ? 'text-amber-600' : 
                 isHighlight ? 'text-emerald-600' : 
                 isFavorite ? 'text-amber-600' : 
                 isNext ? 'text-indigo-600' : 
                 'text-slate-800'
               }`}>
                 {slot.name || "---"}
               </h2>
               {finalTrackId && <ExternalLink size={12} className="text-slate-400 group-hover:text-amber-600 shrink-0 transition-colors" />}
            </a>
            {pista && <span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">GP de {pista.name}</span>}
          </div>
        </div>

        {/* Data */}
        {slot.date && slot.date !== 'TBD' && (
          <div className="flex flex-col items-end shrink-0 pl-2">
             <div className="flex items-center gap-1.5 md:gap-2 bg-white px-2.5 py-1.5 md:px-3 rounded-lg border border-slate-200 shadow-sm hover:border-amber-300 transition-colors">
                <CalendarDays size={12} className="text-slate-400" />
                {slot.isToday ? (
                  <span className="text-[10px] md:text-[11px] font-black text-amber-500 animate-pulse uppercase">
                    HOJE
                  </span>
                ) : (
                  <span className="text-[10px] md:text-[11px] font-bold text-slate-600 uppercase">
                    {slot.date}
                  </span>
                )}
             </div>
          </div>
        )}
      </div>

      {/* CONTEÚDO */}
      <div className="p-4 md:p-6 pt-0 md:pt-2 space-y-5 md:space-y-6 relative z-10 bg-white/80 backdrop-blur-sm">
        {pista ? (
          <>
            <div className="grid grid-cols-3 gap-2">
               <InfoTopo label="Vel. Média" value={pista.avgSpeed} sulfixo="km/h" icon={Gauge} />
               <InfoTopo label="Curvas" value={pista.corners} icon={Move} />
               <InfoTopo label="Pitstop" value={pista.pit} sulfixo="s" icon={Timer} destaque />
            </div>

            <div className="space-y-3 bg-gradient-to-br from-slate-50 to-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-inner hover:border-amber-300/30 transition-colors">
              <Barra label="Potência" value={pista.power} from="from-rose-500" to="to-rose-400" icon={Zap} />
              <Barra label="Dirigibilidade" value={pista.handling} from="from-emerald-500" to="to-teal-400" icon={Activity} />
              <Barra label="Aceleração" value={pista.accel} from="from-emerald-500" to="to-teal-400" icon={Wind} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Tag label="Apoio Aero" value={pista.downforce} />
              <Tag label="Ultrapassagem" value={pista.overtaking} />
              <Tag label="Suspensão" value={pista.suspension} />
              <Tag label="Aderência" value={pista.grip} />
              <Tag label="Combustível" value={pista.fuel} />
              <Tag label="Desgaste" value={pista.wear} />
              <div className="col-span-3 grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200">
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

// --- COMPONENTES AUXILIARES COM TOQUE DOURADO ---

function Tag({ label, value }: any) {
  const { pt, cor } = formatarDadosGPRO(value);
  return (
    <div className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all border ${cor} hover:shadow-sm hover:border-amber-300/50`}>
      <span className="text-[7px] md:text-[8px] uppercase font-black opacity-80 mb-0.5 tracking-wider">{label}</span>
      <span className="text-[10px] md:text-[11px] font-black uppercase text-center leading-none">{pt}</span>
    </div>
  );
}

function TagMini({ label, value }: any) {
  return (
    <div className="flex flex-col items-center justify-center">
      <span className="text-[7px] md:text-[8px] text-slate-400 uppercase font-bold">{label}</span>
      <span className="text-[10px] md:text-[11px] text-slate-700 font-bold">{value}</span>
    </div>
  );
}

function Barra({ label, value, from, to, icon: Icon }: any) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-5 md:w-6 flex justify-center"><Icon size={14} className="text-slate-400" /></div>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
          <span className="text-[9px] md:text-[10px] font-bold text-slate-800">{value}</span>
        </div>
        <div className="h-1.5 md:h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: `${(value / 25) * 100}%` }} 
            className={`h-full bg-gradient-to-r ${from} ${to} rounded-full shadow-sm`} 
          />
        </div>
      </div>
    </div>
  );
}

function InfoTopo({ label, value, sulfixo = "", icon: Icon, destaque }: any) {
  return (
    <div className="bg-[#f8fafc] p-2.5 md:p-3 rounded-2xl border border-slate-200 flex flex-col items-center justify-center relative overflow-hidden group hover:shadow-md transition-all duration-300 hover:border-amber-300/50">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-tr ${destaque ? 'from-amber-500' : 'from-slate-500'} to-transparent`} />
      <Icon size={14} className={`mb-1 md:mb-1.5 ${destaque ? 'text-amber-600' : 'text-slate-400'}`} />
      <span className={`text-base md:text-lg font-black italic tracking-tighter ${destaque ? 'text-amber-700' : 'text-slate-800'}`}>
        {value}<span className="text-[10px] md:text-[11px] not-italic text-slate-400 ml-0.5 font-bold">{sulfixo}</span>
      </span>
      <span className="text-[6px] md:text-[7px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    </div>
  );
}