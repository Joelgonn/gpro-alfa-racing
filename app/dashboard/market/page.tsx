'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { 
  RefreshCw, X, Filter, Trophy, Zap, 
  Activity, Search, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight,
  CheckCircle2, Info, DollarSign, Target, User, ShieldAlert, HeartPulse, 
  AlertCircle, CheckCircle, Clock, Scale, Briefcase, Sparkles
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

const INITIAL_FILTERS = { 
    total: { min: 0, max: 300 }, 
    concentracao: { min: 0, max: 300 }, 
    talento: { min: 0, max: 300 }, 
    agressividade: { min: 0, max: 300 }, 
    experiencia: { min: 0, max: 500 }, 
    tecnica: { min: 0, max: 300 }, 
    resistencia: { min: 0, max: 300 }, 
    reputacao: { min: 0, max: 300 }, 
    peso: { min: 0, max: 150 }, 
    idade: { min: 0, max: 99 }, 
    salario: { min: 0, max: 200000000 }, 
    ofertas: { min: 0, max: 100 } 
};

// --- LÓGICA DE STATUS DO BANCO (GPRO SCHEDULE) ---
const checkDatabaseStatus = (lastSyncISO: string | null) => {
    if (!lastSyncISO) return { status: 'outdated', label: 'Sem Dados' };
    const lastSync = new Date(lastSyncISO);
    const now = new Date();

    const getLatestDeadline = (date: Date) => {
        const d = new Date(date);
        d.setUTCHours(21, 0, 0, 0); // 22:00 CET = 21:00 UTC
        while (true) {
            const day = d.getUTCDay(); // 1 = Seg, 4 = Qui
            if ((day === 1 || day === 4) && d <= date) return d;
            d.setUTCDate(d.getUTCDate() - 1);
            d.setUTCHours(21, 0, 0, 0);
        }
    };

    const latestDeadline = getLatestDeadline(now);
    const isOutdated = lastSync < latestDeadline;

    return {
        status: isOutdated ? 'outdated' : 'updated',
        label: isOutdated ? 'Atualização Disponível' : 'Base Atualizada',
        lastSyncDate: lastSync.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    };
};

