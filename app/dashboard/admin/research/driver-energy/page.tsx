'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/app/lib/supabase';
import { Activity, Brain, ChevronLeft, Flame, Grid2x2, Layers3, Lightbulb, Scale, Sigma, Zap } from 'lucide-react';
import { ResearchVariablesTab } from '@/app/components/research/ResearchVariablesTab';
import { ResearchInsightsTab } from '@/app/components/research/ResearchInsightsTab';
import { ResearchEvidenceTab } from '@/app/components/research/ResearchEvidenceTab';
import { DriverEnergyHypothesesTab } from '@/app/components/research/DriverEnergyHypothesesTab';
import type { DriverEnergyLabResponse } from '@/app/components/research/driver-energy-types';

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

function formatDate(value: string | null) {
  if (!value) return 'Disponível em próxima fase';
  return new Date(value).toLocaleString('pt-BR');
}

export default function DriverEnergyLabPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DriverEnergyLabResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('data');

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
        const response = await fetch('/api/admin/research/driver-energy', {
          headers: {
            'Content-Type': 'application/json',
            'user-id': userId ?? '',
          },
        });

        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Erro ao carregar Driver Energy Lab');
        }

        setData(payload);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar Driver Energy Lab');
      } finally {
        setIsLoadingData(false);
      }
    }

    loadData();
  }, [userId]);

  const overview = data?.overview ?? {
    observations: 0,
    racesAnalyzed: 0,
    pilots: 0,
    uniqueTracks: 0,
    coverage: 0,
    variablesCataloged: 0,
    maxResearchScore: 0,
  };

  const header = data?.header ?? {
    observationCount: 0,
    raceCount: 0,
    trackCount: 0,
    latestUpdate: null,
  };

  const variableCatalog = data?.knowledgePanel.variableCatalog ?? [];
  const latestUpdateLabel = formatDate(header.latestUpdate);

  const tabContent = (() => {
    if (!data) return null;
    switch (activeTab) {
      case 'data':
        return (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Energia inicial</p><p className="mt-2 text-2xl font-black text-slate-900">{data.dataset.filter(row => row.energyInitial !== null).length}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Energia final</p><p className="mt-2 text-2xl font-black text-slate-900">{data.dataset.filter(row => row.energyFinal !== null).length}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Energia perdida</p><p className="mt-2 text-2xl font-black text-slate-900">{data.dataset.filter(row => row.energyLost !== null).length}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Energia recuperada</p><p className="mt-2 text-2xl font-black text-slate-900">{data.dataset.filter(row => row.energyRecovered !== null).length}</p></div>
          </section>
        );
      case 'discovery':
        return (
          <section className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Research Score médio</p><p className="mt-2 text-2xl font-black text-slate-900">{data.discovery.averageResearchScore}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Variáveis</p><p className="mt-2 text-2xl font-black text-slate-900">{data.discovery.variableCount}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Excelentes</p><p className="mt-2 text-2xl font-black text-slate-900">{data.discovery.excellentVariables}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cobertura</p><p className="mt-2 text-2xl font-black text-slate-900">{data.discovery.coverage}%</p></div>
          </section>
        );
      case 'variables':
        return <ResearchVariablesTab variables={variableCatalog} title="Catálogo científico de variáveis observadas" description="Esta aba organiza as variáveis encontradas nos snapshots em vez de mostrar apenas linhas." />;
      case 'correlations':
        return <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur"><p className="text-sm font-medium text-slate-600">Variáveis candidatas: energia, temperatura, clima, pista, driver, temporada.</p></section>;
      case 'hypotheses':
        return <DriverEnergyHypothesesTab data={data} />;
      case 'evidence':
        return <ResearchEvidenceTab variables={data.knowledgePanel.variableCatalog} datasetLength={data.dataset.length} dataset={data.dataset} lab="driver-energy" />;
      case 'insights':
        return <ResearchInsightsTab variables={data.knowledgePanel.variableCatalog} datasetLength={data.dataset.length} dataset={data.dataset} lab="driver-energy" />;
      default:
        return null;
    }
  })();

  if (isLoadingAuth || isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#f7fbf9,_#edf3f0_40%,_#e4ebe7_100%)] text-slate-800">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black text-slate-600 shadow-sm">
          Carregando Driver Research Lab...
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#f7fbf9,_#edf3f0_40%,_#e4ebe7_100%)] p-6 text-slate-800">
        <div className="max-w-lg rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Driver Research Lab</p>
          <h1 className="mt-3 text-3xl font-black text-slate-950">Acesso necessário</h1>
          <p className="mt-3 text-sm text-slate-600">Faça login para consultar os dados reais já coletados pela Knowledge Platform.</p>
          <Link href="/dashboard/admin/gpro-kb" className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800">
            <ChevronLeft size={14} /> Voltar ao Knowledge Center
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7fbf9,_#edf3f0_40%,_#e4ebe7_100%)] text-slate-800">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 pb-24 md:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 p-6 md:p-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-emerald-700">
                <Zap size={12} />
                Research Center
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">Driver Research Lab</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
                Laboratório de pesquisa para energia do piloto.
              </p>
            </div>
            <Link href="/dashboard/admin/research" className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              <ChevronLeft size={14} /> Research Center
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-slate-200/70 p-6 md:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Observações</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{header.observationCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Corridas</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{header.raceCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pilotos</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{overview.pilots}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pistas</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{header.trackCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Variáveis catalogadas</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{overview.variablesCataloged}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Maior Research Score</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{overview.maxResearchScore}</p>
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
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest transition ${active ? 'bg-slate-950 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
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
