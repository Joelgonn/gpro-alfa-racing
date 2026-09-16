'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { 
  Briefcase, Save, Search, Users, TrendingUp, 
  MessageSquare, History, Trash2, ChevronRight, BarChart3, 
  Loader2, Cloud, Database, Info, TrendingDown, Gauge, Sparkles, Crown, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- TIPOS ---
type SponsorAttribute = 'finances' | 'expectations' | 'patience' | 'reputation' | 'image' | 'negotiation' | 'currentProgress' | 'averageProgress' | 'managers';

interface CatalogSponsor {
  sponsor_id: number;
  name: string;
  country: string | null;
  category: string | null;
  finances: number;
  expectations: number;
  patience: number;
  reputation: number;
  image: number;
  negotiation: number;
}

interface SavedSponsor {
    id: string;
    sponsorId?: number | null;
    sponsorName: string;
    name: string;
    source: 'gpro_catalog' | 'manual';
    attributes: Record<SponsorAttribute, number>;
    answers?: string[];
    progress?: { current: number; average: number; managers: number };
    results?: { diff?: number; opponentProgress?: number }; // opponentProgress legado preservado para compatibilidade histórica, não exibido
    date: string;
}

const QUESTIONS_LABELS = [
    "Onde colocar a propaganda?",
    "Objetivo na próxima temporada?",
    "Popularidade do piloto?",
    "Opinião sobre valor proposto?",
    "Opinião sobre duração proposta?"
];

const TRANSLATION_MAP: { [key: string]: string } = {
  "Aileron Dianteiro": "Asa Dianteira",
  "Aileron Traseiro": "Asa Traseira",
  "Sidepods": "Laterais",
  "Nariz": "Bico",
  "Capot do Motor": "Carenagem",
};

function translate(text: string) {
  return TRANSLATION_MAP[text] || text;
}

// --- Helpers ALFA-009.6.1 — decodificação segura de entidades HTML (texto puro, sem dangerouslySetInnerHTML) ---
function decodeHtmlEntities(value: unknown): string {
  const text = String(value ?? '');
  if (!text) return text;
  // Entidades nomeadas comuns (sem interpretar HTML)
  let out = text
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
  // Entidades numéricas decimais &#225; etc — validação de code point
  out = out.replace(/&#(\d+);/g, (_m, code) => {
    const n = Number(code);
    if (!Number.isFinite(n) || n < 0 || n > 1114111) return _m;
    try { return String.fromCodePoint(n); } catch { return _m; }
  });
  // Entidades hexadecimais &#xE1; / &#XE1; etc
  out = out.replace(/&#x([0-9a-f]+);/gi, (_m, code) => {
    const n = parseInt(code, 16);
    if (!Number.isFinite(n) || n < 0 || n > 1114111) return _m;
    try { return String.fromCodePoint(n); } catch { return _m; }
  });
  return out;
}