const ISO3_TO_ISO2_MAP: Record<string, string> = { "ABW": "aw", "AFG": "af", "AGO": "ao", "AIA": "ai", "ALA": "ax", "ALB": "al", "AND": "ad", "ARE": "ae", "ARG": "ar", "ARM": "am", "ASM": "as", "ATA": "aq", "ATF": "tf", "ATG": "ag", "AUS": "au", "AUT": "at", "AZE": "az", "BDI": "bi", "BEL": "be", "BEN": "bj", "BES": "bq", "BFA": "bf", "BGD": "bd", "BGR": "bg", "BHR": "bh", "BHS": "bs", "BIH": "ba", "BLM": "bl", "BLR": "by", "BLZ": "bz", "BMU": "bm", "BOL": "bo", "BRA": "br", "BRB": "bb", "BRN": "bn", "BTN": "bt", "BVT": "bv", "BWA": "bw", "CAF": "cf", "CAN": "ca", "CCK": "cc", "CHE": "ch", "CHL": "cl", "CHN": "cn", "CIV": "ci", "CMR": "cm", "COD": "cd", "COG": "cg", "COK": "ck", "COL": "co", "COM": "km", "CPV": "cv", "CRI": "cr", "CUB": "cu", "CUW": "cw", "CXR": "cx", "CYM": "ky", "CYP": "cy", "CZE": "cz", "DEU": "de", "DJI": "dj", "DMA": "dm", "DNK": "dk", "DOM": "do", "DZA": "dz", "ECU": "ec", "EGY": "eg", "ERI": "er", "ESH": "eh", "ESP": "es", "EST": "ee", "ETH": "et", "FIN": "fi", "FJI": "fj", "FLK": "fk", "FRA": "fr", "FRO": "fo", "FSM": "fm", "GAB": "ga", "GBR": "gb", "GEO": "ge", "GGY": "gg", "GHA": "gh", "GIB": "gi", "GIN": "gn", "GLP": "gp", "GMB": "gm", "GNB": "gw", "GNQ": "gq", "GRC": "gr", "GRD": "gd", "GRL": "gl", "GTM": "gt", "GUF": "gf", "GUM": "gu", "GUY": "gy", "ENG": "gb-eng", "NIR": "gb-nir", "SCO": "gb-sct", "WAL": "gb-wls", "WLS": "gb-wls", "HKG": "hk", "HMD": "hm", "HND": "hn", "HRV": "hr", "HTI": "ht", "HUN": "hu", "IDN": "id", "IMN": "im", "IND": "in", "IOT": "io", "IRL": "ie", "IRN": "ir", "IRQ": "iq", "ISL": "is", "ISR": "il", "ITA": "it", "JAM": "jm", "JEY": "je", "JOR": "jo", "JPN": "jp", "KAZ": "kz", "KEN": "ke", "KGZ": "kg", "KHM": "kh", "KIR": "ki", "KNA": "kn", "KOR": "kr", "KWT": "kw", "LAO": "la", "LBN": "lb", "LBR": "lr", "LBY": "ly", "LCA": "lc", "LIE": "li", "LKA": "lk", "LSO": "ls", "LTU": "lt", "LUX": "lu", "LVA": "lv", "MAC": "mo", "MAF": "mf", "MAR": "ma", "MCO": "mc", "MDA": "md", "MDG": "mg", "MDV": "mv", "MEX": "mx", "MHL": "mh", "MKD": "mk", "MLI": "ml", "MLT": "mt", "MMR": "mm", "MNE": "me", "MNG": "mn", "MNP": "mp", "MOZ": "mz", "MRT": "mr", "MSR": "ms", "MTQ": "mq", "MUS": "mu", "MWI": "mw", "MYS": "my", "MYT": "yt", "NAM": "na", "NCL": "nc", "NER": "ne", "NFK": "nf", "NGA": "ng", "NIC": "ni", "NIU": "nu", "NLD": "nl", "NOR": "no", "NPL": "np", "NRU": "nr", "NZL": "nz", "OMN": "om", "PAK": "pk", "PAN": "pa", "PCN": "pn", "PER": "pe", "PHL": "ph", "PLW": "pw", "PNG": "pg", "POL": "pl", "PRI": "pr", "PRK": "kp", "PRT": "pt", "PRY": "py", "PSE": "ps", "PYF": "pf", "QAT": "qa", "REU": "re", "ROU": "ro", "RUS": "ru", "RWA": "rw", "SAU": "sa", "SDN": "sd", "SEN": "sn", "SGP": "sg", "SGS": "gs", "SHN": "sh", "SJM": "sj", "SLB": "sb", "SLE": "sl", "SLV": "sv", "SMR": "sm", "SOM": "so", "SPM": "pm", "SRB": "rs", "SSD": "ss", "STP": "st", "SUR": "sr", "SVK": "sk", "SVN": "si", "SWE": "se", "SWZ": "sz", "SXM": "sx", "SYC": "sc", "SYR": "sy", "TCA": "tc", "TCD": "td", "TGO": "tg", "THA": "th", "TJK": "tj", "TKL": "tk", "TKM": "tm", "TLS": "tl", "TON": "to", "TTO": "tt", "TUN": "tn", "TUR": "tr", "TUV": "tv", "TWN": "tw", "TZA": "tz", "UGA": "ug", "UKR": "ua", "UMI": "um", "URY": "uy", "USA": "us", "UZB": "uz", "VAT": "va", "VCT": "vc", "VEN": "ve", "VGB": "vg", "VIR": "vi", "VNM": "vn", "VUT": "vu", "WLF": "wf", "WSM": "ws", "XKX": "xk", "YEM": "ye", "ZAF": "za", "ZMB": "zm", "ZWE": "zw" };

// --- HELPERS ---
const getFlagCode = (nat: string): string => { 
    const code = nat.trim().toUpperCase(); 
    return (ISO3_TO_ISO2_MAP[code] || 'xx').toLowerCase(); 
};

