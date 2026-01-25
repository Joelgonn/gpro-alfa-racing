'use client';
import { useState, useEffect, useMemo, memo } from 'react';
import { RefreshCw, Sliders, Eye, EyeOff, X, Filter, Trophy, Zap, Activity } from 'lucide-react'; 
import Image from 'next/image'; 

// =======================================================
// === 1. CONSTANTES E TIPAGEM GLOBAIS ===================
// =======================================================

interface MarketDriver {
  id: number;
  nome: string;
  nacionalidade: string;
  total: number;
  concentracao: number;
  talento: number;
  agressividade: number;
  experiencia: number;
  tecnica: number;
  resistencia: number;
  carisma: number;
  motivacao: number;
  reputacao: number;
  peso: number;
  idade: number;
  salario: number;
  taxa: number;
  ofertas: number;
  nivel: number;
  favorito: string;
}

const TRACK_NAMES_BY_ID: Record<number, string> = {
    1: "Interlagos", 2: "Buenos Aires", 3: "Imola", 4: "Monte Carlo", 5: "Barcelona",
    6: "Montreal", 7: "Magny Cours", 8: "Silverstone", 9: "Hungaroring", 10: "Spa",
    11: "Monza", 12: "A1-Ring", 13: "Suzuka", 14: "Jerez", 15: "Sepang",
    16: "Indianapolis", 17: "Hockenheim", 18: "Estoril", 19: "Adelaide", 20: "Kyalami",
    21: "Nurburgring", 22: "Mexico City", 23: "Brands Hatch", 24: "Oesterreichring",
    25: "Paul Ricard", 26: "Zolder", 27: "Zandvoort", 28: "Mugello", 29: "Sakhir",
    30: "Anderstorp", 31: "Brasilia", 32: "Fiorano", 33: "Shanghai", 34: "Melbourne",
    35: "Laguna Seca", 36: "Istanbul", 37: "Fuji", 38: "Singapore", 39: "Valencia",
    40: "Yas Marina", 41: "Brno", 42: "Poznan", 43:"Irungattukottai", 44: "Yeongam",
    45: "Bucharest Ring", 46: "Indianapolis Oval", 47: "Ahvenisto", 48: "New Delhi",
    49: "Portimao", 50: "Kaunas", 51: "Austin", 52: "Slovakiaring", 53: "Serres",
    54: "Rafaela Oval", 55: "Sochi", 56: "Avus", 57: "Bremgarten", 58: "Baku City",
    59: "Grobnik", 60: "Jyllands-Ringen", 61: "Jeddah", 62: "Miami", 63: "Losail",
    64: "Las Vegas",
};

const INITIAL_FILTERS = {
    total: { min: 0, max: 300 }, 
    concentracao: { min: 0, max: 300 }, 
    talento: { min: 0, max: 300 }, 
    agressividade: { min: 0, max: 300 }, 
    experiencia: { min: 0, max: 500 }, 
    tecnica: { min: 0, max: 300 }, 
    resistencia: { min: 0, max: 300 }, 
    carisma: { min: 0, max: 300 }, 
    motivacao: { min: 0, max: 300 }, 
    reputacao: { min: 0, max: 300 }, 
    peso: { min: 0, max: 150 }, 
    idade: { min: 0, max: 99 }, 
    salario: { min: 0, max: 200000000 }, 
    taxa: { min: 0, max: 200000000 }, 
    ofertas: { min: 0, max: 100 }
};

// =======================================================
// === 2. LÓGICA DE BANDEIRAS E HELPERS ==================
// =======================================================