function normalizeForSearch(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function SponsorsPage() {
  const router = useRouter();

  // --- ESTADOS DO NEGÓCIO ---
  const [attributes, setAttributes] = useState({
    finances: 2, expectations: 6, patience: 2, reputation: 6,
    image: 1, negotiation: 3, currentProgress: 50.0, averageProgress: 50.0, managers: 1,
  });

  const [sponsorName, setSponsorName] = useState("");
  const [results, setResults] = useState({
      answers: ["...", "...", "...", "...", "..."],
      stats: { diff: 0 }
  });

  const [loading, setLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [savedSponsors, setSavedSponsors] = useState<SavedSponsor[]>([]);
  
  // --- UI STATES ---
  const [modal, setModal] = useState<{
    isOpen: boolean; type: 'alert' | 'confirm' | 'info'; title: string; message: string; onConfirm?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('Gerente');

  // --- CATÁLOGO GPRO (somente leitura) ---
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogSponsors, setCatalogSponsors] = useState<CatalogSponsor[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogSource, setCatalogSource] = useState<'gpro_catalog' | 'manual'>('manual');
  const [loadedSponsor, setLoadedSponsor] = useState<CatalogSponsor | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const showAlert = (title: string, message: string) => setModal({ isOpen: true, type: 'alert', title, message });
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setModal({ isOpen: true, type: 'confirm', title, message, onConfirm });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  // --- 1. AUTH & LOAD DATA (SUPABASE) ---
  useEffect(() => {
    async function initPage() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/login'); return; }
            
            const uid = session.user.id;
            setUserId(uid);
            if (session.user.email) setUserEmail(session.user.email);

            const res = await fetch('/api/python?action=get_state', { 
                headers: { 'user-id': uid } 
            });
            const json = await res.json();
            
            if (json.sucesso && json.data?.sponsors_database) {
                setSavedSponsors(json.data.sponsors_database);
            }
        } catch (error) { 
            console.error("Erro ao carregar:", error);
        } finally { 
            setIsAuthLoading(false); 
        }
    }
    initPage();
  }, [router]);

  // --- CATÁLOGO GPRO: busca somente leitura, sem raw_data ---
  const fetchCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCatalogSponsors([]);
        return;
      }
      const { data, error } = await supabase
        .from('gpro_sponsors')
        .select('sponsor_id, name, country, category, finances, expectations, patience, reputation, image, negotiation')
        .order('name')
        .limit(100);
      if (error) throw error;
      setCatalogSponsors((data as CatalogSponsor[]) || []);
    } catch (e: any) {
      setCatalogError(e?.message || 'Erro ao buscar catálogo');
      setCatalogSponsors([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchCatalog();
  }, [fetchCatalog, userId]);

  // Filtragem local para tabela e autocomplete — evita chamada por tecla
  // Busca usa normalizeForSearch (sem acentos, case-insensitive) apenas para comparação, preserva original para exibição
  const filteredCatalog = useMemo(() => {
    const q = normalizeForSearch(catalogQuery.trim());
    if (!q) return catalogSponsors;
    // remove duplicidades visuais por sponsor_id ou nome
    const seen = new Set<string>();
    const filtered = catalogSponsors.filter(s => {
      if (!s.name) return false;
      const key = String(s.sponsor_id ?? normalizeForSearch(s.name));
      if (seen.has(key)) return false;
      seen.add(key);
      return normalizeForSearch(decodeHtmlEntities(s.name)).includes(q);
    });
    return filtered;
  }, [catalogSponsors, catalogQuery]);

  // Autocomplete: até 8 sugestões, prioriza começa com > contém > alfabético (comparação sem acentos)
  const autocompleteSuggestions = useMemo(() => {
    const q = normalizeForSearch(catalogQuery.trim());
    if (!q) return [];
    const deduped = new Map<string, CatalogSponsor>();
    catalogSponsors.forEach(s => {
      const key = String(s.sponsor_id ?? normalizeForSearch(s.name));
      if (!deduped.has(key)) deduped.set(key, s);
    });
    const all = Array.from(deduped.values()).filter(s => normalizeForSearch(decodeHtmlEntities(s.name)).includes(q));
    const startsWith = all.filter(s => normalizeForSearch(decodeHtmlEntities(s.name)).startsWith(q)).sort((a,b) => decodeHtmlEntities(a.name).localeCompare(decodeHtmlEntities(b.name)));
    const contains = all.filter(s => !normalizeForSearch(decodeHtmlEntities(s.name)).startsWith(q)).sort((a,b) => decodeHtmlEntities(a.name).localeCompare(decodeHtmlEntities(b.name)));
    return [...startsWith, ...contains].slice(0, 8);
  }, [catalogSponsors, catalogQuery]);

  // Fechar autocomplete ao clicar fora ou Esc
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAutocomplete(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelectCatalogSponsor = useCallback((s: CatalogSponsor) => {
    setSponsorName(s.name);
    setCatalogQuery(s.name);
    setLoadedSponsor(s);
    setAttributes({
      finances: s.finances + 1,
      expectations: s.expectations + 1,
      patience: s.patience + 1,
      reputation: s.reputation + 1,
      image: s.image + 1,
      negotiation: s.negotiation + 1,
      currentProgress: 50,
      averageProgress: 50,
      managers: 1,
    });
    setCatalogSource('gpro_catalog');
    setShowAutocomplete(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // --- 2. SYNC FUNCTION (SUPABASE) ---
  const syncWithSupabase = async (newList: SavedSponsor[]) => {
      if (!userId) return;
      setSavedSponsors(newList); 
      
      try {
          await fetch('/api/python?action=update_state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'user-id': userId },
              body: JSON.stringify({ sponsors_database: newList })
          });
      } catch (e) {
          console.error("Erro ao sincronizar com servidor:", e);
      }
  };

  // --- 3. ACTIONS ---
  const fetchSponsorData = useCallback(async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const res = await fetch('/api/python?action=sponsors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'user-id': userId },
            body: JSON.stringify(attributes)
        });
        const data = await res.json();
        if (data.sucesso) setResults(data.data);
      } catch (e) { } finally { setLoading(false); }
  }, [attributes, userId]);

  useEffect(() => {
      const timer = setTimeout(() => { if(userId) fetchSponsorData(); }, 600);
      return () => clearTimeout(timer);
  }, [attributes, fetchSponsorData, userId]);

  const saveToDb = () => {
      if (!sponsorName.trim()) return showAlert("Ops!", "Insira o nome do patrocinador antes de salvar.");
      
      const newItem: SavedSponsor = {
          id: crypto.randomUUID(),
          sponsorId: loadedSponsor?.sponsor_id ?? null,
          sponsorName: loadedSponsor?.name ?? sponsorName,
          name: loadedSponsor?.name ?? sponsorName,
          source: catalogSource,
          attributes: { ...attributes },
          answers: [...results.answers],
          progress: { current: attributes.currentProgress, average: attributes.averageProgress, managers: attributes.managers },
          results: { diff: results.stats.diff },
          date: new Date().toLocaleDateString('pt-BR')
      };

      // Sempre cria nova análise, permite múltiplas do mesmo patrocinador
      syncWithSupabase([newItem, ...savedSponsors]);
  };

  const deleteFromDb = (id: string, name: string) => {
      showConfirm("Excluir", `Remover "${name}" permanentemente da nuvem?`, () => {
          syncWithSupabase(savedSponsors.filter(s => s.id !== id));
      });
  };

  const loadFromDb = (item: SavedSponsor) => {
      setSponsorName(item.name);
      setCatalogQuery(item.name);
      // tenta recuperar info de catálogo para exibir no card; fallback para nome salvo
      const catalogMatch = catalogSponsors.find(c => c.name.toLowerCase() === item.name.toLowerCase() || (item.sponsorId && c.sponsor_id === item.sponsorId)) || null;
      if (catalogMatch) {
        setLoadedSponsor(catalogMatch);
      } else {
        // sem match no catálogo, cria placeholder para exibir nome no card
        setLoadedSponsor({ sponsor_id: item.sponsorId ?? 0, name: item.name, country: null, category: null, finances: item.attributes.finances - 1, expectations: item.attributes.expectations - 1, patience: item.attributes.patience - 1, reputation: item.attributes.reputation - 1, image: item.attributes.image - 1, negotiation: item.attributes.negotiation - 1 });
      }
      setAttributes(item.attributes as any);
      setCatalogSource(item.source || 'manual');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredSponsors = savedSponsors.filter(s => 
      s.name.toLowerCase().includes(sponsorName.toLowerCase())
  );

  const handleAttributeChange = (field: SponsorAttribute, value: number) => {
    // Validação managers 1-7
    if (field === 'managers') {
      if (!Number.isFinite(value) || value < 1) value = 1;
      if (value > 7) value = 7;
      value = Math.round(value);
    }
    if (field === 'currentProgress' || field === 'averageProgress') {
      if (!Number.isFinite(value) || value < 0) value = 0;
      if (value > 100) value = 100;
    }
    setAttributes(prev => ({ ...prev, [field]: value }));
  };

  const isProgressValid = (() => {
    const c = attributes.currentProgress;
    const a = attributes.averageProgress;
    const m = attributes.managers;
    return Number.isFinite(c) && c >= 0 && c <= 100 && Number.isFinite(a) && a >= 0 && a <= 100 && Number.isInteger(m) && m >= 1 && m <= 7;
  })();

  if (isAuthLoading) return (
    <div className="flex h-[100dvh] items-center justify-center bg-[#eef2f6] text-emerald-600 font-mono text-xs gap-4">
      <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-emerald-600 w-8 h-8" />
          <span className="text-[10px] font-black uppercase text-emerald-700 tracking-[0.2em] animate-pulse">Estabelecendo Link Seguro...</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-700 font-mono pb-24 overflow-x-hidden selection:bg-amber-500/20 relative">
        
        {/* GLOWS AMBIENTAIS COM TOQUE DOURADO */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/[0.01] blur-[120px] rounded-full" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-amber-500/[0.02] blur-[120px] rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/[0.01] blur-[150px] rounded-full" />
        </div>

        {/* HEADER BAR COM TOQUE DOURADO */}
        <div className="p-3 sm:p-4 max-w-6xl mx-auto sticky top-0 sm:top-2 z-40 relative">
            <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row gap-3 justify-between items-center w-full hover:border-amber-300/30">
                
                <div className="flex justify-between items-center w-full md:w-auto gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 p-2.5 rounded-xl shadow-[0_4px_12px_rgba(16,185,129,0.15)] flex items-center justify-center shrink-0">
                            <Briefcase className="text-white" size={16} />
                        </div>
                        <div className="flex flex-col text-left">
                            <h1 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none mb-1 flex items-center gap-1.5">
                                Painel Comercial
                                <Sparkles size={12} className="text-amber-400" />
                            </h1>
                            <div className="flex items-center gap-1.5">
                                <Cloud size={10} className="text-emerald-600 animate-pulse" />
                                <span className="text-[9px] text-emerald-600 font-black uppercase tracking-wider">Nuvem Sincronizada</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto md:flex-1 md:max-w-md">
                    <div className="relative flex-1" ref={searchContainerRef}>
                        <input 
                            type="text" 
                            value={catalogQuery}
                            onChange={(e) => { const v=e.target.value; setCatalogQuery(v); setSponsorName(v); if(v.trim()) setShowAutocomplete(true); else { setShowAutocomplete(false); if(!v.trim()) setLoadedSponsor(null); } }}
                            onFocus={() => { if(catalogQuery.trim() && autocompleteSuggestions.length>0) setShowAutocomplete(true); }}
                            className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-9 pr-3 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 shadow-inner hover:border-slate-300 transition-all placeholder-slate-400"
                            placeholder="Buscar patrocinador por nome..."
                            aria-label="Buscar patrocinador por nome"
                            aria-autocomplete="list"
                            aria-expanded={showAutocomplete}
                            role="combobox"
                        />
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
                        {showAutocomplete && autocompleteSuggestions.length > 0 && (
                          <ul role="listbox" className="absolute left-0 right-0 top-[46px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto overflow-x-hidden">
                            {autocompleteSuggestions.map((s) => {
                              const decodedName = decodeHtmlEntities(s.name);
                              const decodedCategory = decodeHtmlEntities(s.category || 'Geral');
                              return (
                              <li key={s.sponsor_id} role="option">
                                <button
                                  type="button"
                                  onClick={() => handleSelectCatalogSponsor(s)}
                                  className="w-full text-left px-3 py-2.5 hover:bg-amber-50 flex items-center gap-2 border-b border-slate-100 last:border-0 transition-colors"
                                >
                                  <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-700 shrink-0">{decodedName.charAt(0).toUpperCase()}</div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-black text-slate-800 truncate leading-none" title={decodedName}>{decodedName}</div>
                                    <div className="text-[10px] font-bold text-slate-400 truncate" title={decodedCategory}>{[s.country, decodedCategory].filter(Boolean).join(' · ') || 'Geral'}</div>
                                  </div>
                                </button>
                              </li>
                            );})}
                          </ul>
                        )}
                        {showAutocomplete && catalogQuery.trim() && autocompleteSuggestions.length === 0 && (
                          <div className="absolute left-0 right-0 top-[46px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 text-center">
                            <p className="text-xs font-bold text-slate-400">Nenhum patrocinador encontrado</p>
                          </div>
                        )}
                    </div>
                    <button 
                        onClick={saveToDb}
                        className="h-11 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shrink-0 font-black text-[10px] uppercase tracking-wider border border-emerald-400"
                    >
                        <Save size={14} />
                        <span>Salvar</span>
                    </button>
                </div>

            </div>
        </div>

        {/* CORPO PRINCIPAL - GRID RESPONSIVO */}
        <main className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-5 mt-2 relative z-10">
            
            {/* COLUNA ESQUERDA: CONTROLES DE NEGOCIAÇÃO */}
            <div className="lg:col-span-5 space-y-4 flex flex-col min-w-0">
                
                {/* ATRIBUTOS DO PATROCINADOR */}
                <section className="bg-white/90 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden backdrop-blur-sm hover:border-amber-300/30">
                    <div className="bg-gradient-to-r from-zinc-50 to-zinc-100/50 p-4 border-b border-slate-200 flex items-center gap-2">
                        <BarChart3 size={14} className="text-amber-500" />
                        <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Atributos do Patrocinador</h3>
                        <Crown size={12} className="text-amber-400 ml-auto" />
                    </div>
                    {loadedSponsor ? (
                      (() => {
                        const dName = decodeHtmlEntities(loadedSponsor.name);
                        const dCat = decodeHtmlEntities(loadedSponsor.category || 'Geral');
                        return (
                      <div className="px-4 pt-3 pb-0 bg-white">
                        <div className="bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-white border border-amber-200 flex items-center justify-center text-xs font-black text-amber-700 shrink-0 shadow-sm">{dName.charAt(0).toUpperCase()}</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-black text-slate-800 truncate leading-none" title={dName}>{dName}</div>
                            <div className="text-[10px] font-bold text-slate-500 truncate" title={dCat}>{dCat}</div>
                          </div>
                          <span className="text-[8px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">Carregado</span>
                        </div>
                      </div>
                        );
                      })()
                    ) : (
                      <div className="px-4 pt-3 pb-0 bg-white">
                        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl px-3 py-2.5 text-center">
                          <p className="text-[10px] font-bold text-slate-400">Nenhum patrocinador carregado</p>
                        </div>
                      </div>
                    )}
                    <div className="p-4 space-y-4 bg-white">
                        <AttributeSlider label="Finanças (Dinheiro)" value={attributes.finances} onChange={(v) => handleAttributeChange('finances', v)} />
                        <AttributeSlider label="Expectativas (Objetivos)" value={attributes.expectations} onChange={(v) => handleAttributeChange('expectations', v)} />
                        <AttributeSlider label="Paciência (Prazo)" value={attributes.patience} onChange={(v) => handleAttributeChange('patience', v)} />
                        <AttributeSlider label="Reputação (Importância)" value={attributes.reputation} onChange={(v) => handleAttributeChange('reputation', v)} />
                        <AttributeSlider label="Imagem (Relevância)" value={attributes.image} onChange={(v) => handleAttributeChange('image', v)} />
                        <AttributeSlider label="Negociação (Habilidade)" value={attributes.negotiation} onChange={(v) => handleAttributeChange('negotiation', v)} />
                    </div>
                </section>

                {/* MÉTRICAS DE PROGRESSO DA RODADA */}
                <section className="bg-white/90 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl p-4 backdrop-blur-sm bg-white hover:border-amber-300/30">
                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Gauge size={14} className="text-amber-500" /> Progresso da Rodada
                        <Star size={10} className="text-amber-400 ml-auto" />
                    </h3>
                    <div className="grid grid-cols-3 gap-2.5 font-mono">
                        <MetricInput label="Meu progresso atual" value={attributes.currentProgress} onChange={(v) => handleAttributeChange('currentProgress', v)} suffix="%" />
                        <MetricInput label="Progresso médio" value={attributes.averageProgress} onChange={(v) => handleAttributeChange('averageProgress', v)} suffix="%" />
                        <MetricInput label="Gerentes negociando" value={attributes.managers} onChange={(v) => handleAttributeChange('managers', v)} highlight />
                    </div>
                </section>
            </div>

            {/* COLUNA DIREITA: DECISÕES E KPIs */}
            <div className="lg:col-span-7 space-y-4 flex flex-col min-w-0">
                
                {/* DECISÕES SUGERIDAS */}
                <section className="bg-white/90 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl overflow-hidden flex-1 backdrop-blur-sm flex flex-col hover:border-amber-300/30">
                    <div className="bg-gradient-to-r from-emerald-50/50 to-amber-50/30 p-4 border-b border-emerald-200/50 flex justify-between items-center">
                        <h2 className="text-[11px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare size={14} className="text-amber-500" /> Decisões Recomendadas
                        </h2>
                        {loading ? (
                            <Loader2 className="animate-spin text-amber-500" size={12} />
                        ) : (
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                        )}
                    </div>
                    
                    <div className="p-3 sm:p-4 space-y-2 flex-1 flex flex-col justify-center bg-white">
                        {QUESTIONS_LABELS.map((q, index) => (
                            <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl p-3 hover:border-amber-300 hover:shadow-sm transition-all duration-300 gap-2 group shadow-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm group-hover:border-amber-300 transition-colors">0{index + 1}</span>
                                    <p className="text-[11px] text-slate-600 font-bold group-hover:text-slate-900 transition-colors uppercase">{q}</p>
                                </div>
                                <div className="px-3 py-1.5 rounded-lg border bg-gradient-to-r from-emerald-50 to-amber-50 border-emerald-300/50 text-emerald-700 text-center sm:min-w-[180px] shrink-0 shadow-sm hover:shadow-md transition-all duration-300">
                                    <span className="font-black text-[11px] uppercase tracking-wider">
                                        {translate(results.answers[index]) || "Sincronizando"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* INDICADORES DE NEGOCIAÇÃO — Vantagem + Estimativa (ALFA-009.1) */}
                {!isProgressValid ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                    <p className="text-xs font-black text-amber-800">Preencha meu progresso atual, o progresso médio e os gerentes negociando para calcular os indicadores.</p>
                    <p className="text-[10px] font-bold text-amber-700/80 mt-1">Estimativa agregada baseada no progresso médio e no número de gerentes negociando.</p>
                  </div>
                ) : (
                  (() => {
                    const vantagemBruta = (attributes.currentProgress - attributes.averageProgress) * attributes.managers;
                    const vantagemNaNegociacao = Math.max(-100, Math.min(100, vantagemBruta));
                    const totalEstimadoAdversarios = (attributes.averageProgress * attributes.managers) - attributes.currentProgress;
                    const quantidadeAdversarios = Math.max(1, attributes.managers - 1);
                    const estimativaMediaAdversarios = totalEstimadoAdversarios / quantidadeAdversarios;
                    // compat alias para regras que ainda usam nome antigo
                    const estimativaAdversarios = estimativaMediaAdversarios;
                    const isConcluida = attributes.currentProgress >= 100;
                    const statusVantagem = vantagemNaNegociacao > 0 ? 'À frente na negociação' : vantagemNaNegociacao < 0 ? 'Atrás na negociação' : 'Alinhado com a média';
                    const tituloEstimativa = attributes.managers === 2 ? 'Estimativa do adversário' : 'Estimativa dos adversários';
                    const formatSinal = (v: number) => {
                      if (!Number.isFinite(v)) return '—';
                      if (v > 0) return `+${v.toFixed(0)}`;
                      return v.toFixed(0);
                    };
                    const formatAbs = (v: number) => {
                      if (!Number.isFinite(v)) return '—';
                      const abs = Math.abs(v);
                      return abs.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
                    };
                    // --- Estimativa: cor/status DETERMINADOS PELA VANTAGEM (ALFA-009.3) — não pelo sinal da estimativa ---
                    // ALFA-009.4: média por adversário
                    const estimativaExibida = Math.abs(estimativaMediaAdversarios);
                    let estimativaStatus: string;
                    let estimativaColor: string;
                    let estimativaBg: string;
                    let estimativaBorder: string;
                    if (isConcluida) {
                      estimativaStatus = 'Negociação concluída';
                      estimativaColor = 'text-emerald-600';
                      estimativaBg = 'bg-emerald-500';
                      estimativaBorder = 'border-emerald-200 hover:border-emerald-300/50';
                    } else if (Math.abs(vantagemNaNegociacao) <= 10) {
                      estimativaStatus = 'Negociação equilibrada';
                      estimativaColor = 'text-amber-600';
                      estimativaBg = 'bg-amber-500';
                      estimativaBorder = 'border-amber-200 hover:border-amber-300/50';
                    } else if (vantagemNaNegociacao > 0) {
                      estimativaStatus = attributes.managers === 2 ? 'Adversário atrás' : 'Adversários atrás';
                      estimativaColor = 'text-emerald-600';
                      estimativaBg = 'bg-emerald-500';
                      estimativaBorder = 'border-emerald-200 hover:border-emerald-300/50';
                    } else {
                      estimativaStatus = attributes.managers === 2 ? 'Adversário à frente' : 'Adversários à frente';
                      estimativaColor = 'text-rose-600';
                      estimativaBg = 'bg-rose-500';
                      estimativaBorder = 'border-rose-200 hover:border-rose-300/50';
                    }
                    // --- Vantagem: insight inteligente ---
                    let insightVantagem = '';
                    if (isConcluida) {
                      insightVantagem = 'A negociação atingiu 100% de progresso.';
                    } else if (vantagemNaNegociacao > 0) {
                      insightVantagem = 'Você está à frente na negociação. Mantenha o acompanhamento do progresso.';
                    } else if (vantagemNaNegociacao === 0) {
                      insightVantagem = 'A negociação está alinhada com a média. Pequenas mudanças no progresso podem alterar a vantagem.';
                    } else if (vantagemNaNegociacao < 0 && Math.abs(vantagemNaNegociacao) <= 10) {
                      insightVantagem = 'Ainda dá para recuperar. A desvantagem é pequena; acompanhe o progresso da negociação.';
                    } else if (vantagemNaNegociacao < -10 && vantagemNaNegociacao >= -20) {
                      insightVantagem = 'A negociação está difícil. Será necessário aumentar o progresso para reduzir a desvantagem.';
                    } else if (vantagemNaNegociacao < -20) {
                      insightVantagem = 'A desvantagem está elevada. Avalie se ainda vale a pena continuar nesta negociação.';
                    }
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
                        {/* Vantagem na negociação */}
                        <div className={`bg-white border shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl p-4 flex flex-col relative overflow-hidden min-h-[172px] ${isConcluida ? 'border-emerald-300 ring-2 ring-emerald-200' : 'border-slate-200 hover:border-amber-300/30'}`}>
                          <div className={`absolute top-0 left-0 w-32 h-32 rounded-full blur-3xl opacity-10 ${isConcluida ? 'bg-emerald-500' : vantagemNaNegociacao > 0 ? 'bg-emerald-500' : vantagemNaNegociacao < 0 ? 'bg-rose-500' : 'bg-slate-400'}`}></div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">
                            Vantagem na negociação
                          </span>
                          {isConcluida && (
                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 w-fit mb-2 relative z-10">
                              <Crown size={10} className="text-emerald-600" /> Negociação concluída
                            </span>
                          )}
                          <span
                            title={`Bruto: ${vantagemBruta.toFixed(2)} | Exibido: ${vantagemNaNegociacao.toFixed(2)} | Backend diff: ${Number(results.stats.diff).toFixed(2)}`}
                            className={`text-[22px] leading-none font-black relative z-10 ${isConcluida ? 'text-emerald-700' : vantagemNaNegociacao > 0 ? 'text-emerald-600' : vantagemNaNegociacao < 0 ? 'text-rose-500' : 'text-slate-600'}`}
                          >
                            {formatSinal(vantagemNaNegociacao)}
                          </span>
                          <span className={`text-[10px] font-black mt-2 relative z-10 ${isConcluida ? 'text-emerald-700' : vantagemNaNegociacao > 0 ? 'text-emerald-700' : vantagemNaNegociacao < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {isConcluida ? 'Negociação concluída' : statusVantagem}
                          </span>
                          <p className="text-[10px] font-bold text-slate-500 mt-2 leading-relaxed relative z-10 border-t border-slate-100 pt-2">
                            {insightVantagem}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 mt-2 relative z-10" title={`Bruto: ${vantagemBruta.toFixed(2)}`}>Vantagem limitada a -100..+100 • Bruto {vantagemBruta > 0 ? '+' : ''}{vantagemBruta.toFixed(0)}</p>
                        </div>

                        {/* Estimativa dos adversários */}
                        <div className={`bg-white border shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl p-4 flex flex-col relative overflow-hidden min-h-[172px] ${estimativaBorder}`}>
                          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 ${estimativaBg}`}></div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">
                            {tituloEstimativa}
                          </span>
                          <span className={`text-[22px] leading-none font-black relative z-10 ${estimativaColor}`}>
                            {formatAbs(estimativaMediaAdversarios)}
                          </span>
                          <span className={`text-[10px] font-black mt-2 relative z-10 ${estimativaColor}`}>
                            {estimativaStatus}
                          </span>
                          <p className="text-[9px] font-bold text-slate-400 mt-2 leading-relaxed relative z-10">Média estimada por adversário, calculada a partir do progresso médio e do número de gerentes negociando. Não representa a porcentagem real ou confirmada de cada adversário.</p>
                        </div>
                      </div>
                    );
                  })()
                )}
            </div>

            {/* BIBLIOTECA DE ANÁLISES PESSOAIS */}
            <section className="lg:col-span-12 space-y-4 pt-4 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-2">
                        <History size={14} className="text-emerald-600" />
                        <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.25em] flex items-center gap-1.5">
                            Biblioteca de Análises
                            <Sparkles size={10} className="text-amber-400" />
                        </h3>
                    </div>
                    <span className="text-[9px] bg-white border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg w-fit shadow-sm font-black">
                        {filteredSponsors.length} análises salvas • isoladas por usuário
                    </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 w-full">
                    {filteredSponsors.length === 0 ? (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-amber-300/30 transition-all duration-300">
                            <Database size={24} className="text-slate-400 mb-2 animate-pulse" />
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Nenhum registro encontrado</p>
                        </div>
                    ) : (
                        filteredSponsors.map((item) => (
                            <motion.div 
                                key={item.id} 
                                layout 
                                className="bg-white border border-slate-200 p-3.5 rounded-2xl hover:border-amber-500/40 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group relative overflow-hidden shadow-sm hover:-translate-y-0.5"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.02] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="absolute -top-10 -right-10 w-20 h-20 bg-amber-500/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                
                                <div className="flex justify-between items-start mb-3 relative z-10">
                                    <div className="overflow-hidden min-w-0 pr-2 text-left">
                                        <h4 className="font-black text-slate-800 text-xs truncate uppercase tracking-tight group-hover:text-amber-700 transition-colors">{item.name}</h4>
                                        <span className="text-[9px] text-slate-400 font-bold block mt-0.5">{item.date}</span>
                                    </div>
                                    <button onClick={() => deleteFromDb(item.id, item.name)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all shrink-0 hover:shadow-md">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                                
                                <button 
                                    onClick={() => loadFromDb(item)} 
                                    className="w-full h-8 bg-slate-50 hover:bg-gradient-to-r hover:from-emerald-600 hover:to-emerald-700 text-[10px] font-black text-slate-500 hover:text-white rounded-lg transition-all duration-300 uppercase tracking-widest flex items-center justify-center gap-1 border border-slate-200 hover:border-emerald-400 shadow-sm hover:shadow-lg active:scale-95 relative z-10"
                                >
                                    Carregar <ChevronRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            </motion.div>
                        ))
                    )}
                </div>
            </section>

        {/* BIBLIOTECA EM NUVEM - Catálogo GPRO técnico */}
        <section className="lg:col-span-12 relative z-10">
          <div className="bg-[#0f1e3a] border border-[#1e3a5f] rounded overflow-hidden">
            <div className="bg-[#0a1628] p-3 border-b border-[#1e3a5f] flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-amber-400" />
                <h2 className="text-[11px] font-black text-white uppercase tracking-widest">Biblioteca em Nuvem</h2>
                <span className="text-[9px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">Catálogo GPRO</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400">{filteredCatalog.length} / {catalogSponsors.length} patrocinadores • somente leitura</span>
            </div>
            <div className="p-0 bg-[#0f1e3a]">
              {catalogError && (
                <div className="m-2 p-3 bg-rose-950 border border-rose-800 rounded flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-rose-300">{catalogError}</p>
                  <button onClick={() => fetchCatalog()} className="h-7 px-3 bg-[#1a2d4a] border border-rose-800 rounded text-xs font-black text-rose-300 hover:bg-rose-950">Tentar novamente</button>
                </div>
              )}
              {catalogLoading ? (
                <div className="py-8 flex flex-col items-center gap-2"><Loader2 className="animate-spin text-amber-400" size={20} /><p className="text-xs font-bold text-slate-400">Carregando catálogo...</p></div>
              ) : filteredCatalog.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 border-t border-[#1e3a5f]"><Database size={20} className="text-slate-500" /><p className="text-xs font-bold text-slate-400">Nenhum patrocinador encontrado</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#0a1628] text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-[#1e3a5f]">
                        <th className="text-left px-3 py-2 font-black border-r border-[#1e3a5f] w-[260px] min-w-[240px] max-w-[280px]">Patrocinador</th>
                        <th className="text-center px-2 py-2 border-r border-[#1e3a5f] w-[64px] min-w-[64px]">País</th>
                        <th className="text-center px-2 py-2 border-r border-[#1e3a5f]">Fin</th>
                        <th className="text-center px-2 py-2 border-r border-[#1e3a5f]">Exp</th>
                        <th className="text-center px-2 py-2 border-r border-[#1e3a5f]">Pac</th>
                        <th className="text-center px-2 py-2 border-r border-[#1e3a5f]">Rep</th>
                        <th className="text-center px-2 py-2 border-r border-[#1e3a5f]">Img</th>
                        <th className="text-center px-2 py-2 border-r border-[#1e3a5f]">Neg</th>
                        <th className="text-center px-2 py-2 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCatalog.map((s, idx) => {
                        const countryCode = String(s.country ?? '').trim().toLowerCase();
                        const countryDisplay = String(s.country ?? '??').trim().toUpperCase().slice(0,2) || '??';
                        const isValidCountry = /^[a-z]{2}$/.test(countryCode);
                        const flagSrc = `/flags/${countryCode}.png`;
                        return (
                        <tr key={s.sponsor_id} className={`${idx % 2 === 0 ? 'bg-[#0f1e3a]' : 'bg-[#132a4a]'} hover:bg-[#1a3a5f] border-b border-[#1e3a5f]/50 transition-colors`}>
                          <td className="px-3 py-2 border-r border-[#1e3a5f]/50 w-[260px] min-w-[240px] max-w-[280px]" style={{width: '260px'}}>
                            {(() => {
                              const dName = decodeHtmlEntities(s.name);
                              const dCat = decodeHtmlEntities(s.category || 'Geral');
                              return (
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded bg-[#1e3a5f] flex items-center justify-center text-white font-black text-[10px] shrink-0 border border-[#2a4a6b]">{dName.charAt(0).toUpperCase()}</div>
                              <div className="min-w-0 flex-1">
                                <div className="font-black text-white text-xs leading-none truncate" title={dName}>{dName}</div>
                                <div className="text-[10px] font-bold text-slate-400 truncate" title={dCat}>{dCat}</div>
                              </div>
                            </div>
                              );
                            })()}
                          </td>
                          <td className="px-2 py-2 text-center border-r border-[#1e3a5f]/50 w-[64px] min-w-[64px]">
                            <div className="flex flex-col items-center gap-1">
                              {isValidCountry ? (
                                <img
                                  src={flagSrc}
                                  alt={`Bandeira do país ${countryDisplay}`}
                                  className="w-6 h-4 object-cover rounded-sm border border-[#2a4a6b] shadow-sm"
                                  loading="lazy"
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : null}
                              <span className="text-[10px] font-bold text-white leading-none">{countryDisplay}</span>
                            </div>
                          </td>
                          {[
                            { v: s.finances, l: 'Fin' },
                            { v: s.expectations, l: 'Exp' },
                            { v: s.patience, l: 'Pac' },
                            { v: s.reputation, l: 'Rep' },
                            { v: s.image, l: 'Img' },
                            { v: s.negotiation, l: 'Neg' },
                          ].map((a) => (
                            <td key={a.l} className="px-2 py-2 text-center border-r border-[#1e3a5f]/50">
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-mono font-black text-white text-xs">{a.v + 1}</span>
                                <div className="w-10 h-1 bg-[#0a1628] rounded-full overflow-hidden border border-[#1e3a5f]">
                                  <div className="h-full rounded-full" style={{ width: `${((a.v + 1) / 7) * 100}%`, background: a.v + 1 <= 2 ? '#ef4444' : a.v + 1 >= 6 ? '#22c55e' : a.v + 1 <= 4 ? '#eab308' : '#84cc16', boxShadow: a.v + 1 >= 6 ? '0 0 4px rgba(34,197,94,0.5)' : 'none' }} />
                                </div>
                              </div>
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => handleSelectCatalogSponsor(s)}
                              className="h-7 px-3 bg-amber-500 hover:bg-amber-400 text-[#0a1628] rounded text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 mx-auto border border-amber-400"
                            >
                              Carregar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-3 py-2 bg-[#0a1628] border-t border-[#1e3a5f] flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-500">Catálogo técnico GPRO • somente leitura • 6 atributos editáveis após carregar</p>
                <span className="text-[9px] font-mono text-slate-600">{catalogSponsors.length} registros</span>
              </div>
            </div>
          </div>
        </section>


        </main>

        {/* MODAL SYSTEM COM TOQUE DOURADO */}
        <AnimatePresence>
            {modal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
                    <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white border border-slate-200 w-full max-w-xs rounded-2xl shadow-2xl relative z-10 overflow-hidden">
                        <div className={`h-1 w-full ${modal.type === 'alert' ? 'bg-gradient-to-r from-amber-500 to-amber-600' : modal.type === 'confirm' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-emerald-500 to-amber-500'}`} />
                        <div className="p-5 text-left bg-white">
                            <h3 className="text-sm font-black text-slate-800 uppercase mb-2 flex items-center gap-1.5">
                                {modal.type === 'alert' && <TrendingDown size={14} className="text-amber-500" />}
                                {modal.type === 'confirm' && <Crown size={14} className="text-emerald-500" />}
                                {modal.type === 'info' && <Info size={14} className="text-emerald-500" />}
                                {modal.title}
                            </h3>
                            <p className="text-slate-500 text-[11px] leading-relaxed mb-6 font-bold">{modal.message}</p>
                            <div className="flex gap-2">
                                {modal.type === 'confirm' ? (
                                    <>
                                        <button onClick={closeModal} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all duration-300 shadow-sm hover:shadow-md">Cancelar</button>
                                        <button onClick={() => { modal.onConfirm?.(); closeModal(); }} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 shadow-md hover:shadow-lg active:scale-95">Confirmar</button>
                                    </>
                                ) : (
                                    <button onClick={closeModal} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all duration-300 shadow-sm hover:shadow-md">Entendido</button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    </div>
  );
}

// --- SUB-COMPONENTES OTIMIZADOS COM TOQUE DOURADO ---

function AttributeSlider({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
    return (
        <div className="flex flex-col gap-1.5 group">
            <div className="flex justify-between items-end px-0.5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider group-hover:text-amber-600 transition-colors">{label}</span>
                <span className="text-[10px] font-black text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 shadow-sm group-hover:border-amber-300 transition-colors">{value} <span className="text-slate-400">/ 7</span></span>
            </div>
            
            <div className="flex gap-1 h-5 sm:h-6">
                {[1, 2, 3, 4, 5, 6, 7].map((idx) => {
                    const isActive = idx <= value;
                    let colorClass = 'bg-slate-50 border-slate-200 hover:bg-slate-100';
                    
                    if (isActive) {
                        if (value <= 2) colorClass = 'bg-rose-500 border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.15)] hover:bg-rose-600';
                        else if (value >= 6) colorClass = 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)] hover:bg-emerald-600';
                        else colorClass = 'bg-amber-500 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.15)] hover:bg-amber-600';
                    }

                    return (
                        <button 
                            key={idx} 
                            onClick={() => onChange(idx)} 
                            className={`flex-1 rounded-sm border transition-all duration-300 hover:scale-105 active:scale-95 ${colorClass}`}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function MetricInput({ label, value, onChange, suffix, highlight }: { label: string, value: number, onChange: (val: number) => void, suffix?: string, highlight?: boolean }) {
    return (
        <div className={`flex flex-col bg-white p-2 sm:p-2.5 rounded-xl border transition-all duration-300 shadow-sm hover:shadow-md hover:border-amber-300/50 ${highlight ? 'border-amber-300 bg-gradient-to-r from-amber-50/50 to-amber-100/30' : 'border-slate-200 bg-[#f8fafc] hover:bg-white'}`}>
            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${highlight ? 'text-amber-600' : 'text-slate-400'}`}>
                {label}
            </span>
            <div className="flex items-center gap-0.5">
                <input 
                    type="number" 
                    value={value} 
                    onChange={(e) => onChange(Number(e.target.value))} 
                    className={`w-full bg-transparent text-xs font-black outline-none ${highlight ? 'text-amber-600' : 'text-slate-800'}`} 
                />
                {suffix && <span className="text-[10px] font-bold text-slate-400">{suffix}</span>}
            </div>
        </div>
    )
}