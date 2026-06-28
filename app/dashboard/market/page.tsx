'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import he from 'he'; // ✅ ADD
import { 
  RefreshCw, X, Filter, Trophy, Zap, 
  Activity, Search, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight,
  CheckCircle2, Info, DollarSign, Target, User, ShieldAlert, HeartPulse, 
  AlertCircle, CheckCircle, Clock, Scale, Briefcase, Sparkles, ChevronDown,
  Eye, Star, Award, Gauge, Table, LayoutGrid, Crown
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
        d.setUTCHours(21, 0, 0, 0);
        while (true) {
            const day = d.getUTCDay();
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

const formatSalary = (salary: number) => {
    if (salary >= 1000000) return `$${(salary / 1000000).toFixed(1)}M`;
    if (salary >= 1000) return `$${(salary / 1000).toFixed(0)}k`;
    return `$${salary}`;
};

// ✅ FUNÇÃO PARA DECODIFICAR NOMES
const decodeName = (name: string): string => {
    if (!name) return '';
    return he.decode(name);
};

// ============================================
// COMPONENTE CARD PARA MOBILE (LIGHT GELO COM TOQUE DOURADO)
// ============================================
const DriverCard = ({ driver }: { driver: MarketDriver }) => {
    const [expanded, setExpanded] = useState(false);
    const flagCode = getFlagCode(driver.nacionalidade);
    const favs = countFavTracks(driver.favorito);
    const hasOffers = driver.ofertas > 0;
    const decodedName = decodeName(driver.nome);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-amber-500/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
        >
            <div className="p-4 flex items-start gap-3">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-50 shadow-sm">
                    <Image src={`/flags/${flagCode}.png`} alt={driver.nacionalidade} fill className="object-cover" />
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <a 
                                href={`https://www.gpro.net/br/DriverProfile.asp?ID=${driver.id}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-sm font-black text-slate-800 hover:text-amber-600 transition truncate block"
                            >
                                {decodedName}
                            </a>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] text-slate-400 font-bold uppercase">ID: {driver.id}</span>
                                <span className="w-px h-3 bg-slate-200" />
                                <span className="text-[9px] text-slate-400 font-bold">{driver.idade} anos</span>
                            </div>
                        </div>
                        <div className="shrink-0 bg-gradient-to-r from-emerald-50 to-amber-50 border border-emerald-200/50 px-2.5 py-1 rounded-lg shadow-sm">
                            <span className="text-sm font-black text-emerald-600">{driver.total}</span>
                            <span className="text-[8px] text-emerald-600/60 ml-1">OA</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-4 pb-2.5 grid grid-cols-4 gap-1.5 bg-white">
                <div className="text-center p-1.5 bg-slate-50 rounded-lg border border-slate-200 hover:border-amber-300 transition-colors">
                    <span className="text-[8px] text-slate-400 block uppercase font-black tracking-tighter">Tal</span>
                    <span className="text-xs font-black text-amber-600">{driver.talento}</span>
                </div>
                <div className="text-center p-1.5 bg-slate-50 rounded-lg border border-slate-200 hover:border-amber-300 transition-colors">
                    <span className="text-[8px] text-slate-400 block uppercase font-black tracking-tighter">Con</span>
                    <span className="text-xs font-black text-emerald-600">{driver.concentracao}</span>
                </div>
                <div className="text-center p-1.5 bg-slate-50 rounded-lg border border-slate-200 hover:border-amber-300 transition-colors">
                    <span className="text-[8px] text-slate-400 block uppercase font-black tracking-tighter">Exp</span>
                    <span className="text-xs font-black text-indigo-600">{driver.experiencia}</span>
                </div>
                <div className="text-center p-1.5 bg-slate-50 rounded-lg border border-slate-200 hover:border-amber-300 transition-colors">
                    <span className="text-[8px] text-slate-400 block uppercase font-black tracking-tighter">Ofertas</span>
                    <span className={`text-xs font-black ${hasOffers ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`}>
                        {hasOffers ? driver.ofertas : '0'}
                    </span>
                </div>
            </div>

            <button 
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-2 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-amber-600 transition-colors border-t border-slate-100 hover:bg-amber-50/30"
            >
                {expanded ? 'Menos detalhes' : 'Ver mais detalhes'}
                <ChevronDown size={12} className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3 bg-gradient-to-b from-[#f8fafc] to-white">
                            <div className="grid grid-cols-4 gap-2">
                                <div className="bg-white p-2 rounded-lg border border-slate-200 text-center shadow-sm hover:border-amber-300 transition-colors">
                                    <span className="text-[8px] text-slate-400 block uppercase font-black">AGR</span>
                                    <span className="text-xs font-black text-slate-800">{driver.agressividade}</span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200 text-center shadow-sm hover:border-amber-300 transition-colors">
                                    <span className="text-[8px] text-slate-400 block uppercase font-black">TEC</span>
                                    <span className="text-xs font-black text-slate-800">{driver.tecnica}</span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200 text-center shadow-sm hover:border-amber-300 transition-colors">
                                    <span className="text-[8px] text-slate-400 block uppercase font-black">RES</span>
                                    <span className="text-xs font-black text-slate-800">{driver.resistencia}</span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200 text-center shadow-sm hover:border-amber-300 transition-colors">
                                    <span className="text-[8px] text-slate-400 block uppercase font-black">REP</span>
                                    <span className="text-xs font-black text-slate-800">{driver.reputacao}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm text-center hover:border-amber-300 transition-colors">
                                    <span className="text-[8px] text-slate-400 block uppercase font-black">Peso</span>
                                    <span className="text-xs font-black text-slate-800">{driver.peso} kg</span>
                                </div>
                                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm text-center hover:border-amber-300 transition-colors">
                                    <span className="text-[8px] text-slate-400 block uppercase font-black">Pistas Favoritas</span>
                                    <span className={`text-xs font-black ${favs > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                        {favs > 0 ? favs : 'Nenhuma'}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-emerald-50 to-amber-50 border border-emerald-200/50 p-3 rounded-lg flex items-center justify-between shadow-sm">
                                <span className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-1.5">
                                    <DollarSign size={12} className="text-emerald-600" /> Salário
                                </span>
                                <span className="text-sm font-black text-emerald-600">{formatSalary(driver.salario)}</span>
                            </div>

                            <a 
                                href={`https://www.gpro.net/br/DriverProfile.asp?ID=${driver.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full bg-slate-100 hover:bg-amber-50 hover:border-amber-300 p-2.5 rounded-lg text-[9px] font-black text-slate-500 hover:text-amber-600 border border-slate-200 transition-all uppercase tracking-wider shadow-sm"
                            >
                                <Eye size={12} />
                                Ver no GPRO
                            </a>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
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
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');

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
                    message: `A base antiga foi limpa e ${data.count} novos pilotos foram importados com sucesso. Pilotos contratados foram removidos do painel.` 
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

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Fechar modal
    const closeModal = () => setModal({ ...modal, isOpen: false });

    if (!userId) return null;

    return (
        <div className="min-h-screen bg-[#eef2f6] text-slate-700 font-mono flex flex-col overflow-hidden pb-12 relative">
            
            {/* GLOWS AMBIENTAIS COM TOQUE DOURADO */}
            <div className="fixed inset-0 pointer-events-none z-0">
              <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/[0.01] blur-[120px] rounded-full" />
              <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-amber-500/[0.02] blur-[120px] rounded-full" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/[0.01] blur-[150px] rounded-full" />
            </div>

            {/* Header Sticky (Light Gelo com toque dourado) */}
            <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-slate-200 bg-white/90 shadow-sm hover:shadow-md transition-shadow duration-300 relative z-10">
                <div className="max-w-[1600px] mx-auto p-3 md:p-4 flex flex-wrap items-center gap-2 md:gap-4">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="bg-gradient-to-br from-emerald-50 to-amber-50 border border-amber-200/50 text-amber-600 p-1.5 md:p-2 rounded-lg shadow-sm">
                            <Trophy size={isMobile ? 14 : 18} />
                        </div>
                        <div className="hidden xs:block">
                            <h1 className="text-[11px] md:text-xs font-black text-slate-900 uppercase tracking-widest leading-none mb-1 flex items-center gap-1.5">
                                Mercado de Pilotos
                                <Sparkles size={12} className="text-amber-400" />
                            </h1>
                            <p className="text-[9px] text-slate-500 font-bold uppercase">{userEmail}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 md:gap-4 ml-auto">
                        {/* Status Tag */}
                        <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all shadow-sm ${
                            dbInfo.status === 'updated' ? 'bg-emerald-50 border border-emerald-200 text-emerald-600' : 'bg-amber-50 border border-amber-200 text-amber-600 animate-pulse'
                        }`}>
                            {dbInfo.status === 'updated' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black uppercase leading-none">{dbInfo.label}</span>
                                <span className="text-[8px] font-bold opacity-60">Sinc: {dbInfo.lastSyncDate || '--/--'}</span>
                            </div>
                        </div>

                        {/* Contadores */}
                        <div className="flex items-center gap-1.5 md:gap-3 bg-white px-2 md:px-4 py-1.5 md:py-2 rounded-lg border border-slate-200 shadow-sm hover:border-amber-300/30 transition-colors">
                            <div className="flex flex-col items-center">
                                <span className="text-[7px] md:text-[9px] text-slate-400 font-black uppercase tracking-tighter">Base</span>
                                <span className="text-[11px] md:text-xs text-slate-800 font-black">{drivers.length}</span>
                            </div>
                            <div className="w-px h-3 md:h-4 bg-slate-200" />
                            <div className="flex flex-col items-center">
                                <span className="text-[7px] md:text-[9px] text-emerald-600 font-black uppercase tracking-tighter">Filtro</span>
                                <span className="text-[11px] md:text-xs text-emerald-600 font-black">{filteredDrivers.length}</span>
                            </div>
                        </div>

                        {/* Toggle View - APENAS EM MOBILE */}
                        {isMobile && (
                            <button 
                                onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
                                className="p-2 bg-white hover:bg-amber-50 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1.5 hover:border-amber-300 transition-all"
                            >
                                {viewMode === 'table' ? (
                                    <>
                                        <LayoutGrid size={14} className="text-amber-600" />
                                        <span className="text-[8px] font-black text-amber-600 uppercase">Cards</span>
                                    </>
                                ) : (
                                    <>
                                        <Table size={14} className="text-slate-400" />
                                        <span className="text-[8px] font-black text-slate-400 uppercase">Tabela</span>
                                    </>
                                )}
                            </button>
                        )}

                        <button onClick={() => setIsFilterOpen(true)} className="p-2 md:p-3 bg-white hover:bg-amber-50 rounded-lg md:rounded-xl border border-slate-200 hover:border-amber-300 hover:text-amber-600 transition-all relative shadow-sm">
                            <Filter size={isMobile ? 14 : 16} className="text-amber-600" />
                            {filteredDrivers.length !== drivers.length && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full border-2 border-[#eef2f6]" />}
                        </button>

                        <button onClick={handleUpdateDatabase} disabled={syncing} className="p-2 md:p-3 md:px-5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-lg md:rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1 md:gap-2 border border-emerald-400/20 disabled:opacity-50 active:scale-95">
                            <RefreshCw size={isMobile ? 12 : 16} className={syncing ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline text-[9px] md:text-[11px] font-black uppercase tracking-widest">{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-hidden flex flex-col relative z-10">
                <div className="flex-1 overflow-auto custom-scrollbar">
                    
                    {/* MODO TABELA - Desktop sempre visível, mobile quando selecionado */}
                    <div className={`${!isMobile || viewMode === 'table' ? 'block' : 'hidden'} w-full overflow-x-auto bg-white`}>
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-30 bg-gradient-to-r from-slate-100 to-slate-50 shadow-md">
                                <tr>
                                    <th onClick={()=>handleSort('nome')} className="p-4 pl-6 text-left border-b border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors group sticky left-0 z-40 bg-gradient-to-r from-slate-100 to-slate-50 border-r border-slate-200 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-slate-500 shadow-sm">
                                        <div className="flex items-center gap-1.5">Piloto {sortConfig?.key === 'nome' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</div>
                                    </th>
                                    <th onClick={()=>handleSort('idade')} className="p-4 text-center border-b border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors group text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-slate-500">Age {sortConfig?.key === 'idade' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                    <th onClick={()=>handleSort('total')} className="p-4 text-center border-b border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors group text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-slate-500">OA {sortConfig?.key === 'total' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                    <th onClick={()=>handleSort('talento')} className="p-4 text-center border-b border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors group text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-slate-500">TAL {sortConfig?.key === 'talento' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                    <th onClick={()=>handleSort('concentracao')} className="p-4 text-center border-b border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors group text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-slate-500">CON {sortConfig?.key === 'concentracao' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                    <th onClick={()=>handleSort('agressividade')} className="p-4 text-center border-b border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors group text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-slate-500">AGR {sortConfig?.key === 'agressividade' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                    <th onClick={()=>handleSort('experiencia')} className="p-4 text-center border-b border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors group text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-slate-500">EXP {sortConfig?.key === 'experiencia' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                    <th onClick={()=>handleSort('tecnica')} className="p-4 text-center border-b border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors group text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-slate-500">TEC {sortConfig?.key === 'tecnica' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                    <th onClick={()=>handleSort('resistencia')} className="p-4 text-center border-b border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors group text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-slate-500">RES {sortConfig?.key === 'resistencia' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                    <th onClick={()=>handleSort('reputacao')} className="p-4 text-center border-b border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors group text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-slate-500">REP {sortConfig?.key === 'reputacao' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                    <th onClick={()=>handleSort('peso')} className="p-4 text-center border-b border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors group text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-slate-500">WEI {sortConfig?.key === 'peso' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                    <th onClick={()=>handleSort('ofertas')} className="p-4 text-center border-b border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors group text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-slate-500">OFF {sortConfig?.key === 'ofertas' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                    <th onClick={()=>handleSort('favorito')} className="p-4 text-center border-b border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors group text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-slate-500">FAV {sortConfig?.key === 'favorito' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                    <th onClick={()=>handleSort('salario')} className="p-4 text-right pr-8 border-b border-slate-200 cursor-pointer hover:bg-amber-50/50 transition-colors group text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap text-slate-500">SALÁRIO {sortConfig?.key === 'salario' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150">
                                {loading ? (
                                    Array(10).fill(0).map((_, i) => (<tr key={i} className="animate-pulse"><td colSpan={14} className="p-8 bg-slate-50/50" /></tr>))
                                ) : paginatedDrivers.map((driver) => {
                                    const flagCode = getFlagCode(driver.nacionalidade);
                                    const favs = countFavTracks(driver.favorito);
                                    const decodedName = decodeName(driver.nome);
                                    return (
                                        <tr key={driver.id} className="group hover:bg-amber-50/30 transition-colors bg-white">
                                            <td className="p-4 pl-6 sticky left-0 bg-white group-hover:bg-amber-50/30 border-r border-slate-200 z-20 transition-colors shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-5 h-3.5 shrink-0 rounded-sm overflow-hidden border border-slate-200 shadow-sm"><Image src={`/flags/${flagCode}.png`} alt={driver.nacionalidade} fill className="object-cover" /></div>
                                                    <div className="flex flex-col">
                                                        <a href={`https://www.gpro.net/br/DriverProfile.asp?ID=${driver.id}`} target="_blank" rel="noopener noreferrer" className="text-[12px] font-black text-slate-800 hover:text-amber-600 transition truncate uppercase tracking-tight">{decodedName}</a>
                                                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">GPRO ID: {driver.id}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center text-[11px] font-bold text-slate-600">{driver.idade}</td>
                                            <td className="p-4 text-center"><span className="bg-gradient-to-r from-emerald-50 to-amber-50 text-emerald-600 px-2 py-1 rounded text-[11px] font-black border border-emerald-250/50 shadow-sm">{driver.total}</span></td>
                                            <td className="p-4 text-center"><span className="bg-amber-50 text-amber-600 px-2 py-1 rounded text-[11px] font-black border border-amber-250 shadow-sm">{driver.talento}</span></td>
                                            <td className="p-4 text-center text-slate-500 text-[11px]">{driver.concentracao}</td>
                                            <td className="p-4 text-center text-slate-500 text-[11px]">{driver.agressividade}</td>
                                            <td className="p-4 text-center text-slate-600 text-[11px] font-bold">{driver.experiencia}</td>
                                            <td className="p-4 text-center text-slate-500 text-[11px]">{driver.tecnica}</td>
                                            <td className="p-4 text-center text-slate-500 text-[11px]">{driver.resistencia}</td>
                                            <td className="p-4 text-center text-slate-500 text-[11px]">{driver.reputacao}</td>
                                            <td className="p-4 text-center text-slate-500 text-[11px]">{driver.peso}kg</td>
                                            <td className="p-4 text-center">{driver.ofertas > 0 ? <span className="bg-rose-50 border border-rose-250 text-rose-600 px-1.5 py-0.5 rounded text-[10px] font-black shadow-sm animate-pulse-subtle">{driver.ofertas}</span> : <span className="text-slate-300">-</span>}</td>
                                            <td className="p-4 text-center">{favs > 0 ? <span className="bg-amber-50 border border-amber-200 text-amber-600 px-2 py-0.5 rounded text-[10px] font-black shadow-sm">{favs}</span> : <span className="text-slate-300">-</span>}</td>
                                            <td className="p-4 text-right pr-8"><span className="text-emerald-600 font-black text-[12px]">{formatSalary(driver.salario)}</span></td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* MODO CARDS - APENAS EM MOBILE */}
                    {isMobile && viewMode === 'cards' && (
                        <div className="p-3 space-y-3 max-w-lg mx-auto">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-50 rounded-lg" />
                                            <div className="flex-1">
                                                <div className="h-4 bg-slate-100 rounded w-3/4" />
                                                <div className="h-3 bg-slate-100 rounded w-1/2 mt-1" />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : paginatedDrivers.map((driver) => (
                                <DriverCard key={driver.id} driver={driver} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Paginação com toque dourado */}
                <div className="p-3 md:p-4 border-t border-slate-200 bg-gradient-to-r from-slate-100 to-slate-50 flex items-center justify-center gap-2 md:gap-3 relative z-20">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 md:p-2 hover:text-amber-600 disabled:opacity-20 transition-all"><ChevronsLeft size={isMobile ? 14 : 18} /></button>
                    <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1.5 md:p-2 hover:text-amber-600 disabled:opacity-20 transition-all"><ChevronLeft size={isMobile ? 14 : 18} /></button>
                    <div className="flex items-center gap-2 bg-white px-3 md:px-4 py-1 md:py-1.5 rounded-lg border border-slate-200 mx-1 md:mx-2 shadow-sm hover:border-amber-300/30 transition-colors">
                        <span className="text-[11px] md:text-[12px] text-amber-600 font-black">{currentPage} / {totalPages || 1}</span>
                    </div>
                    <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1.5 md:p-2 hover:text-amber-600 disabled:opacity-20 transition-all"><ChevronRight size={isMobile ? 14 : 18} /></button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 md:p-2 hover:text-amber-600 disabled:opacity-20 transition-all"><ChevronsRight size={isMobile ? 14 : 18} /></button>
                </div>
            </main>

            {/* Bottom Sheet Filtros Avançados com toque dourado */}
            <AnimatePresence>
                {isFilterOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)} />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="bg-white border-t border-slate-200 w-full max-w-4xl rounded-t-[2.5rem] shadow-2xl relative z-10 overflow-hidden bg-white">
                            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-amber-500 to-emerald-500 shadow-md" />
                            <div className="p-4 md:p-10">
                                <div className="flex justify-between items-center mb-6 md:mb-8">
                                    <div className="flex items-center gap-3 md:gap-4">
                                        <div className="bg-gradient-to-br from-emerald-50 to-amber-50 border border-amber-200/50 p-1.5 md:p-2 rounded-lg"><Filter className="text-amber-600" size={isMobile ? 16 : 20} /></div>
                                        <h3 className="text-base md:text-xl font-black text-slate-800 uppercase flex items-center gap-1.5">
                                            Filtros Avançados
                                            <Sparkles size={14} className="text-amber-400" />
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-3 md:gap-6">
                                        <button onClick={() => setFilters(INITIAL_FILTERS)} className="text-[9px] md:text-[11px] font-black text-slate-400 uppercase hover:text-amber-600 transition">Resetar</button>
                                        <button onClick={() => setIsFilterOpen(false)} className="bg-slate-100 p-1.5 md:p-2 rounded-full text-slate-500 hover:text-slate-800 transition-colors"><X size={16} /></button>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                                    <RangeFilterMobile label="OA" filter={filters.total} onChange={(t: any, v: any) => updateFilter('total', t, v)} highlight />
                                    <RangeFilterMobile label="Talento" filter={filters.talento} onChange={(t: any, v: any) => updateFilter('talento', t, v)} />
                                    <RangeFilterMobile label="Concentração" filter={filters.concentracao} onChange={(t: any, v: any) => updateFilter('concentracao', t, v)} />
                                    <RangeFilterMobile label="Agressividade" filter={filters.agressividade} onChange={(t: any, v: any) => updateFilter('agressividade', t, v)} />
                                    <RangeFilterMobile label="Experiência" filter={filters.experiencia} onChange={(t: any, v: any) => updateFilter('experiencia', t, v)} />
                                    <RangeFilterMobile label="Técnica" filter={filters.tecnica} onChange={(t: any, v: any) => updateFilter('tecnica', t, v)} />
                                    <RangeFilterMobile label="Resistência" filter={filters.resistencia} onChange={(t: any, v: any) => updateFilter('resistencia', t, v)} />
                                    <RangeFilterMobile label="Reputação" filter={filters.reputacao} onChange={(t: any, v: any) => updateFilter('reputacao', t, v)} />
                                    <RangeFilterMobile label="Peso" filter={filters.peso} onChange={(t: any, v: any) => updateFilter('peso', t, v)} />
                                    <RangeFilterMobile label="Idade" filter={filters.idade} onChange={(t: any, v: any) => updateFilter('idade', t, v)} />
                                    <RangeFilterMobile label="Salário" filter={filters.salario} onChange={(t: any, v: any) => updateFilter('salario', t, v)} />
                                    <RangeFilterMobile label="Ofertas" filter={filters.ofertas} onChange={(t: any, v: any) => updateFilter('ofertas', t, v)} />
                                </div>

                                <div className="mt-8 flex gap-3">
                                    <button onClick={() => setIsFilterOpen(false)} className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase transition-all shadow-sm hover:shadow-md">Fechar</button>
                                    <button onClick={() => setIsFilterOpen(false)} className="flex-1 h-11 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md hover:shadow-lg active:scale-95">Aplicar Filtros</button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL SYSTEM com toque dourado */}
            <AnimatePresence>
                {modal.isOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
                        <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white border border-slate-200 w-full max-w-xs rounded-2xl shadow-2xl relative z-10 overflow-hidden">
                            <div className={`h-1 w-full ${modal.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-amber-500' : 'bg-rose-500'}`} />
                            <div className="p-5 text-left bg-white">
                                <div className="flex items-center gap-3 mb-4 mt-2">
                                    {modal.type === 'success' ? <CheckCircle2 className="text-emerald-500" size={24} /> : <ShieldAlert className="text-rose-500" size={24} />}
                                    <h3 className="text-base font-black text-slate-800 uppercase flex items-center gap-1.5">
                                        {modal.type === 'success' && <Crown size={16} className="text-amber-500" />}
                                        {modal.title}
                                    </h3>
                                </div>
                                <p className="text-slate-500 text-xs font-bold leading-relaxed mb-8">{modal.message}</p>
                                <button onClick={closeModal} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm hover:shadow-md">Fechar</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 3px; height: 3px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
                
                @media (max-width: 480px) {
                    .xs\\:block { display: block; }
                }
                @media (min-width: 481px) {
                    .xs\\:block { display: none; }
                }
            `}</style>
        </div>
    );
}

// --- SUB-COMPONENTES OTIMIZADOS ---

function RangeFilterMobile({ label, filter, onChange, highlight }: { label: string, filter: any, onChange: any, highlight?: boolean }) {
    return (
        <div className="flex flex-col gap-1">
            <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${highlight ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{label}</span>
            <div className="flex items-center gap-2 h-9 bg-white rounded-lg border border-slate-200 px-2 focus-within:border-amber-500 shadow-sm hover:border-slate-300 transition-all">
                <input type="number" value={filter.min} onChange={(e)=>onChange('min',Number(e.target.value))} className="w-full bg-transparent text-center text-xs font-black text-slate-800 outline-none" placeholder="Min" />
                <div className="h-3 w-px bg-slate-200" />
                <input type="number" value={filter.max} onChange={(e)=>onChange('max',Number(e.target.value))} className="w-full bg-transparent text-center text-xs font-black text-slate-800 outline-none" placeholder="Max" />
            </div>
        </div>
    );
}