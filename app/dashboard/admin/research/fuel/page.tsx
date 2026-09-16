'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/app/lib/supabase';
import { Activity, Brain, ChevronLeft, Flame, Grid2x2, Layers3, Lightbulb, Scale, Sigma } from 'lucide-react';
import { FuelDataTab } from '@/app/components/research/FuelDataTab';
import { FuelDiscoveryTab } from '@/app/components/research/FuelDiscoveryTab';
import { FuelCorrelationTab } from '@/app/components/research/FuelCorrelationTab';
import { FuelHypothesesTab } from '@/app/components/research/FuelHypothesesTab';
import { ResearchVariablesTab } from '@/app/components/research/ResearchVariablesTab';
import { ResearchInsightsTab } from '@/app/components/research/ResearchInsightsTab';
import { ResearchEvidenceTab } from '@/app/components/research/ResearchEvidenceTab';
import type { FuelLabResponse, FuelObservationRow } from '@/app/components/research/fuel-types';
import type { ResearchQuery } from '@/app/components/research/ResearchQueryBuilder';

const TABS = [
  { id: 'data', label: 'Data', icon: Grid2x2 },
  { id: 'discovery', label: 'Discovery', icon: Activity },
  { id: 'variables', label: 'Variables', icon: Layers3 },
  { id: 'correlations', label: 'Correlations', icon: Sigma },
  { id: 'hypotheses', label: 'Hypotheses', icon: Brain },
  { id: 'evidence', label: 'Evidence', icon: Scale },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
] as const;

type TabId = (typeof TABS)[number]['id'];

const EMPTY_RESEARCH_QUERY: ResearchQuery = {
  track: '',
  compound: '',
  weather: '',
  season: '',
  race: '',
  endpoint: '',
  source: '',
  tempMin: '',
  tempMax: '',
  wearMin: '',
  wearMax: '',
  onlyWear: false,
  onlyCompound: false,
  onlyTemperature: false,
};

function formatDate(value: string | null) {
  if (!value) return 'Disponível em próxima fase';
  return new Date(value).toLocaleString('pt-BR');
}

function includesText(value: string | number | null | undefined, query: string) {
  if (!query.trim()) return true;
  return String(value ?? '').toLowerCase().includes(query.trim().toLowerCase());
}

function matchesNumericRange(value: number | null, min: string, max: string) {
  if (value === null) return false;
  const minValue = min.trim() ? Number(min) : null;
  const maxValue = max.trim() ? Number(max) : null;
  if (minValue !== null && Number.isFinite(minValue) && value < minValue) return false;
  if (maxValue !== null && Number.isFinite(maxValue) && value > maxValue) return false;
  return true;
}

