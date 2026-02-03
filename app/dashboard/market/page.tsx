'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { 
  RefreshCw, X, Filter, Trophy, Zap, 
  Activity, Search, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight,
  CheckCircle2, Info, DollarSign, Target, User, ShieldAlert, HeartPulse, Sliders
} from 'lucide-react'; 
import Image from 'next/image'; 
import { motion, AnimatePresence } from 'framer-motion';

// --- TIPAGEM ---
interface MarketDriver { 
    id: number; nome: string; nacionalidade: string; total: number; 
    concentracao: number; talento: number; agressividade: number; 
    experiencia: number; tecnica: number; resistencia: number; 
    carisma: number; motivacao: number; reputacao: number; 
    peso: number; idade: number; salario: number; taxa: number; 
    ofertas: number; nivel: number; favorito: string; 
}

// --- CONSTANTES ---
const TRACK_NAMES_BY_ID: Record<number, string> = { 1: "Interlagos", 2: "Buenos Aires", 3: "Imola", 4: "Monte Carlo", 5: "Barcelona", 6: "Montreal", 7: "Magny Cours", 8: "Silverstone", 9: "Hungaroring", 10: "Spa", 11: "Monza", 12: "A1-Ring", 13: "Suzuka", 14: "Jerez", 15: "Sepang", 16: "Indianapolis", 17: "Hockenheim", 18: "Estoril", 19: "Adelaide", 20: "Kyalami", 21: "Nurburgring", 22: "Mexico City", 23: "Brands Hatch", 24: "Oesterreichring", 25: "Paul Ricard", 26: "Zolder", 27: "Zandvoort", 28: "Mugello", 29: "Sakhir", 30: "Anderstorp", 31: "Brasilia", 32: "Fiorano", 33: "Shanghai", 34: "Melbourne", 35: "Laguna Seca", 36: "Istanbul", 37: "Fuji", 38: "Singapore", 39: "Valencia", 40: "Yas Marina", 41: "Brno", 42: "Poznan", 43:"Irungattukottai", 44: "Yeongam", 45: "Bucharest Ring", 46: "Indianapolis Oval", 47: "Ahvenisto", 48: "New Delhi", 49: "Portimao", 50: "Kaunas", 51: "Austin", 52: "Slovakiaring", 53: "Serres", 54: "Rafaela Oval", 55: "Sochi", 56: "Avus", 57: "Bremgarten", 58: "Baku City", 59: "Grobnik", 60: "Jyllands-Ringen", 61: "Jeddah", 62: "Miami", 63: "Losail", 64: "Las Vegas", };
const INITIAL_FILTERS = { total: { min: 0, max: 300 }, concentracao: { min: 0, max: 300 }, talento: { min: 0, max: 300 }, agressividade: { min: 0, max: 300 }, experiencia: { min: 0, max: 500 }, tecnica: { min: 0, max: 300 }, resistencia: { min: 0, max: 300 }, carisma: { min: 0, max: 300 }, motivacao: { min: 0, max: 300 }, reputacao: { min: 0, max: 300 }, peso: { min: 0, max: 150 }, idade: { min: 0, max: 99 }, salario: { min: 0, max: 200000000 }, taxa: { min: 0, max: 200000000 }, ofertas: { min: 0, max: 100 } };

