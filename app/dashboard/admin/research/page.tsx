'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/app/lib/supabase';
import { Brain, ChevronLeft, FlaskConical, Flame, Layers3, Radar, Scale, Search, Sigma } from 'lucide-react';
import { ResearchOverview } from '@/app/components/research/ResearchOverview';
import { ResearchLabCard } from '@/app/components/research/ResearchLabCard';
import { ResearchTopVariables } from '@/app/components/research/ResearchTopVariables';
import { ResearchVariableSearch } from '@/app/components/research/ResearchVariableSearch';
import { EvidenceCard } from '@/app/components/research/EvidenceCard';
import { buildFuelEvidences } from '@/app/components/research/evidence-builder';
import type { FuelLabResponse } from '@/app/components/research/fuel-types';
import type { ResearchObservatoryData, ResearchLabSummary, ResearchVariableSummary } from '@/app/components/research/research-observatory-types';

function formatDate(value: string | null) {
  if (!value) return 'Disponível em próxima fase';
  return new Date(value).toLocaleString('pt-BR');
}

export default function ResearchObservatoryPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fuelData, setFuelData] = useState<FuelLabResponse | null>(null);
  const [search, setSearch] = useState('');

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
          throw new Error(payload.error || 'Erro ao carregar Research Observatory');
        }

        setFuelData(payload);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar Research Observatory');
      } finally {
        setIsLoadingData(false);
      }
    }

    loadData();
  }, [userId]);

  const observatory = useMemo<ResearchObservatoryData>(() => {
    const fuelVariables = fuelData?.knowledgePanel.variableCatalog ?? [];
    const fuelLab: ResearchLabSummary = {
      id: 'fuel',
      name: 'Fuel Lab',
      status: 'Ativo',
      variableCount: fuelVariables.length,
      excellentVariables: fuelVariables.filter(variable => variable.researchLevel === 'Excelente').length,
      maxResearchScore: fuelVariables.reduce((max, variable) => Math.max(max, variable.researchScore), 0),
      route: '/dashboard/admin/research/fuel',
    };

    const tyreLab: ResearchLabSummary = {
      id: 'tyre',
      name: 'Tyre Lab',
      status: 'Em evolução',
      variableCount: 0,
      excellentVariables: 0,
      maxResearchScore: 0,
      route: '/dashboard/admin/research/tyres',
    };

    const futureLab: ResearchLabSummary = {
      id: 'driver',
      name: 'Driver Lab',
      status: 'Em construção',
      variableCount: 0,
      excellentVariables: 0,
      maxResearchScore: 0,
      route: '/dashboard/admin/research',
    };

    const setupLab: ResearchLabSummary = {
      id: 'setup',
      name: 'Setup Lab',
      status: 'Em construção',
      variableCount: 0,
      excellentVariables: 0,
      maxResearchScore: 0,
      route: '/dashboard/admin/research',
    };

    const labs = [fuelLab, tyreLab, futureLab, setupLab];
    const variables: ResearchVariableSummary[] = fuelVariables
      .map(variable => ({
        labId: 'fuel',
        labName: 'Fuel Lab',
        path: variable.path,
        score: variable.researchScore,
        coverage: variable.coverage,
        type: variable.sampleType,
        level: variable.researchLevel,
        endpoints: variable.endpoints,
        route: '/dashboard/admin/research/fuel',
      }))
      .sort((a, b) => b.score - a.score || b.coverage - a.coverage || a.path.localeCompare(b.path));

    const fuelEvidences = fuelData
      ? buildFuelEvidences(fuelData.knowledgePanel.variableCatalog, fuelData.dataset.length, fuelData.dataset)
      : [];
    const topEvidences = fuelEvidences
      .sort((a, b) => b.confidence - a.confidence || b.observations - a.observations)
      .slice(0, 5);

    return {
      labs,
      variables,
      overview: {
        activeLabs: labs.filter(lab => lab.status === 'Ativo').length,
        catalogedVariables: variables.length,
        excellentVariables: variables.filter(variable => variable.level === 'Excelente').length,
        maxResearchScore: variables.length ? variables[0].score : 0,
      },
      topEvidences,
    };
  }, [fuelData]);

  const filteredVariables = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return observatory.variables;
    return observatory.variables.filter(variable => (
      variable.path.toLowerCase().includes(query)
      || variable.labName.toLowerCase().includes(query)
      || variable.type.toLowerCase().includes(query)
      || variable.level.toLowerCase().includes(query)
      || variable.endpoints.some(endpoint => endpoint.toLowerCase().includes(query))
    ));
  }, [observatory.variables, search]);

  const topVariables = filteredVariables.slice(0, 20);

  if (isLoadingAuth || isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#f7fbf9,_#edf3f0_40%,_#e4ebe7_100%)] text-slate-800">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black text-slate-600 shadow-sm">
          Carregando Research Observatory...
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_#f7fbf9,_#edf3f0_40%,_#e4ebe7_100%)] p-6 text-slate-800">
        <div className="max-w-lg rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Research Observatory</p>
          <h1 className="mt-3 text-3xl font-black text-slate-950">Acesso necessário</h1>
          <p className="mt-3 text-sm text-slate-600">Faça login para acessar a central de engenharia reversa da plataforma.</p>
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
        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <aside className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-emerald-700">
              <Radar size={12} />
              Research
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Observatory</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Research Observatory</h2>
            </div>
            <nav className="mt-6 space-y-2">
              <Link href="/dashboard/admin/research" className="flex items-center justify-between rounded-2xl border border-slate-950 bg-slate-950 px-4 py-3 text-sm font-black text-white">
                <span>Observatory</span>
                <FlaskConical size={16} />
              </Link>
              <Link href="/dashboard/admin/research/fuel" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                <span>Fuel Lab</span>
                <Flame size={16} className="text-amber-600" />
              </Link>
              <Link href="/dashboard/admin/research/tyres" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                <span>Tyre Lab</span>
                <Sigma size={16} className="text-sky-600" />
              </Link>
              <Link href="/dashboard/admin/research/driver-energy" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                <span>Driver Energy Lab</span>
                <Brain size={16} className="text-emerald-600" />
              </Link>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-400">
                <span>Setup Lab (em breve)</span>
                <Layers3 size={16} />
              </div>
            </nav>
          </aside>

          <main className="space-y-6">
            <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-700">Research Observatory</p>
                  <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">Central de engenharia reversa da plataforma</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
                    Uma visão única para saber quais laboratórios existem, quais variáveis são mais promissoras e para onde o pesquisador deve ir.
                  </p>
                </div>
                <Link href="/dashboard/admin/gpro-kb" className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                  <ChevronLeft size={14} /> Knowledge Center
                </Link>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Labs ativos</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{observatory.overview.activeLabs}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Variáveis catalogadas</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{observatory.overview.catalogedVariables}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Variáveis excelentes</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{observatory.overview.excellentVariables}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Maior Research Score</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{observatory.overview.maxResearchScore}</p>
                </div>
              </div>
            </section>

            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}

            <ResearchVariableSearch value={search} onChange={setSearch} />

            <section className="grid gap-4 xl:grid-cols-2">
              {observatory.labs.map(lab => (
                <ResearchLabCard key={lab.id} lab={lab} />
              ))}
            </section>

            <ResearchOverview data={observatory} />

            <ResearchTopVariables variables={topVariables} />

            {(observatory as any).topEvidences?.length > 0 && (
              <section className="rounded-[2rem] border border-indigo-200/60 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-indigo-700">
                  <Scale size={12} />
                  Top Observational Signals
                </div>
                <h2 className="mt-2 text-xl font-black text-slate-950">Sinais observacionais em destaque</h2>
                <p className="mt-1 text-sm text-slate-600">Os 5 sinais com melhor suporte observacional no Fuel Lab.</p>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {(observatory as any).topEvidences.map((evidence: any) => (
                    <EvidenceCard key={evidence.id} evidence={evidence} />
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