const ISO3_TO_ISO2_MAP: Record<string, string> = {
    // A
    "ABW": "aw", "AFG": "af", "AGO": "ao", "AIA": "ai", "ALA": "ax", "ALB": "al", "AND": "ad", 
    "ARE": "ae", "ARG": "ar", "ARM": "am", "ASM": "as", "ATA": "aq", "ATF": "tf", "ATG": "ag", 
    "AUS": "au", "AUT": "at", "AZE": "az",
    // B
    "BDI": "bi", "BEL": "be", "BEN": "bj", "BES": "bq", "BFA": "bf", "BGD": "bd", "BGR": "bg", 
    "BHR": "bh", "BHS": "bs", "BIH": "ba", "BLM": "bl", "BLR": "by", "BLZ": "bz", "BMU": "bm", 
    "BOL": "bo", "BRA": "br", "BRB": "bb", "BRN": "bn", "BTN": "bt", "BVT": "bv", "BWA": "bw", 
    // C
    "CAF": "cf", "CAN": "ca", "CCK": "cc", "CHE": "ch", "CHL": "cl", "CHN": "cn", "CIV": "ci", 
    "CMR": "cm", "COD": "cd", "COG": "cg", "COK": "ck", "COL": "co", "COM": "km", "CPV": "cv", 
    "CRI": "cr", "CUB": "cu", "CUW": "cw", "CXR": "cx", "CYM": "ky", "CYP": "cy", "CZE": "cz", 
    // D
    "DEU": "de", "DJI": "dj", "DMA": "dm", "DNK": "dk", "DOM": "do", "DZA": "dz",
    // E
    "ECU": "ec", "EGY": "eg", "ERI": "er", "ESH": "eh", "ESP": "es", "EST": "ee", "ETH": "et",
    // F
    "FIN": "fi", "FJI": "fj", "FLK": "fk", "FRA": "fr", "FRO": "fo", "FSM": "fm",
    // G
    "GAB": "ga", "GBR": "gb", "GEO": "ge", "GGY": "gg", "GHA": "gh", "GIB": "gi", "GIN": "gn", 
    "GLP": "gp", "GMB": "gm", "GNB": "gw", "GNQ": "gq", "GRC": "gr", "GRD": "gd", "GRL": "gl", 
    "GTM": "gt", "GUF": "gf", "GUM": "gu", "GUY": "gy",
    // UK Nations (Comuns em esportes)
    "ENG": "gb-eng", "NIR": "gb-nir", "SCO": "gb-sct", "WAL": "gb-wls", "WLS": "gb-wls",
    // H
    "HKG": "hk", "HMD": "hm", "HND": "hn", "HRV": "hr", "HTI": "ht", "HUN": "hu",
    // I
    "IDN": "id", "IMN": "im", "IND": "in", "IOT": "io", "IRL": "ie", "IRN": "ir", "IRQ": "iq", 
    "ISL": "is", "ISR": "il", "ITA": "it",
    // J
    "JAM": "jm", "JEY": "je", "JOR": "jo", "JPN": "jp",
    // K
    "KAZ": "kz", "KEN": "ke", "KGZ": "kg", "KHM": "kh", "KIR": "ki", "KNA": "kn", "KOR": "kr", 
    "KWT": "kw", "LAO": "la",
    // L
    "LBN": "lb", "LBR": "lr", "LBY": "ly", "LCA": "lc", "LIE": "li", "LKA": "lk", "LSO": "ls", 
    "LTU": "lt", "LUX": "lu", "LVA": "lv",
    // M
    "MAC": "mo", "MAF": "mf", "MAR": "ma", "MCO": "mc", "MDA": "md", "MDG": "mg", "MDV": "mv", 
    "MEX": "mx", "MHL": "mh", "MKD": "mk", "MLI": "ml", "MLT": "mt", "MMR": "mm", "MNE": "me", 
    "MNG": "mn", "MNP": "mp", "MOZ": "mz", "MRT": "mr", "MSR": "ms", "MTQ": "mq", "MUS": "mu", 
    "MWI": "mw", "MYS": "my", "MYT": "yt",
    // N
    "NAM": "na", "NCL": "nc", "NER": "ne", "NFK": "nf", "NGA": "ng", "NIC": "ni", "NIU": "nu", 
    "NLD": "nl", "NOR": "no", "NPL": "np", "NRU": "nr", "NZL": "nz",
    // O
    "OMN": "om",
    // P
    "PAK": "pk", "PAN": "pa", "PCN": "pn", "PER": "pe", "PHL": "ph", "PLW": "pw", "PNG": "pg", 
    "POL": "pl", "PRI": "pr", "PRK": "kp", "PRT": "pt", "PRY": "py", "PSE": "ps", "PYF": "pf",
    // Q
    "QAT": "qa",
    // R
    "REU": "re", "ROU": "ro", "RUS": "ru", "RWA": "rw",
    // S
    "SAU": "sa", "SDN": "sd", "SEN": "sn", "SGP": "sg", "SGS": "gs", "SHN": "sh", "SJM": "sj", 
    "SLB": "sb", "SLE": "sl", "SLV": "sv", "SMR": "sm", "SOM": "so", "SPM": "pm", "SRB": "rs", 
    "SSD": "ss", "STP": "st", "SUR": "sr", "SVK": "sk", "SVN": "si", "SWE": "se", "SWZ": "sz", 
    "SXM": "sx", "SYC": "sc", "SYR": "sy",
    // T
    "TCA": "tc", "TCD": "td", "TGO": "tg", "THA": "th", "TJK": "tj", "TKL": "tk", "TKM": "tm", 
    "TLS": "tl", "TON": "to", "TTO": "tt", "TUN": "tn", "TUR": "tr", "TUV": "tv", "TWN": "tw", 
    "TZA": "tz",
    // U
    "UGA": "ug", "UKR": "ua", "UMI": "um", "URY": "uy", "USA": "us", "UZB": "uz",
    // V
    "VAT": "va", "VCT": "vc", "VEN": "ve", "VGB": "vg", "VIR": "vi", "VNM": "vn", "VUT": "vu",
    // W
    "WLF": "wf", "WSM": "ws",
    // X, Y, Z
    "XKX": "xk", // Kosovo
    "YEM": "ye", "ZAF": "za", "ZMB": "zm", "ZWE": "zw"
};

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