const ISO3_TO_ISO2_MAP: Record<string, string> = { "ABW": "aw", "AFG": "af", "AGO": "ao", "AIA": "ai", "ALA": "ax", "ALB": "al", "AND": "ad", "ARE": "ae", "ARG": "ar", "ARM": "am", "ASM": "as", "ATA": "aq", "ATF": "tf", "ATG": "ag", "AUS": "au", "AUT": "at", "AZE": "az", "BDI": "bi", "BEL": "be", "BEN": "bj", "BES": "bq", "BFA": "bf", "BGD": "bd", "BGR": "bg", "BHR": "bh", "BHS": "bs", "BIH": "ba", "BLM": "bl", "BLR": "by", "BLZ": "bz", "BMU": "bm", "BOL": "bo", "BRA": "br", "BRB": "bb", "BRN": "bn", "BTN": "bt", "BVT": "bv", "BWA": "bw", "CAF": "cf", "CAN": "ca", "CCK": "cc", "CHE": "ch", "CHL": "cl", "CHN": "cn", "CIV": "ci", "CMR": "cm", "COD": "cd", "COG": "cg", "COK": "ck", "COL": "co", "COM": "km", "CPV": "cv", "CRI": "cr", "CUB": "cu", "CUW": "cw", "CXR": "cx", "CYM": "ky", "CYP": "cy", "CZE": "cz", "DEU": "de", "DJI": "dj", "DMA": "dm", "DNK": "dk", "DOM": "do", "DZA": "dz", "ECU": "ec", "EGY": "eg", "ERI": "er", "ESH": "eh", "ESP": "es", "EST": "ee", "ETH": "et", "FIN": "fi", "FJI": "fj", "FLK": "fk", "FRA": "fr", "FRO": "fo", "FSM": "fm", "GAB": "ga", "GBR": "gb", "GEO": "ge", "GGY": "gg", "GHA": "gh", "GIB": "gi", "GIN": "gn", "GLP": "gp", "GMB": "gm", "GNB": "gw", "GNQ": "gq", "GRC": "gr", "GRD": "gd", "GRL": "gl", "GTM": "gt", "GUF": "gf", "GUM": "gu", "GUY": "gy", "ENG": "gb-eng", "NIR": "gb-nir", "SCO": "gb-sct", "WAL": "gb-wls", "WLS": "gb-wls", "HKG": "hk", "HMD": "hm", "HND": "hn", "HRV": "hr", "HTI": "ht", "HUN": "hu", "IDN": "id", "IMN": "im", "IND": "in", "IOT": "io", "IRL": "ie", "IRN": "ir", "IRQ": "iq", "ISL": "is", "ISR": "il", "ITA": "it", "JAM": "jm", "JEY": "je", "JOR": "jo", "JPN": "jp", "KAZ": "kz", "KEN": "ke", "KGZ": "kg", "KHM": "kh", "KIR": "ki", "KNA": "kn", "KOR": "kr", "KWT": "kw", "LAO": "la", "LBN": "lb", "LBR": "lr", "LBY": "ly", "LCA": "lc", "LIE": "li", "LKA": "lk", "LSO": "ls", "LTU": "lt", "LUX": "lu", "LVA": "lv", "MAC": "mo", "MAF": "mf", "MAR": "ma", "MCO": "mc", "MDA": "md", "MDG": "mg", "MDV": "mv", "MEX": "mx", "MHL": "mh", "MKD": "mk", "MLI": "ml", "MLT": "mt", "MMR": "mm", "MNE": "me", "MNG": "mn", "MNP": "mp", "MOZ": "mz", "MRT": "mr", "MSR": "ms", "MTQ": "mq", "MUS": "mu", "MWI": "mw", "MYS": "my", "MYT": "yt", "NAM": "na", "NCL": "nc", "NER": "ne", "NFK": "nf", "NGA": "ng", "NIC": "ni", "NIU": "nu", "NLD": "nl", "NOR": "no", "NPL": "np", "NRU": "nr", "NZL": "nz", "OMN": "om", "PAK": "pk", "PAN": "pa", "PCN": "pn", "PER": "pe", "PHL": "ph", "PLW": "pw", "PNG": "pg", "POL": "pl", "PRI": "pr", "PRK": "kp", "PRT": "pt", "PRY": "py", "PSE": "ps", "PYF": "pf", "QAT": "qa", "REU": "re", "ROU": "ro", "RUS": "ru", "RWA": "rw", "SAU": "sa", "SDN": "sd", "SEN": "sn", "SGP": "sg", "SGS": "gs", "SHN": "sh", "SJM": "sj", "SLB": "sb", "SLE": "sl", "SLV": "sv", "SMR": "sm", "SOM": "so", "SPM": "pm", "SRB": "rs", "SSD": "ss", "STP": "st", "SUR": "sr", "SVK": "sk", "SVN": "si", "SWE": "se", "SWZ": "sz", "SXM": "sx", "SYC": "sc", "SYR": "sy", "TCA": "tc", "TCD": "td", "TGO": "tg", "THA": "th", "TJK": "tj", "TKL": "tk", "TKM": "tm", "TLS": "tl", "TON": "to", "TTO": "tt", "TUN": "tn", "TUR": "tr", "TUV": "tv", "TWN": "tw", "TZA": "tz", "UGA": "ug", "UKR": "ua", "UMI": "um", "URY": "uy", "USA": "us", "UZB": "uz", "VAT": "va", "VCT": "vc", "VEN": "ve", "VGB": "vg", "VIR": "vi", "VNM": "vn", "VUT": "vu", "WLF": "wf", "WSM": "ws", "XKX": "xk", "YEM": "ye", "ZAF": "za", "ZMB": "zm", "ZWE": "zw" };