const countFavTracks = (favString: string) => { 
    if (!favString || favString === '0' || favString === '""') return 0; 
    return favString.replace(/"/g, '').split(/[,;]/).filter(t => t.trim().length > 0 && t.trim() !== '0').length; 
};

const SortHeader = ({ label, sortKey, currentSort, onSort, align="center", className="" }: any) => { 
    const active = currentSort?.key === sortKey; 
    return ( 
        <th onClick={()=>onSort(sortKey)} className={`p-4 text-${align} border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors group ${active?'bg-blue-500/5 text-blue-400':'text-slate-500'} ${className} text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap`}> 
            <div className={`flex items-center gap-1.5 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}> 
                {label} {active && (currentSort.direction === 'asc' ? '▲' : '▼')}
            </div> 
        </th> 
    );
};

const RangeFilter = ({ label, filter, onChange, highlight }: { label: string, filter: any, onChange: any, highlight?: boolean }) => (
    <div className="flex flex-col gap-2 group">
        <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${highlight ? 'text-blue-400' : 'text-slate-600'}`}>{label}</span>
        <div className="flex items-center gap-2 h-11 bg-black/40 rounded-xl border border-white/5 px-3 focus-within:border-blue-500/30 transition-all">
            <input type="number" value={filter.min} onChange={(e)=>onChange('min',Number(e.target.value))} className="w-full bg-transparent text-center text-xs font-black text-white outline-none" placeholder="Min" />
            <div className="h-4 w-px bg-white/5" />
            <input type="number" value={filter.max} onChange={(e)=>onChange('max',Number(e.target.value))} className="w-full bg-transparent text-center text-xs font-black text-white outline-none" placeholder="Max" />
        </div>
    </div>
);

// --- COMPONENTE PRINCIPAL ---
export default function MarketPage() {
    const router = useRouter();
    const [drivers, setDrivers] = useState<MarketDriver[]>([]);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [sortConfig, setSortConfig] = useState<{ key: keyof MarketDriver; direction: 'asc' | 'desc' } | null>({ key: 'total', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;

    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>('');
    const [modal, setModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({ isOpen: false, title: '', message: '', type: 'success' });

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
            const json = await res.json();
            if(json.success) {
                setDrivers(json.data);
                setLastSyncTime(json.lastSync);
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleUpdateDatabase = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/market/update', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setModal({ 
                    isOpen: true, 
                    type: 'success', 
                    title: 'Mercado Renovado', 
                    message: `A base antiga foi limpa e ${data.count} novos pilotos foram importados com sucesso. Pilotos contratados foram removidos.` 
                });
                await loadData();
            } else {
                setModal({ isOpen: true, type: 'error', title: 'Falha', message: data.error || 'Erro ao sincronizar.' });
            }
        } catch (e) { 
            setModal({ isOpen: true, type: 'error', title: 'Erro Crítico', message: 'Erro ao processar arquivo.' });
        } finally { setSyncing(false); }
    };

    const handleSort = (key: keyof MarketDriver) => {
        setSortConfig(prev => {
            const direction = (prev?.key === key && prev.direction === 'desc') ? 'asc' : 'desc';
            return { key, direction };
        });
        setCurrentPage(1);
    };

    const filteredDrivers = useMemo(() => {
        let result = drivers.filter(d => {
            const check = (val: number | undefined, range: {min: number, max: number}) => (val ?? 0) >= range.min && (val ?? 0) <= range.max;
            return (
                check(d.total, filters.total) && check(d.talento, filters.talento) && check(d.concentracao, filters.concentracao) &&
                check(d.agressividade, filters.agressividade) && check(d.experiencia, filters.experiencia) && check(d.tecnica, filters.tecnica) &&
                check(d.resistencia, filters.resistencia) && check(d.idade, filters.idade) && check(d.salario, filters.salario) &&
                check(d.ofertas, filters.ofertas) && check(d.peso, filters.peso) && check(d.reputacao, filters.reputacao)
            );
        });

        if (sortConfig) {
            result.sort((a, b) => {
                let valA: any = a[sortConfig.key]; 
                let valB: any = b[sortConfig.key];
                if (sortConfig.key === 'favorito') { valA = countFavTracks(String(valA)); valB = countFavTracks(String(valB)); }
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [drivers, filters, sortConfig]);

    const paginatedDrivers = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredDrivers.slice(start, start + pageSize);
    }, [filteredDrivers, currentPage]);

    const totalPages = Math.ceil(filteredDrivers.length / pageSize);
    const dbInfo = useMemo(() => checkDatabaseStatus(lastSyncTime), [lastSyncTime]);

    const updateFilter = (key: keyof typeof INITIAL_FILTERS, type: 'min' | 'max', val: number) => {
        setFilters(prev => ({ ...prev, [key]: { ...prev[key], [type]: val } }));
        setCurrentPage(1);
    };

    if (!userId) return null;

    return (
        <div className="min-h-screen bg-[#050507] text-slate-300 font-mono flex flex-col overflow-hidden">
            
            {/* Header Sticky com Filtros de Cabeçalho restaurados */}
            <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/5 bg-[#050507]/80">
                <div className="max-w-[1600px] mx-auto p-4 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                         <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
                            <Trophy size={18} className="text-blue-400" />
                         </div>
                         <div className="hidden sm:block">
                            <h1 className="text-xs font-black text-white uppercase tracking-widest leading-none mb-0.5">Mercado de Pilotos</h1>
                            <p className="text-[9px] text-slate-500 font-bold uppercase">{userEmail}</p>
                         </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Status Tag */}
                        <div className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                            dbInfo.status === 'updated' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/5 border-amber-500/20 text-amber-400 animate-pulse'
                        }`}>
                            {dbInfo.status === 'updated' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase leading-none">{dbInfo.label}</span>
                                <span className="text-[7px] font-bold opacity-60">Sinc: {dbInfo.lastSyncDate || '--/--'}</span>
                            </div>
                        </div>

                        {/* Contadores de Base e Filtro */}
                        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                            <div className="flex flex-col items-center">
                                <span className="text-[8px] text-slate-600 font-black uppercase tracking-tighter">Base</span>
                                <span className="text-xs text-white font-black">{drivers.length}</span>
                            </div>
                            <div className="w-px h-4 bg-white/10" />
                            <div className="flex flex-col items-center">
                                <span className="text-[8px] text-blue-500 font-black uppercase tracking-tighter">Filtro</span>
                                <span className="text-xs text-blue-400 font-black">{filteredDrivers.length}</span>
                            </div>
                        </div>

                        <button onClick={() => setIsFilterOpen(true)} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all relative">
                            <Filter size={16} className="text-blue-400" />
                            {filteredDrivers.length !== drivers.length && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-[#050507]" />}
                        </button>

                        <button onClick={handleUpdateDatabase} disabled={syncing} className="p-3 sm:px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg transition-all flex items-center gap-2 border border-blue-400/20 disabled:opacity-50">
                            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{syncing ? 'Limpando & Renovando...' : 'Sincronizar'}</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-hidden flex flex-col relative">
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead className="sticky top-0 z-30 bg-[#0b0b0e] shadow-xl">
                            <tr>
                                <SortHeader label="Piloto" sortKey="nome" currentSort={sortConfig} onSort={handleSort} align="left" className="pl-6 sticky left-0 z-40 bg-[#0b0b0e] border-r border-white/5" />
                                <SortHeader label="Age" sortKey="idade" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="OA" sortKey="total" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="TAL" sortKey="talento" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="CON" sortKey="concentracao" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="AGR" sortKey="agressividade" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="EXP" sortKey="experiencia" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="TEC" sortKey="tecnica" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="RES" sortKey="resistencia" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="REP" sortKey="reputacao" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="WEI" sortKey="peso" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="OFF" sortKey="ofertas" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="FAV" sortKey="favorito" currentSort={sortConfig} onSort={handleSort} />
                                <SortHeader label="SALÁRIO" sortKey="salario" currentSort={sortConfig} onSort={handleSort} align="right" className="pr-8" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                            {loading ? (
                                Array(10).fill(0).map((_, i) => (<tr key={i} className="animate-pulse"><td colSpan={14} className="p-8 bg-white/[0.01]" /></tr>))
                            ) : paginatedDrivers.map((driver) => {
                                const flagCode = getFlagCode(driver.nacionalidade);
                                const favs = countFavTracks(driver.favorito);
                                return (
                                    <tr key={driver.id} className="group hover:bg-blue-500/[0.03] transition-colors">
                                        <td className="p-4 pl-6 sticky left-0 bg-[#050507] group-hover:bg-[#0b0b11] border-r border-white/5 z-20 transition-colors shadow-2xl">
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-5 h-3 shrink-0 rounded-[1px] overflow-hidden border border-white/10"><Image src={`/flags/${flagCode}.png`} alt={driver.nacionalidade} fill className="object-cover" /></div>
                                                <div className="flex flex-col">
                                                    <a href={`https://www.gpro.net/br/DriverProfile.asp?ID=${driver.id}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-black text-white hover:text-blue-400 transition truncate uppercase tracking-tight">{driver.nome}</a>
                                                    <span className="text-[7px] text-slate-600 font-bold uppercase tracking-widest">GPRO ID: {driver.id}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center text-[10px] font-bold text-slate-400">{driver.idade}</td>
                                        <td className="p-4 text-center"><span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-[10px] font-black border border-blue-500/20">{driver.total}</span></td>
                                        <td className="p-4 text-center"><span className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-[10px] font-black border border-blue-500/20">{driver.talento}</span></td>
                                        <td className="p-4 text-center text-slate-500 text-[10px]">{driver.concentracao}</td>
                                        <td className="p-4 text-center text-slate-500 text-[10px]">{driver.agressividade}</td>
                                        <td className="p-4 text-center text-slate-500 text-[10px] font-bold">{driver.experiencia}</td>
                                        <td className="p-4 text-center text-slate-500 text-[10px]">{driver.tecnica}</td>
                                        <td className="p-4 text-center text-slate-500 text-[10px]">{driver.resistencia}</td>
                                        <td className="p-4 text-center text-slate-500 text-[10px]">{driver.reputacao}</td>
                                        <td className="p-4 text-center text-slate-500 text-[10px]">{driver.peso}kg</td>
                                        <td className="p-4 text-center">{driver.ofertas > 0 ? <span className="bg-rose-500 text-black px-1.5 py-0.5 rounded text-[9px] font-black shadow-[0_0_10px_rgba(244,63,94,0.3)]">{driver.ofertas}</span> : <span className="text-slate-800">-</span>}</td>
                                        <td className="p-4 text-center">{favs > 0 ? <span className="bg-purple-500/20 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[9px] font-black">{favs}</span> : <span className="text-slate-800">-</span>}</td>
                                        <td className="p-4 text-right pr-8"><span className="text-emerald-400 font-black text-[11px]">$ {(driver.salario / 1000).toFixed(0)}k</span></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                <div className="p-4 border-t border-white/5 bg-[#0b0b0e] flex items-center justify-center gap-3">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 hover:text-blue-400 disabled:opacity-20 transition-all"><ChevronsLeft size={18} /></button>
                    <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 hover:text-blue-400 disabled:opacity-20 transition-all"><ChevronLeft size={18} /></button>
                    <div className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-lg border border-white/5 mx-2 shadow-inner">
                        <span className="text-[11px] text-blue-400 font-black">{currentPage} / {totalPages || 1}</span>
                    </div>
                    <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 hover:text-blue-400 disabled:opacity-20 transition-all"><ChevronRight size={18} /></button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-2 hover:text-blue-400 disabled:opacity-20 transition-all"><ChevronsRight size={18} /></button>
                </div>
            </main>

            {/* Bottom Sheet Filtros Avançados */}
            <AnimatePresence>
                {isFilterOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsFilterOpen(false)} />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-[#0f0f12] border-t border-white/10 w-full max-w-4xl rounded-t-[2.5rem] shadow-2xl relative z-10 overflow-hidden">
                            <div className="h-1.5 w-full bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]" />
                            <div className="p-6 md:p-10">
                                <div className="flex justify-between items-center mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-blue-600/20 p-2 rounded-lg"><Filter className="text-blue-500" size={20} /></div>
                                        <h3 className="text-xl font-black text-white uppercase">Filtros Avançados</h3>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <button onClick={() => setFilters(INITIAL_FILTERS)} className="text-[10px] font-black text-slate-500 uppercase hover:text-blue-400">Resetar Tudo</button>
                                        <button onClick={() => setIsFilterOpen(false)} className="bg-white/5 p-2 rounded-full text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
                                    </div>
                                </div>

                                <div className="space-y-10 max-h-[65vh] overflow-y-auto pr-4 custom-scrollbar pb-10">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-2"><Trophy size={14} /> Performance Principal</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <RangeFilter label="OA Total" filter={filters.total} onChange={(t:any, v:any) => updateFilter('total', t, v)} highlight />
                                            <RangeFilter label="Talento" filter={filters.talento} onChange={(t:any, v:any) => updateFilter('talento', t, v)} highlight />
                                            <RangeFilter label="Agressividade" filter={filters.agressividade} onChange={(t:any, v:any) => updateFilter('agressividade', t, v)} />
                                            <RangeFilter label="Concentração" filter={filters.concentracao} onChange={(t:any, v:any) => updateFilter('concentracao', t, v)} />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] flex items-center gap-2"><Zap size={14} /> Habilidades Técnicas</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <RangeFilter label="Experiência" filter={filters.experiencia} onChange={(t:any, v:any) => updateFilter('experiencia', t, v)} />
                                            <RangeFilter label="Técnica" filter={filters.tecnica} onChange={(t:any, v:any) => updateFilter('tecnica', t, v)} />
                                            <RangeFilter label="Resistência" filter={filters.resistencia} onChange={(t:any, v:any) => updateFilter('resistencia', t, v)} />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2"><DollarSign size={14} /> Perfil & Contrato</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            <RangeFilter label="Idade" filter={filters.idade} onChange={(t:any, v:any) => updateFilter('idade', t, v)} />
                                            <RangeFilter label="Peso (kg)" filter={filters.peso} onChange={(t:any, v:any) => updateFilter('peso', t, v)} />
                                            <RangeFilter label="Reputação" filter={filters.reputacao} onChange={(t:any, v:any) => updateFilter('reputacao', t, v)} />
                                            <RangeFilter label="Ofertas" filter={filters.ofertas} onChange={(t:any, v:any) => updateFilter('ofertas', t, v)} highlight />
                                            <div className="col-span-2 md:col-span-1"><RangeFilter label="Salário" filter={filters.salario} onChange={(t:any, v:any) => updateFilter('salario', t, v)} /></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Encontrados: <span className="text-blue-400">{filteredDrivers.length} pilotos</span></p>
                                    <button onClick={() => setIsFilterOpen(false)} className="w-full md:w-64 h-14 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs rounded-2xl transition-all">Aplicar Filtros</button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modals de Feedback */}
            <AnimatePresence>
                {modal.isOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal({ ...modal, isOpen: false })} />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#0f0f12] border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl relative z-10 p-6 overflow-hidden">
                            <div className={`absolute top-0 left-0 h-1 w-full ${modal.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <div className="flex items-center gap-3 mb-4 mt-2">
                                {modal.type === 'success' ? <CheckCircle2 className="text-emerald-500" size={24} /> : <ShieldAlert className="text-rose-500" size={24} />}
                                <h3 className="text-base font-black text-white uppercase">{modal.title}</h3>
                            </div>
                            <p className="text-slate-400 text-xs font-bold leading-relaxed mb-8">{modal.message}</p>
                            <button onClick={() => setModal({ ...modal, isOpen: false })} className="w-full bg-white/5 hover:bg-white/10 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Fechar</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 3px; height: 3px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
            `}</style>
        </div>
    );
}