const createFavTracksTooltip = (favString: string) => {
    if (!favString || favString === '0') return "Nenhuma pista favorita";
    const clean = favString.replace(/"/g, '');
    const trackIds = clean.split(/[,;]/).map(t => t.trim()).filter(t => t.length > 0 && t !== '0');
    
    const names = trackIds.map(id => TRACK_NAMES_BY_ID[parseInt(id)] || `ID ${id}`);
    
    // HTML string para o tooltip
    return (
        `<div class="space-y-1">` +
        `<div class="flex items-center gap-2 pb-2 border-b border-white/10 mb-2">` +
        `<span class="text-xs font-bold text-blue-400 uppercase tracking-wider">Pistas Favoritas</span>` +
        `</div>` +
        `<ul class="grid grid-cols-1 gap-1 text-[10px] text-slate-300">` +
        names.map(n => `<li class="flex items-center gap-1"><span class="w-1 h-1 rounded-full bg-blue-500"></span>${n}</li>`).join('') +
        `</ul></div>`
    ); 
};


// =======================================================
// === 3. SUBCOMPONENTES (VISUAL PREMIUM) ================
// =======================================================

// Estilos globais injetados para scrollbar personalizada
const GlobalStyles = () => (
  <style jsx global>{`
    .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
    .glass-panel {
        background: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
    }
  `}</style>
);

function FilterSection({ title, icon, children }: { title: string, icon?: React.ReactNode, children: React.ReactNode }) {
    return (
        <div className="mb-4 bg-slate-900/40 p-4 rounded-xl border border-white/5 shadow-sm">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                {icon && <span className="text-blue-500">{icon}</span>}
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
            </div>
            <div className="space-y-2.5">{children}</div>
        </div>
    )
}

function RangeFilter({ label, filter, onChange, step=1, highlight }: { label: string, filter: any, onChange: any, step?: number, highlight?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-3 group">
            <span className={`text-[10px] font-bold w-12 text-right tracking-wide transition-colors ${highlight ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                {label}
            </span>
            <div className="flex items-center gap-0.5 flex-1 bg-slate-950/50 rounded-lg border border-white/5 p-0.5 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all shadow-inner">
                <input 
                    type="number" 
                    value={filter.min} 
                    step={step} 
                    onChange={(e)=>onChange('min',Number(e.target.value))} 
                    className="w-full bg-transparent text-center text-[10px] font-mono font-medium text-slate-200 outline-none py-1 placeholder-slate-700 focus:placeholder-transparent" 
                    placeholder="Min" 
                />
                <span className="text-slate-700 text-[10px] font-light px-0.5">:</span>
                <input 
                    type="number" 
                    value={filter.max} 
                    step={step} 
                    onChange={(e)=>onChange('max',Number(e.target.value))} 
                    className="w-full bg-transparent text-center text-[10px] font-mono font-medium text-slate-200 outline-none py-1 placeholder-slate-700 focus:placeholder-transparent" 
                    placeholder="Max" 
                />
            </div>
        </div>
    )
}

function SortHeader({ label, sortKey, currentSort, onSort, align="center", className="", title }: any) {
    const active = currentSort?.key === sortKey;
    return (
        <th onClick={()=>onSort(sortKey)} title={title} className={`p-3 text-${align} border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5 group ${active?'bg-white/[0.02] text-blue-400':'text-slate-500'} ${className} text-[10px] font-bold uppercase tracking-wider whitespace-nowrap select-none`}>
            <div className={`flex items-center gap-1.5 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
                {label}
                <div className={`flex flex-col text-[6px] leading-[6px] transition-opacity ${active ? 'opacity-100' : 'opacity-20 group-hover:opacity-50'}`}>
                    <span className={active && currentSort.direction === 'asc' ? 'text-blue-400' : ''}>▲</span>
                    <span className={active && currentSort.direction === 'desc' ? 'text-blue-400' : ''}>▼</span>
                </div>
            </div>
        </th>
    )
}

// --- COMPONENTE DE TABELA ISOLADO ---
const DriverTable = memo(({ drivers, sortConfig, onSort }: { drivers: MarketDriver[], sortConfig: any, onSort: any }) => {
    const displayDrivers = drivers.slice(0, 100);

    return (
        <div className="flex-1 overflow-auto custom-scrollbar relative bg-[#0B1121]">
            <table className="w-full text-left border-collapse text-[11px] font-mono relative">
                <thead className="bg-[#0f172a] sticky top-0 z-30 shadow-lg shadow-black/40">
                    <tr>
                        <SortHeader label="Piloto" sortKey="nome" currentSort={sortConfig} onSort={onSort} align="left" className="pl-4 sticky left-0 z-40 w-60 border-r border-white/5 bg-[#0f172a] shadow-[4px_0_12px_rgba(0,0,0,0.3)]" />
                        <SortHeader label="Idade" sortKey="idade" currentSort={sortConfig} onSort={onSort} />
                        <SortHeader label="OA" sortKey="total" currentSort={sortConfig} onSort={onSort} className="text-blue-400" />
                        <SortHeader label="Con" sortKey="concentracao" currentSort={sortConfig} onSort={onSort} title="Concentração" />
                        <SortHeader label="Tal" sortKey="talento" currentSort={sortConfig} onSort={onSort} className="text-yellow-500" title="Talento" />
                        <SortHeader label="Agr" sortKey="agressividade" currentSort={sortConfig} onSort={onSort} title="Agressividade" />
                        <SortHeader label="Exp" sortKey="experiencia" currentSort={sortConfig} onSort={onSort} title="Experiência" />
                        <SortHeader label="Tec" sortKey="tecnica" currentSort={sortConfig} onSort={onSort} title="Técnica" />
                        <SortHeader label="Res" sortKey="resistencia" currentSort={sortConfig} onSort={onSort} title="Resistência" />
                        <SortHeader label="Car" sortKey="carisma" currentSort={sortConfig} onSort={onSort} title="Carisma" />
                        <SortHeader label="Mot" sortKey="motivacao" currentSort={sortConfig} onSort={onSort} title="Motivação" />
                        <SortHeader label="Rep" sortKey="reputacao" currentSort={sortConfig} onSort={onSort} title="Reputação" />
                        <SortHeader label="Pes" sortKey="peso" currentSort={sortConfig} onSort={onSort} title="Peso (kg)" />
                        <SortHeader label="Offs" sortKey="ofertas" currentSort={sortConfig} onSort={onSort} className="text-red-400" title="Ofertas Ativas" />
                        <th className="p-3 text-center border-b border-white/5 text-slate-500 cursor-help uppercase text-[10px] font-bold" title="Pistas Favoritas">Fav</th>
                        <SortHeader label="Taxa" sortKey="taxa" currentSort={sortConfig} onSort={onSort} align="right" title="Taxa de Transferência" />
                        <SortHeader label="Salário" sortKey="salario" currentSort={sortConfig} onSort={onSort} align="right" className="pr-6 text-green-400" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                    {displayDrivers.map((driver, idx) => {
                        const flagCode = getFlagCode(driver.nacionalidade);
                        const flagSrc = `/flags/${flagCode}.png`;
                        const isEven = idx % 2 === 0;

                        return ( 
                        <tr key={driver.id} className={`group hover:bg-blue-500/[0.03] transition-colors divide-x divide-white/[0.03] ${isEven ? 'bg-transparent' : 'bg-white/[0.01]'}`}>
                            
                            {/* Célula Piloto (COM BANDEIRA) */}
                            <td className={`p-2 pl-4 sticky left-0 group-hover:bg-[#11192e] border-r border-white/5 z-20 shadow-[4px_0_12px_rgba(0,0,0,0.3)] transition-colors ${isEven ? 'bg-[#0B1121]' : 'bg-[#0D1426]'}`}>
                                <div className="flex items-center gap-3">
                                    <div title={driver.nacionalidade} className="shrink-0 relative">
                                        <Image
                                            src={flagSrc}
                                            alt={`Bandeira de ${driver.nacionalidade}`}
                                            width={20}
                                            height={14}
                                            className="rounded shadow-sm opacity-90"
                                        />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <a 
                                          href={`https://www.gpro.net/br/DriverProfile.asp?ID=${driver.id}`} 
                                          target="_blank"
                                          rel="noopener noreferrer" 
                                          className="font-sans font-bold text-slate-200 text-xs hover:text-blue-400 transition truncate block tracking-tight"
                                          title="Ver perfil no GPRO"
                                        >
                                            {driver.nome}
                                        </a>
                                        <span className="text-[9px] text-slate-600 font-mono">ID: {driver.id}</span>
                                    </div>
                                </div>
                            </td>

                            <td className="p-1.5 text-center text-slate-400">{driver.idade}</td>
                            <td className="p-1.5 text-center font-bold text-blue-400 bg-blue-500/[0.03] shadow-[inset_0_0_10px_rgba(59,130,246,0.05)]">{driver.total}</td>
                            <td className="p-1.5 text-center text-slate-400">{driver.concentracao}</td>
                            <td className="p-1.5 text-center font-bold text-yellow-500 bg-yellow-500/[0.03]">{driver.talento}</td>
                            <td className="p-1.5 text-center text-slate-500">{driver.agressividade}</td>
                            <td className="p-1.5 text-center text-slate-500">{driver.experiencia}</td>
                            <td className="p-1.5 text-center text-slate-500">{driver.tecnica}</td>
                            <td className="p-1.5 text-center text-slate-500">{driver.resistencia}</td>
                            <td className="p-1.5 text-center text-slate-500">{driver.carisma}</td>
                            <td className="p-1.5 text-center text-slate-500">{driver.motivacao}</td>
                            <td className="p-1.5 text-center text-slate-500">{driver.reputacao}</td>
                            <td className="p-1.5 text-center text-slate-500">{driver.peso}</td>
                            
                            <td className="p-1.5 text-center">
                                {driver.ofertas > 0 ? (
                                    <span className="text-white font-bold bg-red-500/80 px-1.5 py-0.5 rounded text-[10px] shadow-[0_0_8px_rgba(239,68,68,0.4)]">{driver.ofertas}</span>
                                ) : <span className="text-slate-800 text-[10px]">-</span>}
                            </td>
                            
                            <td className="p-1.5 text-center cursor-help group/fav relative">
                                {countFavTracks(driver.favorito) > 0 ? (
                                  <>
                                      <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-[10px] font-medium border border-purple-500/20">
                                          {countFavTracks(driver.favorito)}
                                      </span>
                                      <div 
                                          className="absolute hidden group-hover/fav:block bg-[#0f172a] border border-blue-500/20 text-white p-3 rounded-xl shadow-2xl z-50 right-full mr-2 w-48 whitespace-pre-wrap top-0 text-left backdrop-blur-md"
                                          dangerouslySetInnerHTML={{ __html: createFavTracksTooltip(driver.favorito) }}
                                      />
                                  </>
                                ) : <span className="text-slate-800 text-[10px]">-</span>}
                            </td>

                            <td className="p-1.5 text-right text-slate-400 font-mono tracking-tighter text-[10px]">
                                {driver.taxa > 0 ? `$ ${(driver.taxa / 1000).toFixed(0)}k` : <span className="text-slate-800">-</span>}
                            </td>
                            <td className="p-1.5 text-right pr-6 font-bold text-green-400/90 font-mono tracking-tighter text-[10px]">
                                $ {(driver.salario / 1000).toFixed(0)}k
                            </td>
                        </tr>
                    )})}
                </tbody>
            </table>
            
            {displayDrivers.length === 0 && (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-600">
                    <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800">
                        <Filter className="w-6 h-6 opacity-50" />
                    </div>
                    <p className="text-xs uppercase font-bold tracking-widest">Nenhum piloto encontrado</p>
                    <p className="text-[10px] text-slate-700 mt-2">Ajuste os filtros para ver resultados</p>
                </div>
            )}

            {drivers.length > 100 && (
                <div className="p-2 text-center text-[10px] text-slate-500 font-medium bg-[#0f172a] border-t border-white/5 sticky bottom-0 z-20 backdrop-blur-sm">
                    Exibindo Top 100 de <span className="text-slate-300">{drivers.length}</span> resultados
                </div>
            )}
        </div>
    );
});


// =======================================================
// === 4. COMPONENTE PRINCIPAL ===========================
// =======================================================

export default function MarketPage() {
  const [drivers, setDrivers] = useState<MarketDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [sortConfig, setSortConfig] = useState<{ key: keyof MarketDriver; direction: 'asc' | 'desc' } | null>({ key: 'total', direction: 'desc' });

  const loadData = async () => {
    setLoading(true);
    try {
        const res = await fetch('/api/market/update');
        const data = await res.json();
        if(data.success && Array.isArray(data.data)) {
            setDrivers(data.data);
        }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleUpdateDatabase = async () => {
    setLoading(true);
    try {
        const res = await fetch('/api/market/update', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert(`Base atualizada! ${data.count} pilotos.`);
            await loadData();
        } else {
            alert("Erro: " + data.error);
        }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const filteredDrivers = useMemo(() => {
      let result = drivers.filter(d => {
          const check = (val: number | undefined, range: {min: number, max: number}) => {
              const v = val ?? 0;
              return v >= range.min && v <= range.max;
          };
          return (
              check(d.total, filters.total) && check(d.talento, filters.talento) &&
              check(d.concentracao, filters.concentracao) && check(d.agressividade, filters.agressividade) &&
              check(d.experiencia, filters.experiencia) && check(d.tecnica, filters.tecnica) &&
              check(d.resistencia, filters.resistencia) && check(d.carisma, filters.carisma) &&
              check(d.motivacao, filters.motivacao) && check(d.reputacao, filters.reputacao) &&
              check(d.peso, filters.peso) && check(d.idade, filters.idade) &&
              check(d.salario, filters.salario) && check(d.taxa, filters.taxa) &&
              check(d.ofertas, filters.ofertas)
          );
      });

      if (sortConfig) {
          result.sort((a, b) => {
              let valA: any = a[sortConfig.key];
              let valB: any = b[sortConfig.key];
              
              if (sortConfig.key === 'favorito') {
                  valA = countFavTracks(String(valA)); valB = countFavTracks(String(valB));
              }
              
              if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
              if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }
      return result;
  }, [drivers, filters, sortConfig]);

  const handleSort = (key: keyof MarketDriver) => {
    setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
  };

  const updateFilter = (key: keyof typeof INITIAL_FILTERS, type: 'min' | 'max', val: number) => {
      setFilters(prev => ({ ...prev, [key]: { ...prev[key], [type]: val } }));
  };

  return (
    <div className="bg-[#020617] h-screen w-full flex flex-col text-slate-200 font-sans overflow-hidden selection:bg-blue-500/30">
      <GlobalStyles />
      
      {/* HEADER PREMIUM */}
      <header className="shrink-0 px-6 py-4 bg-[#0B1121]/80 backdrop-blur-md border-b border-white/5 z-50 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Trophy className="text-white w-5 h-5" />
            </div>
            <div>
                <h1 className="text-lg font-black text-white uppercase tracking-tight leading-none">
                    GPRO <span className="text-blue-500">Analytics</span>
                </h1>
                <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase mt-1">Mercado de Pilotos em Tempo Real</p>
            </div>
         </div>

         <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/50 rounded-lg border border-white/5">
                <div className="flex flex-col items-end">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Database</span>
                    <span className="text-xs font-mono font-bold text-white">{drivers.length}</span>
                </div>
                <div className="w-px h-6 bg-white/10 mx-1"></div>
                <div className="flex flex-col items-start">
                    <span className="text-[9px] text-blue-500 font-bold uppercase">Filtrados</span>
                    <span className="text-xs font-mono font-bold text-blue-400">{filteredDrivers.length}</span>
                </div>
            </div>

            <div className="h-8 w-px bg-white/10 mx-2"></div>

            <button 
                onClick={() => setShowFilters(!showFilters)} 
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${showFilters ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-800 text-slate-400 border-transparent hover:bg-slate-700'}`}
            >
                {showFilters ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showFilters ? 'Ocultar' : 'Filtros'}
            </button>
            
            <button 
                onClick={handleUpdateDatabase} 
                disabled={loading} 
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] disabled:opacity-50 disabled:cursor-not-allowed border border-blue-400/20"
            >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Sincronizando...' : 'Atualizar Dados'}
            </button>
         </div>
      </header>

      {/* CONTENT AREA */}
      <main className="flex flex-1 overflow-hidden p-4 gap-4">
          
          {/* SIDEBAR FILTROS */}
          <aside className={`w-72 flex flex-col gap-4 transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${showFilters ? 'translate-x-0 opacity-100' : '-translate-x-[20rem] opacity-0 w-0 hidden'}`}>
              <div className="bg-[#0B1121] border border-white/5 rounded-2xl p-1 flex-1 flex flex-col shadow-xl overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-slate-900/30 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                        <Filter className="w-3 h-3 text-blue-500" /> Configurar Filtros
                    </span>
                    <button onClick={() => setFilters(INITIAL_FILTERS)} className="text-[10px] text-slate-500 hover:text-white underline decoration-slate-700 hover:decoration-white transition-all">Limpar</button>
                </div>
                
                <div className="overflow-y-auto custom-scrollbar p-3 space-y-1 flex-1">
                    <FilterSection title="Performance" icon={<Trophy className="w-3 h-3"/>}>
                        <RangeFilter label="OA Total" filter={filters.total} onChange={(t:any, v:any) => updateFilter('total', t, v)} highlight />
                        <RangeFilter label="Talento" filter={filters.talento} onChange={(t:any, v:any) => updateFilter('talento', t, v)} highlight />
                        <RangeFilter label="Concentr." filter={filters.concentracao} onChange={(t:any, v:any) => updateFilter('concentracao', t, v)} />
                    </FilterSection>
                    
                    <FilterSection title="Habilidades" icon={<Zap className="w-3 h-3"/>}>
                        <RangeFilter label="Técnica" filter={filters.tecnica} onChange={(t:any, v:any) => updateFilter('tecnica', t, v)} />
                        <RangeFilter label="Experiên." filter={filters.experiencia} onChange={(t:any, v:any) => updateFilter('experiencia', t, v)} />
                        <RangeFilter label="Agressiv." filter={filters.agressividade} onChange={(t:any, v:any) => updateFilter('agressividade', t, v)} />
                        <RangeFilter label="Resistên." filter={filters.resistencia} onChange={(t:any, v:any) => updateFilter('resistencia', t, v)} />
                    </FilterSection>

                    <FilterSection title="Perfil & Contrato" icon={<Activity className="w-3 h-3"/>}>
                        <RangeFilter label="Idade" filter={filters.idade} onChange={(t:any, v:any) => updateFilter('idade', t, v)} />
                        <RangeFilter label="Peso" filter={filters.peso} onChange={(t:any, v:any) => updateFilter('peso', t, v)} />
                        <RangeFilter label="Reputaç." filter={filters.reputacao} onChange={(t:any, v:any) => updateFilter('reputacao', t, v)} />
                        <RangeFilter label="Salário" filter={filters.salario} onChange={(t:any, v:any) => updateFilter('salario', t, v)} step={500000} />
                        <RangeFilter label="Ofertas" filter={filters.ofertas} onChange={(t:any, v:any) => updateFilter('ofertas', t, v)} highlight />
                    </FilterSection>
                </div>

                <div className="p-3 border-t border-white/5 bg-slate-900/30">
                    <button onClick={() => setFilters(INITIAL_FILTERS)} className="w-full py-2.5 flex items-center justify-center gap-2 text-[10px] font-bold uppercase bg-white/5 border border-white/5 rounded-lg hover:bg-white/10 transition text-slate-300 tracking-widest hover:text-white group">
                        <Sliders className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                        Resetar Filtros
                    </button>
                </div>
              </div>
          </aside>

          {/* TABELA DE DADOS */}
          <div className="flex-1 bg-[#0B1121] border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
              <DriverTable drivers={filteredDrivers} sortConfig={sortConfig} onSort={handleSort} />
          </div>
      </main>
    </div>
  );
}