// --- HELPERS ---
const getFlagCode = (nationality: string): string => { 
    const code3 = nationality.trim().toUpperCase(); 
    const code2 = ISO3_TO_ISO2_MAP[code3]; 
    if (code2) return code2.toLowerCase(); 
    if (code3.startsWith('BR')) return 'br'; 
    return 'xx'; 
};

const countFavTracks = (favString: string) => { 
    if (!favString || favString === '0' || favString === '""') return 0; 
    const clean = favString.replace(/"/g, ''); 
    return clean.split(/[,;]/).filter(t => t.trim().length > 0 && t.trim() !== '0').length; 
};

// --- COMPONENTES AUXILIARES ---
const SortHeader = ({ label, sortKey, currentSort, onSort, align="center", className="", title }: any) => { 
    const active = currentSort?.key === sortKey; 
    return ( 
        <th 
            onClick={()=>onSort(sortKey)} 
            title={title} 
            className={`p-3 text-${align} border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5 group ${active?'bg-white/[0.02] text-blue-400':'text-slate-500'} ${className} text-[10px] font-black uppercase tracking-widest whitespace-nowrap select-none`}
        > 
            <div className={`flex items-center gap-1.5 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}> 
                {label} 
                <div className={`flex flex-col text-[6px] leading-[6px] transition-opacity ${active ? 'opacity-100' : 'opacity-20 group-hover:opacity-50'}`}> 
                    <span className={active && currentSort.direction === 'asc' ? 'text-blue-400' : ''}>▲</span> 
                    <span className={active && currentSort.direction === 'desc' ? 'text-blue-400' : ''}>▼</span> 
                </div> 
            </div> 
        </th> 
    );
};

const RangeFilter = ({ label, filter, onChange, highlight }: { label: string, filter: any, onChange: any, highlight?: boolean }) => (
    <div className="flex flex-col gap-1.5 group">
        <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${highlight ? 'text-blue-400' : 'text-slate-600'}`}>
            {label}
        </span>
        <div className="flex items-center gap-2 h-12 bg-black/40 rounded-xl border border-white/10 px-3 focus-within:border-blue-500/50 transition-all">
            <input 
                type="number" 
                value={filter.min} 
                onChange={(e)=>onChange('min',Number(e.target.value))} 
                className="w-full bg-transparent text-center text-lg font-black text-white outline-none" 
                placeholder="Min" 
            />
            <div className="h-6 w-px bg-white/10" />
            <input 
                type="number" 
                value={filter.max} 
                onChange={(e)=>onChange('max',Number(e.target.value))} 
                className="w-full bg-transparent text-center text-lg font-black text-white outline-none" 
                placeholder="Max" 
            />
        </div>
    </div>
);

// --- COMPONENTE PRINCIPAL ---
export default function MarketPage() {
    const router = useRouter();
    const [drivers, setDrivers] = useState<MarketDriver[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [sortConfig, setSortConfig] = useState<{ key: keyof MarketDriver; direction: 'asc' | 'desc' } | null>({ key: 'total', direction: 'desc' });
    
    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>('');
    const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({ isOpen: false, title: '', message: '', type: 'success' });

    // Estados de Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;

    // AUTH & DATA LOAD
    useEffect(() => {
        async function init() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/login'); return; }
            setUserId(session.user.id);
            setUserEmail(session.user.email || 'Gerente');
            loadData();
        }
        init();
    }, [router]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/market/update');
            const data = await res.json();
            if(data.success && Array.isArray(data.data)) setDrivers(data.data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleUpdateDatabase = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/market/update', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setModal({ isOpen: true, type: 'success', title: 'Base Sincronizada', message: `${data.count} pilotos importados com sucesso!` });
                await loadData();
            }
        } catch (e) { } finally { setLoading(false); }
    };

    const filteredDrivers = useMemo(() => {
        let result = [...drivers];
        result = result.filter(d => {
            const check = (val: number | undefined, range: {min: number, max: number}) => (val ?? 0) >= range.min && (val ?? 0) <= range.max;
            return ( check(d.total, filters.total) && check(d.talento, filters.talento) && check(d.agressividade, filters.agressividade) && check(d.experiencia, filters.experiencia) && check(d.tecnica, filters.tecnica) && check(d.resistencia, filters.resistencia) && check(d.idade, filters.idade) && check(d.salario, filters.salario) && check(d.ofertas, filters.ofertas) );
        });

        if (sortConfig) {
            result.sort((a, b) => {
                let valA: any = a[sortConfig.key]; let valB: any = b[sortConfig.key];
                if (sortConfig.key === 'favorito') { valA = countFavTracks(String(valA)); valB = countFavTracks(String(valB)); }
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [drivers, filters, sortConfig]);

    // Dados da página atual
    const paginatedDrivers = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredDrivers.slice(start, start + pageSize);
    }, [filteredDrivers, currentPage]);

    const totalPages = Math.ceil(filteredDrivers.length / pageSize);

    const handleSort = (key: keyof MarketDriver) => { 
        setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'desc' ? 'asc' : 'desc' })); 
        setCurrentPage(1); 
    };

    const updateFilter = (key: keyof typeof INITIAL_FILTERS, type: 'min' | 'max', val: number) => { 
        setFilters(prev => ({ ...prev, [key]: { ...prev[key], [type]: val } })); 
        setCurrentPage(1);
    };

    if (!userId) return null;

    return (
        <div className="min-h-screen bg-[#050507] text-slate-300 font-mono flex flex-col overflow-hidden">
            
            {/* Header Sticky */}
            <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/5 bg-[#050507]/80">
                <div className="max-w-[1600px] mx-auto p-4 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                         <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
                            <Trophy size={18} className="text-blue-400" />
                         </div>
                         <div className="hidden sm:block">
                            <h1 className="text-xs font-black text-white uppercase tracking-widest leading-none mb-0.5">Driver Analytics</h1>
                            <p className="text-[9px] text-slate-500 font-bold uppercase">{userEmail}</p>
                         </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Estatísticas de Base - RESTAURADAS */}
                        <div className="hidden md:flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                            <div className="flex flex-col items-center">
                                <span className="text-[8px] text-slate-600 font-black uppercase">Base</span>
                                <span className="text-xs text-white font-black">{drivers.length}</span>
                            </div>
                            <div className="w-px h-4 bg-white/10" />
                            <div className="flex flex-col items-center">
                                <span className="text-[8px] text-blue-500 font-black uppercase">Filtro</span>
                                <span className="text-xs text-blue-400 font-black">{filteredDrivers.length}</span>
                            </div>
                        </div>

                        <button onClick={() => setIsFilterOpen(true)} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all relative">
                            <Filter size={16} className="text-blue-400" />
                            {Object.values(filters).some(f => f.min !== 0) && (
                                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                            )}
                        </button>

                        <button onClick={handleUpdateDatabase} disabled={loading} className="p-3 sm:px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg transition-all flex items-center gap-2 border border-blue-400/20 disabled:opacity-50">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{loading ? 'Sincronizando...' : 'Sincronizar'}</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-hidden flex flex-col relative">
                <div className="flex-1 overflow-auto custom-scrollbar bg-[#050507]">
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead className="sticky top-0 z-30 bg-[#0b0b0e] shadow-xl">
                            <tr>
                                {/* TODAS AS COLUNAS RESTAURADAS */}
                                <SortHeader label="Piloto" sortKey="nome" currentSort={sortConfig} onSort={handleSort} align="left" className="pl-4 sticky left-0 z-40 bg-[#0b0b0e] border-r border-white/10 shadow-[4px_0_10px_rgba(0,0,0,0.5)]" />
                                <SortHeader label="Idade" sortKey="idade" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="OA" sortKey="total" currentSort={sortConfig} onSort={handleSort} className="text-blue-400" />
                                <SortHeader label="Tal" sortKey="talento" currentSort={sortConfig} onSort={handleSort} className="text-amber-400" />
                                <SortHeader label="Agr" sortKey="agressividade" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="Exp" sortKey="experiencia" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="Tec" sortKey="tecnica" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="Res" sortKey="resistencia" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="Car" sortKey="carisma" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="Mot" sortKey="motivacao" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="Rep" sortKey="reputacao" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="Offs" sortKey="ofertas" currentSort={sortConfig} onSort={handleSort} className="text-rose-400" />
                                <SortHeader label="Fav" sortKey="favorito" currentSort={sortConfig} onSort={handleSort} className="text-purple-400" />
                                <SortHeader label="Salário" sortKey="salario" currentSort={sortConfig} onSort={handleSort} align="right" className="pr-6 text-emerald-400" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {paginatedDrivers.map((driver) => {
                                const flagCode = getFlagCode(driver.nacionalidade);
                                const favs = countFavTracks(driver.favorito);
                                
                                return (
                                    <tr key={driver.id} className="group hover:bg-blue-500/[0.03] transition-colors divide-x divide-white/[0.02]">
                                        <td className="p-3 pl-4 sticky left-0 bg-[#050507] group-hover:bg-[#0b0b11] border-r border-white/5 z-20 shadow-[4px_0_10px_rgba(0,0,0,0.3)] transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-6 h-4 shrink-0 shadow-sm overflow-hidden rounded-[2px] border border-white/10">
                                                    <Image src={`/flags/${flagCode}.png`} alt={driver.nacionalidade} fill className="object-cover" />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <a href={`https://www.gpro.net/br/DriverProfile.asp?ID=${driver.id}`} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-white hover:text-blue-400 transition truncate tracking-tight">{driver.nome}</a>
                                                    <span className="text-[8px] text-slate-600 font-bold uppercase tracking-tighter">ID {driver.id} | {driver.nacionalidade}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center text-slate-400 text-xs font-bold">{driver.idade}</td>
                                        <td className="p-3 text-center"><span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md border border-blue-500/20 text-xs font-black">{driver.total}</span></td>
                                        <td className="p-3 text-center"><span className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded-md border border-amber-500/20 text-xs font-black">{driver.talento}</span></td>
                                        <td className="p-3 text-center text-slate-500 text-xs">{driver.agressividade}</td>
                                        <td className="p-3 text-center text-slate-500 text-xs">{driver.experiencia}</td>
                                        <td className="p-3 text-center text-slate-500 text-xs">{driver.tecnica}</td>
                                        <td className="p-3 text-center text-slate-500 text-xs">{driver.resistencia}</td>
                                        <td className="p-3 text-center text-slate-500 text-xs">{driver.carisma}</td>
                                        <td className="p-3 text-center text-slate-500 text-xs">{driver.motivacao}</td>
                                        <td className="p-3 text-center text-slate-500 text-xs">{driver.reputacao}</td>
                                        <td className="p-3 text-center">{driver.ofertas > 0 ? <span className="bg-rose-500 text-black px-1.5 py-0.5 rounded text-[10px] font-black">{driver.ofertas}</span> : <span className="text-slate-800">-</span>}</td>
                                        <td className="p-3 text-center">
                                            {favs > 0 ? <button onClick={() => setModal({ isOpen: true, type: 'info', title: 'Pistas Favoritas', message: `Este piloto possui ${favs} pistas favoritas no GPRO.` })} className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded text-[10px] font-black">{favs}</button> : <span className="text-slate-800">-</span>}
                                        </td>
                                        <td className="p-3 text-right pr-6"><span className="text-emerald-400 font-black text-xs">$ {(driver.salario / 1000).toFixed(0)}k</span></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* --- CONTROLES DE PAGINAÇÃO --- */}
                <div className="p-4 border-t border-white/5 bg-[#0b0b0e] flex items-center justify-center gap-2">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 hover:text-white disabled:opacity-20 transition-all"><ChevronsLeft size={18} /></button>
                    <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 hover:text-white disabled:opacity-20 transition-all"><ChevronLeft size={18} /></button>
                    
                    <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5 mx-2">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Página</span>
                        <span className="text-xs text-blue-400 font-black">{currentPage}</span>
                        <span className="text-[10px] text-slate-700">/</span>
                        <span className="text-[10px] text-slate-500 font-black">{totalPages || 1}</span>
                    </div>

                    <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 hover:text-white disabled:opacity-20 transition-all"><ChevronRight size={18} /></button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-2 hover:text-white disabled:opacity-20 transition-all"><ChevronsRight size={18} /></button>
                </div>
            </main>

            {/* --- BOTTOM SHEET DE FILTROS (RESTAURADO COMPLETO) --- */}
            <AnimatePresence>
                {isFilterOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsFilterOpen(false)} />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-[#0f0f12] border-t border-white/10 w-full max-w-2xl rounded-t-[2.5rem] shadow-2xl relative z-10 overflow-hidden">
                            <div className="h-1.5 w-full bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
                            <div className="p-6 md:p-8">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/10 rounded-lg"><Filter size={18} className="text-blue-400" /></div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Filtros</h3>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setFilters(INITIAL_FILTERS)} className="text-[10px] font-black text-slate-500 uppercase hover:text-white transition-colors">Limpar</button>
                                        <button onClick={() => setIsFilterOpen(false)} className="bg-white/5 p-2 rounded-full text-slate-500 hover:text-white"><X size={20} /></button>
                                    </div>
                                </div>
                                <div className="space-y-8 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Trophy size={14} className="text-blue-500" /> Performance</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <RangeFilter label="OA Total" filter={filters.total} onChange={(t:any, v:any) => updateFilter('total', t, v)} highlight />
                                            <RangeFilter label="Talento" filter={filters.talento} onChange={(t:any, v:any) => updateFilter('talento', t, v)} highlight />
                                            <RangeFilter label="Agressivid." filter={filters.agressividade} onChange={(t:any, v:any) => updateFilter('agressividade', t, v)} highlight />
                                            <RangeFilter label="Concentração" filter={filters.concentracao} onChange={(t:any, v:any) => updateFilter('concentracao', t, v)} />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Zap size={14} className="text-amber-500" /> Técnico</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <RangeFilter label="Técnica" filter={filters.tecnica} onChange={(t:any, v:any) => updateFilter('tecnica', t, v)} />
                                            <RangeFilter label="Resistência" filter={filters.resistencia} onChange={(t:any, v:any) => updateFilter('resistencia', t, v)} />
                                            <RangeFilter label="Experiência" filter={filters.experiencia} onChange={(t:any, v:any) => updateFilter('experiencia', t, v)} />
                                            <RangeFilter label="Idade" filter={filters.idade} onChange={(t:any, v:any) => updateFilter('idade', t, v)} />
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setIsFilterOpen(false)} className="w-full h-14 mt-6 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-xl active:scale-95 transition-all">Ver {filteredDrivers.length} Pilotos</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL DE STATUS (RESTAURADO) */}
            <AnimatePresence>
                {modal.isOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal({ ...modal, isOpen: false })} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#0f0f12] border border-white/10 w-full max-w-sm rounded-3xl shadow-2xl relative z-10 p-6 overflow-hidden">
                            <div className={`absolute top-0 left-0 h-1.5 w-full ${modal.type === 'success' ? 'bg-emerald-500' : modal.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                            <div className="flex items-center gap-3 mb-4 mt-2">
                                {modal.type === 'success' ? <CheckCircle2 className="text-emerald-500" size={24} /> : modal.type === 'error' ? <ShieldAlert className="text-rose-500" size={24} /> : <Info className="text-blue-500" size={24} />}
                                <h3 className="text-lg font-black text-white uppercase tracking-tight">{modal.title}</h3>
                            </div>
                            <p className="text-slate-400 text-xs font-bold leading-relaxed mb-8">{modal.message}</p>
                            <button onClick={() => setModal({ ...modal, isOpen: false })} className="w-full bg-white/5 hover:bg-white/10 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Fechar</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
            `}</style>
        </div>
    );
}