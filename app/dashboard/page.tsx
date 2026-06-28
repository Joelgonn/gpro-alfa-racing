'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '../context/GameContext';
import { supabase } from '../lib/supabase';
import { saveUserState, getUserState } from '../lib/db';
import he from 'he';
import {
  User, Car, Zap, Activity, MapPin,
  RefreshCw, Loader2, ChevronDown, ShieldCheck, Cpu, Search, X,
  Lock, Unlock, Edit3, Briefcase, Users, History,
  Gauge, Flame, Target, Star, Trophy, Medal, Award, Calendar, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- MAPEAMENTO DE BANDEIRAS ---
const TRACK_FLAGS: { [key: string]: string } = {
  "Adelaide": "au", "Ahvenisto": "fi", "Anderstorp": "se", "Austin": "us", "Avus": "de", "A1-Ring": "at",
  "Baku City": "az", "Barcelona": "es", "Brands Hatch": "gb", "Brasilia": "br", "Bremgarten": "ch", "Brno": "cz", "Bucharest Ring": "ro", "Buenos Aires": "ar",
  "Catalunya": "es", "Dijon-Prenois": "fr", "Donington": "gb",
  "Estoril": "pt", "Fiorano": "it", "Fuji": "jp",
  "Grobnik": "hr",
  "Hockenheim": "de", "Hungaroring": "hu",
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
// COMPONENTES DE CARDS DE INFORMAÇÃO
// ============================================

// --- CARD DO GERENTE ---
function ManagerCard({ menuData }: { menuData: any }) {
  if (!menuData) return null;

  const displayName = menuData.fullName || menuData.fName || 'N/A';
  const displayGroup = menuData.group || 'Rookie';
  const displayStatus = menuData.status || menuData.accStatus || 'N/A';

  const formatCurrency = (value: any) => {
    if (value === null || value === undefined || value === '') return '$0';
    return `$${Number(value).toLocaleString('en-US')}`;
  };

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 p-5 h-full flex flex-col justify-between transition-all duration-300 hover:border-emerald-500/30 hover:shadow-[0_10px_25px_rgba(148,163,184,0.15)] relative overflow-hidden group shadow-sm">
      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full pointer-events-none transition-all group-hover:bg-emerald-500/10" />
      
      <div>
        <div className="flex items-start gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-white font-black text-xl shrink-0 shadow-[0_4px_12px_rgba(148,163,184,0.2)]">
            {displayName.charAt(0).toUpperCase()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-base font-black text-slate-900 truncate">
                {he.decode(displayName)}
              </h4>
              <span className="bg-emerald-50 px-2.5 py-0.5 rounded-full text-[10px] font-black text-emerald-600 border border-emerald-200">
                GERENTE
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <span className="bg-slate-100 px-2.5 py-0.5 rounded flex items-center gap-1 text-slate-700 font-bold">
                <span className="text-amber-500">🏆</span>
                {he.decode(displayGroup)}
              </span>
              <span className="w-px h-3 bg-slate-200" />
              <span className="text-[10px] font-mono text-slate-500 font-bold">ID: {menuData.id || menuData.IDM || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-3">
          <div className="bg-[#f8fafc] rounded-xl px-3 py-2 border border-slate-100 flex flex-col justify-center">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <DollarSign size={8} className="text-emerald-500" /> Saldo em Caixa
            </span>
            <div className="text-xs font-mono font-black text-emerald-600 truncate">
              {formatCurrency(menuData.cash)}
            </div>
          </div>

          <div className="bg-[#f8fafc] rounded-xl px-3 py-2 border border-slate-100 flex flex-col justify-center">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <Zap size={8} className="text-slate-500" /> Créditos GPRO
            </span>
            <div className="text-xs font-mono font-black text-slate-800">
              {menuData.credits !== undefined ? menuData.credits : '0'}
            </div>
          </div>

          <div className="bg-amber-50/70 rounded-xl px-3 py-2 border border-amber-200 flex flex-col justify-center">
            <span className="text-[7px] font-black text-amber-600 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <Award size={8} className="text-amber-500" /> Status da Conta
            </span>
            <div className="text-xs font-black text-amber-600 truncate">
              {he.decode(displayStatus).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mt-1 border-t border-slate-100 pt-3">
        <div className="bg-[#f8fafc] rounded-xl p-2.5 border border-slate-150 flex items-center justify-between">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Grupo Atual</span>
          <span className="text-xs font-black text-slate-800">{he.decode(displayGroup)}</span>
        </div>
        <div className="bg-[#f8fafc] rounded-xl p-2.5 border border-slate-150 flex items-center justify-between">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Registro ID</span>
          <span className="text-xs font-mono font-black text-slate-800">{menuData.id || menuData.IDM || 'N/A'}</span>
        </div>
      </div>
    </div>
  );
}

// --- CARD DO PILOTO (DADOS IMUTÁVEIS) - COM AVATAR GPRO OFICIAL ---
function DriverStaticCard({ driverStatic }: { driverStatic: any }) {
  if (!driverStatic) return null;

  const displayName = driverStatic.name || driverStatic.driName || 'N/A';
  const displayNationality = driverStatic.nationality || 'N/A';
  const displayNationalityName = driverStatic.nationalityName || '';
  
  // ✅ CAMPOS DO GPRO PARA O AVATAR - CORRIGIDO
  const faceSVG = driverStatic.faceSVG || driverStatic.faceImg || '';
  const background = driverStatic.background || driverStatic.driBackground || '';
  const backgroundUrl = background 
    ? `https://www.gpro.net/images/driverface_backgrounds/${background}`
    : '';

  const formatValue = (value: any, fallback: string = '0') => {
    if (value === null || value === undefined || value === '') return fallback;
    return value;
  };

  const formatCurrency = (value: any) => {
    if (value === null || value === undefined || value === '') return '$0';
    return `$${Number(value).toLocaleString('en-US')}`;
  };

  // Stats principais
  const mainStats = [
    { label: 'Trophies', value: driverStatic.trophies, icon: '🏆', gold: true },
    { label: 'Wins', value: driverStatic.wins, icon: '🥇', gold: true },
    { label: 'Podiums', value: driverStatic.podiums, icon: '🥉', gold: true },
    { label: 'Points', value: driverStatic.points, icon: '⭐', gold: false },
  ];

  const secondaryStats = [
    { label: 'Poles', value: driverStatic.poles, icon: '🚀' },
    { label: 'Fast Laps', value: driverStatic.fastLaps, icon: '⚡' },
  ];

  // ✅ PEGA A BANDEIRA DO PAÍS USANDO O MESMO SISTEMA DAS PISTAS
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

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 p-5 h-full flex flex-col justify-between transition-all duration-300 hover:border-emerald-500/30 hover:shadow-[0_10px_25px_rgba(148,163,184,0.15)] relative overflow-hidden group shadow-sm">
      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full pointer-events-none transition-all group-hover:bg-emerald-500/10" />

      <div>
        {/* HEADER: Avatar + Nome + Nacionalidade */}
        <div className="flex items-start gap-4 mb-5">
          {/* ✅ Avatar do Piloto com SVG e Background do GPRO */}
          <div className="relative shrink-0">
            <div 
              className="w-14 h-14 rounded-full overflow-hidden border-2 border-emerald-200 shadow-[0_4px_12px_rgba(16,185,129,0.25)] bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none',
                backgroundColor: !backgroundUrl ? 'transparent' : 'transparent'
              }}
            >
              {faceSVG ? (
                <div 
                  className="w-full h-full flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: faceSVG }}
                />
              ) : (
                // Fallback: iniciais do piloto
                <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-2xl">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              
              {/* Bandeira do país sobreposta no canto inferior direito */}
              {displayNationality && getFlagUrl(displayNationality) && (
                <div className="absolute -bottom-1 -right-1 w-6 h-4 rounded-full border-2 border-white shadow-sm overflow-hidden">
                  <img 
                    src={getFlagUrl(displayNationality)!} 
                    alt={displayNationality}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Nome e informações básicas */}
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-black text-slate-900 truncate">
              {he.decode(displayName)}
            </h4>
            
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <span className="bg-slate-100 px-2.5 py-0.5 rounded text-slate-700 font-bold">
                {he.decode(displayNationalityName) || displayNationality}
              </span>
              
              <span className="w-px h-3 bg-slate-200" />
              
              <span className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/50">
                <span className="text-emerald-600 font-black">{driverStatic.overall?.toFixed(1) || '0'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Cards de informação - Salário, Contrato, Total Corridas */}
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          <div className="bg-[#f8fafc] rounded-xl px-3 py-2 border border-slate-100 flex flex-col justify-center">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <DollarSign size={8} className="text-slate-400" /> Salário Corrida
            </span>
            <div className="text-xs font-mono font-black text-slate-800 truncate">
              {formatCurrency(driverStatic.salary)}
            </div>
          </div>

          <div className="bg-[#f8fafc] rounded-xl px-3 py-2 border border-slate-100 flex flex-col justify-center">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <Calendar size={8} className="text-slate-400" /> Contrato Restante
            </span>
            <div className="text-xs font-mono font-black text-slate-800">
              {formatValue(driverStatic.racesLeft)} R
            </div>
          </div>

          <div className="bg-[#f8fafc] rounded-xl px-3 py-2 border border-slate-100 flex flex-col justify-center">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
              <Trophy size={8} className="text-amber-500" /> Total Corridas
            </span>
            <div className="text-xs font-mono font-black text-slate-800">
              {formatValue(driverStatic.races)}
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Estatísticas - 6 colunas */}
      <div className="grid grid-cols-6 gap-1.5 mt-1 border-t border-slate-100 pt-3">
        {mainStats.map((stat) => (
          <div 
            key={stat.label} 
            className={`rounded-lg p-1.5 text-center border flex flex-col justify-between min-h-[48px] ${
              stat.gold 
                ? 'bg-amber-500/5 border-amber-500/10 text-amber-700' 
                : 'bg-[#f8fafc] border-slate-100 text-slate-700'
            }`}
          >
            <div className="text-[10px]">{stat.icon}</div>
            <div className={`text-[10px] font-mono font-black mt-0.5 ${stat.gold ? 'text-amber-600' : 'text-slate-800'}`}>
              {formatValue(stat.value)}
            </div>
            <div className="text-[5px] font-black text-slate-400 uppercase tracking-wider truncate">
              {stat.label}
            </div>
          </div>
        ))}
        {secondaryStats.map((stat) => (
          <div key={stat.label} className="bg-[#f8fafc] rounded-lg p-1.5 text-center border border-slate-100 flex flex-col justify-between min-h-[48px]">
            <div className="text-[10px]">{stat.icon}</div>
            <div className="text-[10px] font-mono font-black text-slate-700 mt-0.5">
              {formatValue(stat.value)}
            </div>
            <div className="text-[5px] font-black text-slate-400 uppercase tracking-wider truncate">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// SELETOR DE PISTA - COM Z-INDEX ALTO E OVERFLOW VISIBLE
// ============================================
function TrackSelector({ currentTrack, tracksList, onSelect, placeholder = "SELECIONAR PISTA" }: { currentTrack: string, tracksList: any[], onSelect: (t: string) => void, placeholder?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false); }
        document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const filteredTracks = useMemo(() => {
        return tracksList.filter((track: any) => {
            const name = typeof track === 'object' ? (track.name || "") : (track || "");
            return name.toLowerCase().includes(search.toLowerCase());
        });
    }, [tracksList, search]);

    return (
        <div className="relative z-[9999]" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="
                    flex items-center gap-2 sm:gap-2.5 
                    text-[9px] sm:text-xs 
                    text-slate-800 font-black tracking-wider 
                    hover:text-emerald-600 transition-all duration-300 
                    outline-none group 
                    bg-white px-2.5 py-1.5 sm:px-3.5 sm:py-2 
                    rounded-lg sm:rounded-xl 
                    border border-slate-200 
                    active:scale-[0.98] 
                    shadow-sm hover:shadow-md 
                    min-w-[100px] sm:min-w-[140px]
                    truncate
                "
            >
                <span className="truncate text-[9px] sm:text-xs">
                    {currentTrack !== "Selecionar Pista" ? he.decode(currentTrack).toUpperCase() : placeholder}
                </span>
                <ChevronDown 
                    className={`
                        transition-transform duration-300 
                        text-slate-400 group-hover:text-emerald-600 
                        ${isOpen ? 'rotate-180' : ''}
                        w-3 h-3 sm:w-4 sm:h-4
                    `} 
                    size={14} 
                />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -10 }} 
                        className="absolute top-full left-0 mt-2 w-[240px] sm:w-64 bg-white border border-slate-200 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden z-[99999]"
                    >
                        <div className="p-2 sm:p-3 border-b border-slate-100 bg-slate-50">
                            <div className="relative">
                                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    autoFocus 
                                    type="text" 
                                    placeholder="Buscar pista..." 
                                    value={search} 
                                    onChange={(e) => setSearch(e.target.value)} 
                                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 outline-none font-bold uppercase tracking-wider" 
                                />
                                {search && (
                                    <button 
                                        onClick={() => setSearch('')} 
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="max-h-[200px] sm:max-h-[220px] overflow-y-auto custom-scrollbar p-1.5 space-y-0.5 bg-white">
                            {filteredTracks.map((track: any) => {
                                const name = typeof track === 'object' ? track.name : track;
                                return (
                                    <button
                                        key={name}
                                        onClick={() => { onSelect(name); setIsOpen(false); setSearch(""); }}
                                        className={`
                                            w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 
                                            rounded-lg text-[9px] sm:text-xs 
                                            font-black uppercase tracking-wider 
                                            flex items-center justify-between group transition-all
                                            ${currentTrack === name 
                                                ? 'bg-emerald-600 text-white' 
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-2 sm:gap-2.5">
                                            {TRACK_FLAGS[name] ? (
                                                <img src={`/flags/${TRACK_FLAGS[name]}.png`} alt={name} className="w-3 h-2 sm:w-4 sm:h-2.5 object-cover rounded-sm shadow-sm" />
                                            ) : (
                                                <div className="w-3 h-2 sm:w-4 sm:h-2.5 bg-slate-100 rounded-sm border border-slate-200"></div>
                                            )}
                                            <span className="truncate max-w-[120px] sm:max-w-none">{he.decode(name)}</span>
                                        </div>
                                        {currentTrack === name && <ShieldCheck size={12} className="shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================
// SUBCOMPONENTES
// ============================================

function TelemetryInput({ label, value, max, onChange, disabled, isEnergy }: any) {
  const safeValue = value ?? 0;
  const pct = Math.min(100, (safeValue / max) * 100);
  return (
    <div className={`flex items-center justify-between h-8 rounded-lg px-2 group transition-all duration-200 ${disabled ? 'opacity-50' : 'hover:bg-slate-50'}`}>
      <label className={`text-[9px] font-black uppercase tracking-wider truncate w-24 flex items-center gap-1.5 ${disabled ? 'text-slate-400' : 'text-slate-600 group-hover:text-emerald-600 transition-colors'}`}>
        {isEnergy && <Zap size={10} className={pct > 50 ? "text-emerald-500" : "text-amber-500 animate-pulse"} />}
        {label}
      </label>
      <div className={`flex-1 mx-3 h-1 rounded-full overflow-hidden flex relative ${disabled ? 'bg-slate-100' : 'bg-slate-100'}`}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-full rounded-full ${disabled ? 'bg-slate-300' : 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]'}`} />
      </div>
      <input disabled={disabled} type="number" value={safeValue} onChange={onChange} className="w-10 h-6 bg-[#f8fafc] text-center text-[11px] font-mono font-black rounded border border-slate-200 text-slate-800 outline-none focus:border-emerald-500 focus:bg-white disabled:border-transparent transition-all" />
    </div>
  )
}

function CarRow({ part, finalWear, onLvl, onWear, disabled }: any) {
  const wearColor = part.wear > 80 ? "text-rose-500" : part.wear > 50 ? "text-amber-500" : "text-emerald-600";
  const finalWearColor = (finalWear || 0) > 90 ? "text-rose-600 bg-rose-50 border-rose-200 shadow-[0_0_15px_rgba(225,29,72,0.05)]" : "text-slate-800 bg-emerald-50/50 border-emerald-200/60";

  return (
    <div className={`flex items-center justify-between h-8 rounded-lg px-2 group transition-all duration-200 ${disabled ? 'opacity-60' : 'hover:bg-slate-50'}`}>
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider w-24 truncate group-hover:text-slate-800 transition-colors">{part.name}</span>
      <div className="flex items-center gap-2">
        <input disabled={disabled} type="number" value={part.lvl} onChange={(e) => onLvl(Number(e.target.value))} className="w-9 h-6 bg-[#f8fafc] border border-slate-200 rounded text-center text-[10px] font-mono font-black text-slate-800 focus:border-emerald-500 focus:bg-white" />
        <input disabled={disabled} type="number" value={part.wear} onChange={(e) => onWear(Number(e.target.value))} className={`w-9 h-6 bg-[#f8fafc] border border-slate-200 rounded text-center text-[10px] font-mono font-black ${wearColor} focus:border-emerald-500 focus:bg-white`} />
        <div className={`w-9 h-6 rounded flex items-center justify-center border font-black font-mono text-[9px] ${finalWearColor}`}>
          {finalWear !== undefined ? finalWear : '--'}
        </div>
      </div>
    </div>
  )
}

function PerformanceMetric({ label, data, test, onTest, disabled }: any) {
  const diff = (data?.carro || 0) - (data?.pista || 0);
  const isOk = diff >= 0;
  const pctPista = Math.min(100, ((data?.pista || 0) / 200) * 100);
  const pctPeça = Math.min(100, ((data?.part || 0) / 200) * 100);
  const pctTeste = Math.min(100 - pctPeça, (test / 200) * 100);

  const gradientColors = {
    power: "from-emerald-50 to-slate-50/20",
    handling: "from-slate-100/50 to-slate-50/20",
    accel: "from-emerald-50 to-slate-50/20"
  };

  const iconMap = {
    power: Zap,
    handling: Gauge,
    accel: Flame
  };
  const Icon = iconMap[label as keyof typeof iconMap] || Activity;
  const colorMap = {
    power: "text-emerald-500",
    handling: "text-slate-500",
    accel: "text-emerald-500"
  };
  const iconColor = colorMap[label as keyof typeof colorMap] || "text-slate-400";

  return (
    <div className={`space-y-2 bg-gradient-to-br ${gradientColors[label as keyof typeof gradientColors] || 'from-slate-50 to-transparent'} p-3 rounded-xl border border-slate-200 ${disabled ? 'opacity-60' : 'hover:border-emerald-200 transition-all duration-300'}`}>
      <div className="flex justify-between items-center text-[10px] font-black uppercase">
        <span className="text-slate-700 flex items-center gap-1.5">
          <Icon size={10} className={iconColor} />
          {label}
          <span className={isOk ? 'text-emerald-600 ml-2 font-black' : 'text-rose-500 ml-2 font-black'}>{diff > 0 ? `+${diff}` : diff}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <div className="text-center flex flex-col items-center">
            <span className="text-[6px] text-slate-400 mb-0.5 font-bold">ESTIMADO</span>
            <input disabled={disabled} type="number" value={test} onChange={(e) => onTest(Number(e.target.value))} className="w-12 h-6 bg-[#f8fafc] border border-slate-200 rounded text-center text-[10px] font-mono font-black text-emerald-600 focus:border-emerald-500 focus:bg-white outline-none" />
          </div>
          <div className="text-center bg-slate-100 px-2 py-0.5 rounded min-w-[32px] ml-1 border border-slate-200">
            <p className="text-[6px] text-slate-500 mb-0.5 font-bold">ALVO</p>
            <p className="text-[10px] text-slate-800 font-mono font-black">{data?.pista || 0}</p>
          </div>
        </div>
      </div>

      <div className="h-1.5 w-full bg-[#f8fafc] rounded-full relative overflow-visible border border-slate-200/50 p-[1px]">
        <div className="h-full bg-slate-300 rounded-l-full" style={{ width: `${pctPeça}%` }} />
        <div className="h-full absolute top-0 bg-gradient-to-r from-emerald-500 to-teal-400" style={{ left: `${pctPeça}%`, width: `${pctTeste}%` }} />

        <div
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3.5 bg-slate-800 shadow-sm z-10 rounded-sm transition-all duration-500"
          style={{ left: `${pctPista}%` }}
        />
      </div>
    </div>
  );
}

// ============================================
// MAIN DASHBOARD
// ============================================
export default function DashboardHome() {
  const router = useRouter();

  const {
    driverStatic,
    driverEditable,
    updateDriverEditable,
    car, updateCar,
    track, updateTrack,
    weather, updateWeather,
    desgasteModifier, updateDesgasteModifier,
    tracksList: contextTracks,
    techDirector, updateTechDirector,
    staffFacilities, updateStaffFacilities,
    testPoints, updateTestPoints,
    isGlobalLoading,
    menuData,
    officeData,
    reloadUserState,
  } = useGame();

  // ✅ ESTADO LOCAL PARA PISTAS
  const [localTracks, setLocalTracks] = useState<string[]>([]);

  // ✅ CARREGA A LISTA DE PISTAS DA API
  useEffect(() => {
    async function loadTracks() {
      try {
        const res = await fetch('/api/python?action=tracks');
        const data = await res.json();
        if (data.tracks) {
          setLocalTracks(data.tracks);
          console.log('✅ Pistas carregadas no Dashboard:', data.tracks.length);
        }
      } catch (error) {
        console.error("❌ Erro ao carregar pistas no Dashboard:", error);
      }
    }
    loadTracks();
  }, []);

  // ✅ COMBINA AS FONTES DE PISTAS
  const tracksList = useMemo(() => {
    if (contextTracks && contextTracks.length > 0) {
      return contextTracks;
    }
    if (localTracks && localTracks.length > 0) {
      return localTracks;
    }
    return ["Selecionar Pista"];
  }, [contextTracks, localTracks]);

  const [performanceData, setPerformanceData] = useState({
    power: { part: 0, test: 0, carro: 0, pista: 0 },
    handling: { part: 0, test: 0, carro: 0, pista: 0 },
    accel: { part: 0, test: 0, carro: 0, pista: 0 },
    zs: { wings: 0, motor: 0, brakes: 0, gear: 0, susp: 0 }
  });
  const [calculatedWear, setCalculatedWear] = useState<number[]>([]);
  const [isPerformanceLoading, setIsPerformanceLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const persistTimerRef = useRef<NodeJS.Timeout | null>(null);
  const calcTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push('/login');
      else setUserId(session.user.id);
    }
    checkSession();
  }, [router]);

  // ============================================
  // PERSISTÊNCIA
  // ============================================

  const persistState = useCallback(async () => {
    if (isGlobalLoading || !userId) return;

    setIsSyncing(true);
    try {
      const body = {
        track,
        driver_editable: {
          concentracao: driverEditable.concentracao,
          talento: driverEditable.talento,
          agressividade: driverEditable.agressividade,
          experiencia: driverEditable.experiencia,
          tecnica: driverEditable.tecnica,
          resistencia: driverEditable.resistencia,
          carisma: driverEditable.carisma,
          motivacao: driverEditable.motivacao,
          reputacao: driverEditable.reputacao,
          peso: driverEditable.peso,
          idade: driverEditable.idade,
          energia: driverEditable.energia,
        },
        car,
        test_points: testPoints,
        tech_director: techDirector,
        staff_facilities: staffFacilities,
        weather,
        desgasteModifier,
      };

      const res = await fetch('/api/python?action=update_state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': userId },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.sucesso && data.oa !== undefined) {
        updateDriverEditable('total', Number(data.oa));
      }
    } catch (e) { console.error("Persist error:", e); }
    finally { setIsSyncing(false); }
  }, [driverEditable, car, testPoints, techDirector, staffFacilities, track, weather, desgasteModifier, isGlobalLoading, userId, updateDriverEditable]);

  useEffect(() => {
    if (isGlobalLoading || !userId) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => persistState(), 2000);
    return () => { if (persistTimerRef.current) clearTimeout(persistTimerRef.current); };
  }, [driverEditable, car, testPoints, techDirector, staffFacilities, track, weather, desgasteModifier, persistState, isGlobalLoading, userId]);

  // ============================================
  // CÁLCULOS
  // ============================================

  const fetchCalculations = useCallback(async () => {
    if (!track || track === "Selecionar Pista" || !userId || isGlobalLoading) return;
    setIsPerformanceLoading(true);
    try {
      const driver = {
        ...driverStatic,
        ...driverEditable,
      };
      
      const resPerf = await fetch('/api/python?action=performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': userId },
        body: JSON.stringify({
          pista: track,
          driver,
          car,
          test_points: testPoints,
          tech_director: techDirector,
          staff_facilities: staffFacilities
        })
      });
      const dataPerf = await resPerf.json();
      if (dataPerf.sucesso && dataPerf.data) setPerformanceData(dataPerf.data);

      const resSetup = await fetch('/api/python?action=setup_calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-id': userId },
        body: JSON.stringify({
          pista: track,
          driver,
          car,
          desgasteModifier,
          tech_director: techDirector,
          staff_facilities: staffFacilities
        })
      });
      const dataSetup = await resSetup.json();
      if (dataSetup.sucesso && dataSetup.data) {
        const wears = [
          dataSetup.data.chassi.wear.desgasteFinal,
          dataSetup.data.motor.wear.desgasteFinal,
          dataSetup.data.asaDianteira.wear.desgasteFinal,
          dataSetup.data.asaTraseira.wear.desgasteFinal,
          dataSetup.data.assoalho.wear.desgasteFinal,
          dataSetup.data.laterais.wear.desgasteFinal,
          dataSetup.data.radiador.wear.desgasteFinal,
          dataSetup.data.cambio.wear.desgasteFinal,
          dataSetup.data.freios.wear.desgasteFinal,
          dataSetup.data.suspensao.wear.desgasteFinal,
          dataSetup.data.eletronicos.wear.desgasteFinal,
        ].map(v => Math.round(Number(v) || 0));
        setCalculatedWear(wears);
      }
    } catch (e) { console.error("Calc error:", e); }
    finally { setIsPerformanceLoading(false); }
  }, [track, driverStatic, driverEditable, car, testPoints, desgasteModifier, techDirector, staffFacilities, userId, isGlobalLoading]);

  useEffect(() => {
    if (track && track !== "Selecionar Pista" && !isGlobalLoading && userId) {
      if (calcTimerRef.current) clearTimeout(calcTimerRef.current);
      calcTimerRef.current = setTimeout(() => fetchCalculations(), 600);
    }
    return () => { if (calcTimerRef.current) clearTimeout(calcTimerRef.current); };
  }, [track, driverStatic, driverEditable, car, testPoints, desgasteModifier, fetchCalculations, isGlobalLoading, userId]);

  // ============================================
  // IMPORTAÇÃO GPRO
  // ============================================

  const applyGproPayload = useCallback((payload: {
    driver_static?: any;
    driver_editable?: any;
    car?: any[];
    techDirector?: any;
    staff?: any;
    weather?: any;
    track?: string;
    test_points?: any;
  }) => {
    if (payload.driver_static) {
      console.log('📊 Dados imutáveis recebidos:', payload.driver_static.name);
    }
    
    if (payload.driver_editable) {
      Object.entries(payload.driver_editable).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          updateDriverEditable(key as any, value as any);
        }
      });
    }

    if (payload.car && Array.isArray(payload.car)) {
      payload.car.forEach((part: any, index: number) => {
        if (part.lvl !== undefined && part.lvl !== null) {
          updateCar(index, 'lvl', Number(part.lvl));
        }
        if (part.wear !== undefined && part.wear !== null) {
          updateCar(index, 'wear', Number(part.wear));
        }
      });
    }

    if (payload.techDirector) {
      updateTechDirector(payload.techDirector);
    }

    if (payload.staff) {
      updateStaffFacilities(payload.staff);
    }

    if (payload.weather) {
      updateWeather(payload.weather);
    }

    if (payload.track && payload.track !== track && payload.track !== "") {
      updateTrack(payload.track);
    }

    if (payload.test_points) {
      updateTestPoints(payload.test_points);
    }
  }, [updateDriverEditable, updateCar, updateTechDirector, updateStaffFacilities, updateWeather, updateTrack, track, updateTestPoints]);

  const handleImportGPRO = async () => {
    setIsImporting(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      const { data: userState, error: fetchError } = await supabase
        .from('user_state')
        .select('gpro_token')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        throw new Error('Erro ao buscar token GPRO: ' + fetchError.message);
      }

      const token = userState?.gpro_token;

      if (!token) {
        alert('Configure o token GPRO em Configurações → Integração GPRO primeiro');
        return;
      }

      const response = await fetch('/api/gpro/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMsg = `Erro ${response.status}`;
        try {
          const errorData = JSON.parse(text);
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erro ao importar dados do GPRO');
      }

      const testPointsFromAPI = {
        power: data.test_points?.power ?? 0,
        handling: data.test_points?.handling ?? 0,
        accel: data.test_points?.accel ?? 0
      };

      const importSnapshot = {
        driver_static: data.driver_static || null,
        driver_editable: data.driver_editable || null,
        car: data.car || null,
        tech_director: data.techDirector || null,
        staff_facilities: data.staff || null,
        weather: data.weather || null,
        track: data.track || null,
        test_points: testPointsFromAPI
      };

      const importTimestamp = new Date().toISOString();

      await saveUserState(user.id, {
        last_import_snapshot: importSnapshot,
        last_import_at: importTimestamp
      });

      applyGproPayload({
        driver_static: data.driver_static,
        driver_editable: data.driver_editable,
        car: data.car,
        techDirector: data.tech_director,
        staff: data.staff,
        weather: data.weather,
        track: data.track,
        test_points: testPointsFromAPI
      });

      await reloadUserState();

      setTimeout(() => {
        fetchCalculations();
      }, 100);

      alert('Dados importados com sucesso do GPRO!');

    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao importar dados do GPRO');
    } finally {
      setIsImporting(false);
    }
  };

  const handleRestoreImportSnapshot = async () => {
    if (!userId) {
      alert('Usuário não autenticado.');
      return;
    }

    setIsRestoring(true);

    try {
      const userState = await getUserState(userId);

      if (!userState || !userState.last_import_snapshot) {
        alert('Nenhum snapshot de importação encontrado. Faça uma importação primeiro.');
        return;
      }

      const snapshot = userState.last_import_snapshot;
      const importDate = userState.last_import_at;

      applyGproPayload({
        driver_static: snapshot.driver_static,
        driver_editable: snapshot.driver_editable,
        car: snapshot.car,
        techDirector: snapshot.tech_director,
        staff: snapshot.staff_facilities,
        weather: snapshot.weather,
        track: snapshot.track,
        test_points: snapshot.test_points
      });

      await reloadUserState();

      setTimeout(() => persistState(), 500);

      alert(`Dados restaurados com sucesso do snapshot de ${importDate ? new Date(importDate).toLocaleString() : 'data desconhecida'}`);

    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao restaurar dados do snapshot');
    } finally {
      setIsRestoring(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (isGlobalLoading) return (
    <div className="flex flex-col h-[100dvh] items-center justify-center bg-[#eef2f6] text-emerald-600 font-mono text-xs gap-4">
      <div className="relative">
        <div className="w-16 h-16 border-2 border-emerald-500/10 rounded-full absolute"></div>
        <Loader2 className="animate-spin w-8 h-8 text-emerald-600" />
      </div>
      <span className="animate-pulse tracking-widest text-emerald-700 font-bold">SINCRONIZANDO TELEMETRIA...</span>
    </div>
  );

  return (
    <div className="min-h-screen pb-32 md:pb-12 bg-[#eef2f6] text-slate-700 font-mono selection:bg-emerald-500/20 relative overflow-hidden">

      {/* GLOWS AMBIENTAIS DE FUNDO MUITO SUAVES */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/[0.02] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-amber-500/[0.01] blur-[120px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/[0.01] blur-[150px] rounded-full" />
      </div>

      <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6 relative z-10">

        {/* HEADER BAR (ICE MODE) - OTIMIZADO PARA MOBILE */}
        <motion.div 
          initial={{ opacity: 0, y: -15 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm sticky top-4 z-50 relative overflow-visible hover:shadow-md transition-shadow duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.02] via-transparent to-emerald-500/[0.02] pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative">
            
            {/* ESQUERDA: FLAG + TRACK + TEMPORADA */}
            <div className="flex items-start sm:items-center gap-3 w-full lg:w-auto">
              {/* Flag */}
              <div className="w-12 h-8 sm:w-16 sm:h-10 bg-white border border-slate-200 rounded-lg sm:rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-sm hover:shadow-md transition-shadow duration-300">
                {track && TRACK_FLAGS[track] ? (
                  <img src={`/flags/${TRACK_FLAGS[track]}.png`} alt={track} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg sm:text-xl">🏁</span>
                )}
              </div>

              {/* Track + Temporada */}
              <div className="flex-1 min-w-0">
                <h2 className="text-[7px] sm:text-[8px] text-slate-400 font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <MapPin size={10} className="text-emerald-500 shrink-0" />
                  <span className="truncate">CIRCUITO SELECIONADO</span>
                </h2>
                
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <TrackSelector 
                    currentTrack={track} 
                    tracksList={tracksList} 
                    onSelect={updateTrack}
                    placeholder="SELECIONAR PISTA"
                  />
                  
                  {officeData && (officeData.season || officeData.seasonNb) && (
                    <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50/80 backdrop-blur-sm px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 hover:border-emerald-200">
                      <Calendar size={12} className="text-amber-500 shrink-0" />
                      <span className="text-[10px] sm:text-sm font-black text-slate-800 whitespace-nowrap">
                        S{officeData.season || officeData.seasonNb || '0'} R{officeData.race || officeData.raceNb || '0'}
                      </span>
                      {officeData.trackName && (
                        <>
                          <span className="hidden sm:block w-px h-4 bg-slate-300" />
                          <span className="hidden sm:block text-[10px] sm:text-xs text-slate-500 font-bold truncate max-w-[120px]">
                            {he.decode(officeData.trackName)}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* DIREITA: BOTÕES DE CONTROLE */}
            <div className="flex items-center justify-between sm:justify-end gap-3 w-full lg:w-auto border-t lg:border-t-0 border-slate-200 pt-3 lg:pt-0">
              
              {/* Grupo de Botões */}
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
                
                {/* Restaurar Snapshot */}
                <button 
                  onClick={handleRestoreImportSnapshot} 
                  disabled={isRestoring} 
                  className="group flex flex-col items-center gap-0.5 active:scale-95 transition-transform"
                  title="Restaurar Snapshot GPRO"
                >
                  <div className={`
                    p-1.5 sm:p-2 rounded-lg border shadow-sm transition-all duration-300
                    ${isRestoring 
                      ? 'animate-spin border-amber-500 text-amber-500 bg-amber-50 shadow-amber-200' 
                      : 'bg-white border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-400 hover:bg-amber-50/50 hover:shadow-md'
                    }
                  `}>
                    <History size={14} className="sm:w-4 sm:h-4" />
                  </div>
                  <span className="text-[6px] sm:text-[7px] font-black tracking-widest text-slate-400 uppercase group-hover:text-amber-500 transition-colors">
                    RESTAURAR
                  </span>
                </button>

                {/* GPRO Sync */}
                <button 
                  onClick={handleImportGPRO} 
                  disabled={isImporting} 
                  className="group flex flex-col items-center gap-0.5 active:scale-95 transition-transform"
                  title="Sincronizar dados direto da GPRO"
                >
                  <div className={`
                    p-1.5 sm:p-2 rounded-lg border shadow-sm transition-all duration-300
                    ${isImporting 
                      ? 'animate-spin border-emerald-500 text-emerald-500 bg-emerald-50 shadow-emerald-200' 
                      : 'bg-white border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-md'
                    }
                  `}>
                    <Zap size={14} className="sm:w-4 sm:h-4" />
                  </div>
                  <span className="text-[6px] sm:text-[7px] font-black tracking-widest text-slate-400 uppercase group-hover:text-emerald-500 transition-colors">
                    GPRO SYNC
                  </span>
                </button>

                {/* Gravar */}
                <button 
                  onClick={persistState} 
                  className="group flex flex-col items-center gap-0.5 active:scale-95 transition-transform"
                  title="Salvar modificações atuais"
                >
                  <div className={`
                    p-1.5 sm:p-2 rounded-lg border shadow-sm transition-all duration-300
                    ${isSyncing 
                      ? 'animate-spin border-emerald-500 text-emerald-600 bg-emerald-50 shadow-emerald-200' 
                      : 'bg-white border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-md'
                    }
                  `}>
                    <RefreshCw size={14} className="sm:w-4 sm:h-4" />
                  </div>
                  <span className="text-[6px] sm:text-[7px] font-black tracking-widest text-slate-400 uppercase group-hover:text-emerald-500 transition-colors">
                    GRAVAR
                  </span>
                </button>
              </div>

              {/* Modo Edição */}
              <button 
                onClick={() => setIsEditMode(!isEditMode)} 
                className={`
                  flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border transition-all duration-300 shadow-sm
                  ${isEditMode 
                    ? 'bg-amber-50 border-amber-300 text-amber-600 font-bold hover:bg-amber-100 hover:border-amber-400 hover:shadow-md' 
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md'
                  }
                `}
              >
                {isEditMode 
                  ? <Unlock size={12} className="text-amber-500 animate-pulse" /> 
                  : <Lock size={12} className="text-slate-400" />
                }
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[6px] font-bold text-slate-400 uppercase">MODO</span>
                  <span className="text-[7px] sm:text-[9px] font-black tracking-wider">
                    {isEditMode ? 'EDIÇÃO' : 'BLOQUEADO'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ==========================================
            ROW 0: CARDS DE INFORMAÇÃO
            ========================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-4 items-stretch">
          {/* Gerente - 4 colunas */}
          <div className="lg:col-span-4 flex flex-col h-full">
            <ManagerCard menuData={menuData} />
          </div>
          {/* Piloto - DADOS IMUTÁVEIS - 4 colunas */}
          <div className="lg:col-span-4 flex flex-col h-full">
            <DriverStaticCard driverStatic={driverStatic} />
          </div>
        </div>

        {/* ==========================================
            ROW 1: TELEMETRIA + CARRO + PERFORMANCE
            ========================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-0">

          {/* COLUNA 1: PILOTO TELEMETRIA (EDITÁVEL) */}
          <div className={`lg:col-span-4 border rounded-2xl p-4.5 backdrop-blur-sm relative transition-all duration-300 flex flex-col h-full ${isEditMode ? 'bg-white border-amber-300 shadow-md shadow-amber-500/5' : 'bg-white/90 border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-emerald-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            {!isEditMode && <div className="absolute top-2 right-2 text-slate-200 opacity-40 pointer-events-none" title="Controle travado. Ative o modo edição."><Lock size={64} /></div>}

            <div className="flex justify-between items-center relative z-10 border-b border-slate-100 pb-2 mb-3">
              <div className="flex items-center gap-2">
                {isEditMode ? <Edit3 size={14} className="text-amber-500 animate-pulse" /> : <Cpu size={14} className="text-slate-400" />}
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Telemetria Piloto</h3>
              </div>
              <div className="bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs font-mono font-black text-emerald-700 shadow-sm" title="Overall Geral Calculado">
                {Number(driverEditable.total).toFixed(1)} OA
              </div>
            </div>

            <div className="flex flex-col gap-0.5 relative z-10">
              <TelemetryInput label="ENERGIA" value={driverEditable.energia} max={100} onChange={(e: any) => updateDriverEditable('energia', Number(e.target.value))} disabled={!isEditMode} isEnergy />
              {['concentracao', 'talento', 'agressividade', 'experiencia', 'tecnica', 'resistencia', 'carisma', 'motivacao', 'reputacao'].map((skill) => (
                <TelemetryInput key={skill} label={skill.toUpperCase()} value={(driverEditable as any)[skill]} max={skill === 'experiencia' ? 300 : 250} onChange={(e: any) => updateDriverEditable(skill as any, Number(e.target.value))} disabled={!isEditMode} />
              ))}
              <div className="flex items-center gap-2 mt-2 border-t border-slate-100 pt-2 text-[11px]">
                <div className="flex-1 flex items-center justify-between bg-slate-50 rounded-xl px-2.5 h-8 border border-slate-200 hover:border-emerald-200 transition-colors">
                  <span className="text-[8px] font-black text-slate-500 uppercase">PESO kg</span>
                  <input disabled={!isEditMode} type="number" value={driverEditable.peso} onChange={(e) => updateDriverEditable('peso', Number(e.target.value))} className="w-8 bg-transparent text-right font-mono font-black text-slate-800 outline-none" />
                </div>
                <div className="flex-1 flex items-center justify-between bg-slate-50 rounded-xl px-2.5 h-8 border border-slate-200 hover:border-emerald-200 transition-colors">
                  <span className="text-[8px] font-black text-slate-500 uppercase">IDADE anos</span>
                  <input disabled={!isEditMode} type="number" value={driverEditable.idade} onChange={(e) => updateDriverEditable('idade', Number(e.target.value))} className="w-8 bg-transparent text-right font-mono font-black text-slate-800 outline-none" />
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA 2: DIAGNÓSTICO DO CARRO */}
          <section className="lg:col-span-4 bg-white/90 border border-slate-200 shadow-sm rounded-2xl overflow-hidden flex flex-col backdrop-blur-sm relative hover:shadow-md hover:border-slate-300 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-emerald-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative bg-slate-50 p-3.5 border-b border-slate-200 flex justify-between items-center mb-1">
              <h3 className="text-[10px] font-black uppercase text-slate-800 tracking-widest flex items-center gap-2"><Car size={14} className="text-emerald-600" /> Desgaste Chassi</h3>
              <div className="flex gap-2 pr-1 text-[8px] font-black text-slate-400 uppercase tracking-wider">
                <span className="w-9 text-center">NVL</span>
                <span className="w-9 text-center">DSG%</span>
                <span className="w-9 text-center text-emerald-600">FIM%</span>
              </div>
            </div>
            <div className="relative p-3.5 pt-1 flex flex-col gap-0.5">
              {car.map((part, idx) => (
                <CarRow key={idx} part={part} finalWear={calculatedWear[idx]} onLvl={(val: number) => updateCar(idx, 'lvl', val)} onWear={(val: number) => updateCar(idx, 'wear', val)} disabled={!isEditMode} />
              ))}
            </div>
          </section>

          {/* COLUNA 3: PERFORMANCE */}
          <section className="lg:col-span-4 bg-white/90 border border-slate-200 rounded-2xl p-4.5 shadow-sm h-full space-y-4 flex flex-col backdrop-blur-sm relative hover:shadow-md hover:border-slate-300 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-emerald-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 relative">
              <div className="p-1 bg-emerald-600 rounded-lg shadow-sm">
                <Activity size={14} className="text-white" />
              </div>
              <h3 className="text-[10px] font-black uppercase text-slate-800 tracking-widest bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Ajuste de Exigência</h3>
            </div>
            {['power', 'handling', 'accel'].map((key) => (
              <PerformanceMetric
                key={key}
                label={key}
                data={(performanceData as any)[key]}
                test={(testPoints as any)[key]}
                onTest={(v: number) => updateTestPoints({ [key]: v })}
                disabled={!isEditMode}
              />
            ))}
          </section>
        </div>

        {/* ==========================================
            ROW 2: STAFF & TECH DIRECTOR
            ========================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-0">

          {/* DIRETOR TÉCNICO */}
          <div className={`border rounded-2xl p-4.5 backdrop-blur-sm relative transition-all duration-300 flex flex-col h-full ${isEditMode ? 'bg-white border-amber-300 shadow-md shadow-amber-500/5' : 'bg-white/90 border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-emerald-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="relative z-10 border-b border-slate-100 pb-2 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase size={14} className={isEditMode ? "text-amber-500 animate-pulse" : "text-slate-400"} />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Diretor Técnico</h3>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500 font-bold">OA: <span className="text-slate-800 font-black">{(techDirector as any).overall || (techDirector as any).tdOA || '0'}</span></span>
                  <span className="text-slate-500 font-bold">${(techDirector as any).salary || (techDirector as any).tdSalary || '0'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span className="font-black text-slate-800">{he.decode((techDirector as any).name || (techDirector as any).tdName || 'Nenhum')}</span>
                <span className="w-px h-3 bg-slate-200" />
                <span>{he.decode((techDirector as any).nationality || (techDirector as any).tdNat || 'N/A')}</span>
                <span className="w-px h-3 bg-slate-200" />
                <span>{(techDirector as any).racesLeft || (techDirector as any).tdRacesLeft || '0'} corridas</span>
              </div>
            </div>

            <div className="flex flex-col gap-0.5 relative z-10">
              <TelemetryInput label="R&D MECÂNICO" value={techDirector.rdMecanico} max={200} onChange={(e: any) => updateTechDirector({ rdMecanico: Number(e.target.value) })} disabled={!isEditMode} />
              <TelemetryInput label="R&D ELETRÔNICO" value={techDirector.rdEletronico} max={200} onChange={(e: any) => updateTechDirector({ rdEletronico: Number(e.target.value) })} disabled={!isEditMode} />
              <TelemetryInput label="R&D AERODINÂMICO" value={techDirector.rdAerodinamico} max={200} onChange={(e: any) => updateTechDirector({ rdAerodinamico: Number(e.target.value) })} disabled={!isEditMode} />
              <TelemetryInput label="EXPERIÊNCIA" value={techDirector.experiencia} max={200} onChange={(e: any) => updateTechDirector({ experiencia: Number(e.target.value) })} disabled={!isEditMode} />
              <TelemetryInput label="PIT COORD" value={techDirector.pitCoord} max={200} onChange={(e: any) => updateTechDirector({ pitCoord: Number(e.target.value) })} disabled={!isEditMode} />
            </div>
          </div>

          {/* STAFF */}
          <div className={`border rounded-2xl p-5 backdrop-blur-sm relative transition-all duration-300 flex flex-col h-full ${isEditMode ? 'bg-white border-amber-300 shadow-md shadow-amber-500/5' : 'bg-white/90 border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.01] via-transparent to-emerald-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="flex justify-between items-center relative z-10 border-b border-slate-100 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Users size={14} className={isEditMode ? "text-amber-500 animate-pulse" : "text-slate-400"} />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800">Equipe de Pessoal (Staff)</h3>
              </div>
            </div>
            <div className="flex flex-col gap-0.5 mt-2 relative z-10">
              <TelemetryInput label="TOLERÂNCIA" value={staffFacilities.toleranciaPressao} max={200} onChange={(e: any) => updateStaffFacilities({ toleranciaPressao: Number(e.target.value) })} disabled={!isEditMode} />
              <TelemetryInput label="CONCENTRAÇÃO" value={staffFacilities.concentracao} max={200} onChange={(e: any) => updateStaffFacilities({ concentracao: Number(e.target.value) })} disabled={!isEditMode} />
            </div>
          </div>

        </div>

      </div>

      {/* Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16, 185, 129, 0.2); }
      `}</style>
    </div>
  );
}