export default function FuelLabPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FuelLabResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('data');
  const [query, setQuery] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [researchQuery, setResearchQuery] = useState<ResearchQuery>(EMPTY_RESEARCH_QUERY);
  const [selectedRow, setSelectedRow] = useState<FuelObservationRow | null>(null);

  useEffect(() => {
    async function loadAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          setUserId(session.user.id);
        }
      } catch (err) {
        console.error('Erro ao carregar sessão:', err);
      } finally {
        setIsLoadingAuth(false);
      }
    }

    loadAuth();
  }, []);

  useEffect(() => {
    if (!userId) return;

    async function loadData() {
      setIsLoadingData(true);
      setError(null);

      try {
        const response = await fetch('/api/admin/research/fuel', {
          headers: {
            'Content-Type': 'application/json',
            'user-id': userId ?? '',
          },
        });

        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Erro ao carregar Fuel Lab');
        }

        setData(payload);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar Fuel Lab');
      } finally {
        setIsLoadingData(false);
      }
    }

    loadData();
  }, [userId]);

  const filteredDataset = useMemo(() => {
    if (!data) return [];

    return data.dataset.filter(row => {
      const matchesQuery = !query || [
        row.track,
        row.weather,
        row.endpoint,
        row.source,
        row.season !== null && row.race !== null ? `S${row.season} · R${row.race}` : '',
      ].some(value => includesText(value, query));

      const matchesTrack = !trackFilter || row.track === trackFilter;
      const matchesSource = !sourceFilter || row.source === sourceFilter;
      const matchesResearchTrack = !researchQuery.track || row.track === researchQuery.track;
      const matchesCompound = true;
      const matchesWeather = !researchQuery.weather || row.weather === researchQuery.weather;
      const matchesSeason = !researchQuery.season || String(row.season ?? '').includes(researchQuery.season.trim());
      const matchesRace = !researchQuery.race || String(row.race ?? '').includes(researchQuery.race.trim());
      const matchesEndpoint = !researchQuery.endpoint || row.endpoint === researchQuery.endpoint;
      const matchesSourceQuery = !researchQuery.source || row.source === researchQuery.source;
      const matchesTempRange = (!researchQuery.onlyTemperature || row.temperature !== null) && matchesNumericRange(row.temperature, researchQuery.tempMin, researchQuery.tempMax);
      const matchesWearRange = true;
      const matchesOnlyCompound = true;

      return matchesQuery
        && matchesTrack
        && matchesSource
        && matchesResearchTrack
        && matchesCompound
        && matchesWeather
        && matchesSeason
        && matchesRace
        && matchesEndpoint
        && matchesSourceQuery
        && matchesTempRange
        && matchesWearRange
        && matchesOnlyCompound;
    });
  }, [data, query, trackFilter, sourceFilter, researchQuery]);

  const uniqueTracks = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.dataset.map(row => row.track).filter(Boolean) as string[])).sort();
  }, [data]);

  const uniqueSources = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.dataset.map(row => row.source))).sort();
  }, [data]);

  const variableCatalog = data?.knowledgePanel.variableCatalog ?? [];
  const variableStats = useMemo(() => {
    return {
      total: variableCatalog.length,
      consolidated: variableCatalog.filter(variable => variable.maturity === 'Consolidada').length,
      numeric: variableCatalog.filter(variable => variable.sampleType === 'number').length,
      categorical: variableCatalog.filter(variable => variable.sampleType === 'string').length,
    };
  }, [variableCatalog]);

  const overview = data?.overview ?? {
    snapshotsAnalyzed: 0,
    observations: 0,
    uniqueTracks: 0,
    fieldsAudited: 0,
    coverage: 0,
    fuelSignals: 0,
  };

  const header = data?.header ?? {
    observationCount: 0,
    raceCount: 0,
    trackCount: 0,
    latestUpdate: null,
  };

  if (isLoadingAuth || isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#f7fbf9,_#edf3f0_40%,_#e4ebe7_100%)] text-slate-800">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black text-slate-600 shadow-sm">
          Carregando Fuel Research Lab...
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#f7fbf9,_#edf3f0_40%,_#e4ebe7_100%)] p-6 text-slate-800">
        <div className="max-w-lg rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Fuel Research Lab</p>
          <h1 className="mt-3 text-3xl font-black text-slate-950">Acesso necessário</h1>
          <p className="mt-3 text-sm text-slate-600">Faça login para consultar os dados reais já coletados pela Knowledge Platform.</p>
          <Link href="/dashboard/admin/gpro-kb" className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800">
            <ChevronLeft size={14} /> Voltar ao Knowledge Center
          </Link>
        </div>
      </div>
    );
  }

  const latestUpdateLabel = formatDate(header.latestUpdate);
  const handleClearResearchQuery = () => setResearchQuery(EMPTY_RESEARCH_QUERY);
  const handleSaveResearchQuery = () => { void 0; };
  const handleExportResearchQuery = (_format: 'csv' | 'json' | 'markdown') => { void 0; };

  const tabContent = (() => {
    if (!data) return null;
    switch (activeTab) {
      case 'data':
        return (
          <FuelDataTab
            overview={overview}
            header={header}
            filteredDataset={filteredDataset}
            trackExplorer={data.trackExplorer}
            uniqueTracks={uniqueTracks}
            uniqueSources={uniqueSources}
            query={query}
            setQuery={setQuery}
            trackFilter={trackFilter}
            setTrackFilter={setTrackFilter}
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
            selectedRow={selectedRow}
            setSelectedRow={setSelectedRow}
            data={data}
            queryState={researchQuery}
            setQueryState={setResearchQuery}
            onClearQuery={handleClearResearchQuery}
            onSaveQuery={handleSaveResearchQuery}
            onExportQuery={handleExportResearchQuery}
          />
        );
      case 'discovery':
        return <FuelDiscoveryTab data={data} />;
      case 'variables':
        return <ResearchVariablesTab variables={data.knowledgePanel.variableCatalog} title="Catálogo científico de variáveis observadas" description="Esta aba organiza as variáveis encontradas nos snapshots em vez de mostrar apenas linhas." />;
      case 'correlations':
        return <FuelCorrelationTab data={data} />;
      case 'hypotheses':
        return <FuelHypothesesTab data={data} />;
      case 'evidence':
        return <ResearchEvidenceTab variables={data.knowledgePanel.variableCatalog} datasetLength={data.dataset.length} dataset={data.dataset} lab="fuel" />;
      case 'insights':
        return <ResearchInsightsTab variables={data.knowledgePanel.variableCatalog} datasetLength={data.dataset.length} dataset={data.dataset} lab="fuel" />;
      default:
        return null;
    }
  })();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7fbf9,_#edf3f0_40%,_#e4ebe7_100%)] text-slate-800">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 pb-24 md:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 p-6 md:p-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-emerald-700">
                <Flame size={12} />
                Research Center
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">Fuel Research Lab</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
                Laboratório de pesquisa para engenharia reversa de sinais reais de combustível.
              </p>
            </div>
            <Link href="/dashboard/admin/research" className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              <ChevronLeft size={14} /> Research Center
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-slate-200/70 p-6 md:grid-cols-4 lg:grid-cols-4">
            <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 md:col-span-1 lg:col-span-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Observações</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{header.observationCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Corridas</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{header.raceCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pistas</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{header.trackCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Última atualização</p>
              <p className="mt-2 text-sm font-black text-slate-900">{latestUpdateLabel}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-200/70 p-6 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vari?veis encontradas</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{variableStats.total}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vari?veis consolidadas</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{variableStats.consolidated}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vari?veis num?ricas</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{variableStats.numeric}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vari?veis categ?ricas</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{variableStats.categorical}</p>
            </div>
          </div>

        </header>

        {error ? <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}

        <section className="mt-6 rounded-[1.5rem] border border-white/70 bg-white/85 p-3 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest transition ${
                    active ? 'bg-slate-950 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={14} /> {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        <main className="mt-6">{tabContent}</main>
      </div>
    </div>
  );
}
