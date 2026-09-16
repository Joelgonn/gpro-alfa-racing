'use client';

import { useMemo } from 'react';
import type { Insight, InsightSection } from './ResearchInsightTypes';
import type { ResearchVariableRow } from '@/app/lib/research/research-variable-catalog';

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-950">{insight.title}</p>
          <p className="mt-1 text-sm text-slate-600">{insight.description}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-4 text-xs">
          <span className="font-black uppercase tracking-widest text-slate-400">Observações</span>
          <span className="font-black text-slate-900">{insight.evidenceCount}</span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="font-black uppercase tracking-widest text-slate-400">Suporte</span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, insight.confidence)}%` }} />
            </div>
            <span className="font-black text-slate-900">{insight.confidence}%</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="font-black uppercase tracking-widest text-slate-400">Variáveis</span>
          <div className="flex flex-wrap gap-1">
            {insight.variables.slice(0, 5).map(variable => (
              <span key={variable} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {variable}
              </span>
            ))}
            {insight.variables.length > 5 && (
              <span className="text-[10px] text-slate-400">+{insight.variables.length - 5}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="font-black uppercase tracking-widest text-slate-400">Origem</span>
          <span className="text-slate-600">{insight.source}</span>
        </div>
      </div>
    </div>
  );
}

function buildFuelInsights(variables: ResearchVariableRow[], datasetLength: number): InsightSection[] {
  const sections: InsightSection[] = [];

  const sortedByCoverage = [...variables].sort((a, b) => b.coverage - a.coverage);
  const topCoverage = sortedByCoverage.slice(0, 5);
  if (topCoverage.length > 0) {
    sections.push({
      title: 'Variáveis com maior cobertura',
      insights: topCoverage.map(v => ({
        title: `${v.path} — ${v.coverage}% de cobertura`,
        description: `Presente em ${v.occurrences} de ${datasetLength} observações. Tipo: ${v.sampleType}. Maturidade: ${v.maturity}.`,
        evidenceCount: v.occurrences,
        variables: [v.path],
        confidence: v.researchScore,
        source: `Campo observado em ${v.endpoints.length} endpoint(s) desde ${v.firstSeen?.split('T')[0] ?? '—'}.`,
      })),
    });
  }

  const scored = [...variables].sort((a, b) => b.researchScore - a.researchScore);
  const topScored = scored.slice(0, 5);
  if (topScored.length > 0) {
    sections.push({
      title: 'Variáveis mais promissoras',
      insights: topScored.map(v => ({
        title: `${v.path} — Research Score ${v.researchScore}`,
        description: `Nível: ${v.researchLevel}. Cobertura: ${v.coverage}%. ${v.categoricalStats ? `Top valores: ${v.categoricalStats.topValues.slice(0, 3).map(t => `${t.value} (${t.count})`).join(', ')}` : v.numericStats ? `Faixa: ${v.numericStats.min} a ${v.numericStats.max}` : ''}`,
        evidenceCount: v.occurrences,
        variables: [v.path],
        confidence: v.researchScore,
        source: `Avaliado por ${v.researchReasons.length > 0 ? v.researchReasons[0] : 'critérios de research score'}.`,
      })),
    });
  }

  const endpointMap = new Map<string, number>();
  for (const v of variables) {
    for (const ep of v.endpoints) {
      endpointMap.set(ep, (endpointMap.get(ep) ?? 0) + 1);
    }
  }
  const topEndpoints = [...endpointMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topEndpoints.length > 0) {
    sections.push({
      title: 'Endpoints mais ricos',
      insights: topEndpoints.map(([endpoint, count]) => ({
        title: `${endpoint} — ${count} variáveis`,
        description: `Endpoint com ${count} campos distintos catalogados a partir das observações disponíveis.`,
        evidenceCount: count,
        variables: variables.filter(v => v.endpoints.includes(endpoint)).map(v => v.path).slice(0, 5),
        confidence: Math.min(100, Math.round((count / Math.max(1, variables.length)) * 100)),
        source: `Dados extraídos do endpoint ${endpoint}.`,
      })),
    });
  }

  const fieldPairs: string[] = [];
  const fieldSet = variables.slice(0, 30).map(v => v.path);
  for (let i = 0; i < Math.min(30, fieldSet.length); i++) {
    for (let j = i + 1; j < Math.min(30, fieldSet.length); j++) {
      const vi = variables.find(v => v.path === fieldSet[i]);
      const vj = variables.find(v => v.path === fieldSet[j]);
      if (vi && vj) {
        const commonEndpoints = vi.endpoints.filter(ep => vj.endpoints.includes(ep));
        if (commonEndpoints.length > 1) {
          fieldPairs.push(`${fieldSet[i]} + ${fieldSet[j]} (${commonEndpoints.length} endpoints)`);
        }
      }
    }
  }

  if (fieldPairs.length > 0) {
    sections.push({
      title: 'Campos que aparecem juntos',
      insights: fieldPairs.slice(0, 5).map(pair => ({
        title: pair,
        description: `Estes campos foram observados nos mesmos endpoints em múltiplas ocasiões, sugerindo correlação estrutural.`,
        evidenceCount: variables.length > 0 ? Math.round(variables.length / 2) : 0,
        variables: pair.split(' + ').map(s => s.split(' (')[0]),
        confidence: 60,
        source: 'Co-ocorrência observada no catálogo de variáveis.',
      })),
    });
  }

  return sections;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTyreInsights(variables: ResearchVariableRow[], datasetLength: number, dataset: any[]): InsightSection[] {
  const sections: InsightSection[] = [];

  const compoundMap = new Map<string, number>();
  for (const row of dataset) {
    const compound = row.compound;
    if (compound) compoundMap.set(compound, (compoundMap.get(compound) ?? 0) + 1);
  }
  const topCompounds = [...compoundMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topCompounds.length > 0) {
    sections.push({
      title: 'Compostos mais observados',
      insights: topCompounds.map(([compound, count]) => ({
        title: `${compound} — ${count} observações`,
        description: `Composto presente em ${count} registros do dataset, representando ${Math.round((count / Math.max(1, datasetLength)) * 100)}% das observações.`,
        evidenceCount: count,
        variables: [`compound:${compound}`],
        confidence: Math.min(100, Math.round((count / Math.max(1, datasetLength)) * 100)),
        source: 'Observações diretas do campo compound nos snapshots.',
      })),
    });
  }

  const weatherMap = new Map<string, number>();
  for (const row of dataset) {
    const weather = row.weather;
    if (weather) weatherMap.set(weather, (weatherMap.get(weather) ?? 0) + 1);
  }
  const topWeathers = [...weatherMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topWeathers.length > 0) {
    sections.push({
      title: 'Climas mais frequentes',
      insights: topWeathers.map(([weather, count]) => ({
        title: `${weather} — ${count} registros`,
        description: `Clima ${weather} registrado em ${count} observações (${Math.round((count / Math.max(1, datasetLength)) * 100)}% do total).`,
        evidenceCount: count,
        variables: [`weather:${weather}`],
        confidence: Math.min(100, Math.round((count / Math.max(1, datasetLength)) * 100)),
        source: 'Campo weather presente nos snapshots de pneu.',
      })),
    });
  }

  const trackMap = new Map<string, number>();
  for (const row of dataset) {
    const track = row.track;
    if (track) trackMap.set(track, (trackMap.get(track) ?? 0) + 1);
  }
  const topTracks = [...trackMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topTracks.length > 0) {
    sections.push({
      title: 'Pistas mais estudadas',
      insights: topTracks.map(([track, count]) => ({
        title: `${track} — ${count} observações`,
        description: `Pista com maior volume de dados de pneu: ${count} registros (${Math.round((count / Math.max(1, datasetLength)) * 100)}% do total).`,
        evidenceCount: count,
        variables: [`track:${track}`],
        confidence: Math.min(100, Math.round((count / Math.max(1, datasetLength)) * 100)),
        source: 'Agregação por campo track nos snapshots.',
      })),
    });
  }

  const scored = [...variables].sort((a, b) => b.researchScore - a.researchScore);
  const topScored = scored.slice(0, 5);
  if (topScored.length > 0) {
    sections.push({
      title: 'Variáveis mais relevantes',
      insights: topScored.map(v => ({
        title: `${v.path} — Research Score ${v.researchScore}`,
        description: `Nível: ${v.researchLevel}. Cobertura: ${v.coverage}%. ${v.numericStats ? `Faixa: ${v.numericStats.min} a ${v.numericStats.max}` : v.categoricalStats ? `Top: ${v.categoricalStats.topValues.slice(0, 3).map(t => `${t.value} (${t.count})`).join(', ')}` : ''}`,
        evidenceCount: v.occurrences,
        variables: [v.path],
        confidence: v.researchScore,
        source: `Avaliado em ${v.endpoints.length} endpoint(s).`,
      })),
    });
  }

  return sections;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDriverEnergyInsights(variables: ResearchVariableRow[], datasetLength: number, dataset: any[]): InsightSection[] {
  const sections: InsightSection[] = [];

  const energyLostValues = dataset
    .map((row: any) => row.energyLost)
    .filter((v: number | null): v is number => v !== null && Number.isFinite(v));

  if (energyLostValues.length > 0) {
    const min = Math.min(...energyLostValues);
    const max = Math.max(...energyLostValues);
    const avg = energyLostValues.reduce((s: number, v: number) => s + v, 0) / energyLostValues.length;
    const ranges = [
      { label: 'Perda baixa', max: avg - (max - min) * 0.3 },
      { label: 'Perda média', max: avg + (max - min) * 0.3 },
      { label: 'Perda alta', max: Infinity },
    ];
    const rangeCounts = ranges.map(r => ({
      ...r,
      count: energyLostValues.filter(v => {
        const prevMax = ranges.findIndex(pr => pr.max === r.max) > 0 ? ranges[ranges.findIndex(pr => pr.max === r.max) - 1].max : -Infinity;
        return v > prevMax && v <= r.max;
      }).length,
    }));

    sections.push({
      title: 'Faixas de perda de energia',
      insights: rangeCounts.map(r => ({
        title: `${r.label}: ${r.count} ocorrências`,
        description: `${r.count} observações na faixa de perda de energia. Média geral: ${avg.toFixed(1)}. Mínimo: ${min.toFixed(1)}. Máximo: ${max.toFixed(1)}.`,
        evidenceCount: r.count,
        variables: ['energyLost'],
        confidence: Math.round((r.count / energyLostValues.length) * 100),
        source: 'Campo energyLost (perda_energia) da tabela energy_observations.',
      })),
    });
  }

  const driverMap = new Map<string, number>();
  for (const row of dataset) {
    const driver = row.driver;
    if (driver) driverMap.set(driver, (driverMap.get(driver) ?? 0) + 1);
  }
  const topDrivers = [...driverMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topDrivers.length > 0) {
    sections.push({
      title: 'Perfis de piloto mais observados',
      insights: topDrivers.map(([driver, count]) => ({
        title: `${driver} — ${count} corridas`,
        description: `Piloto com ${count} registros de energia observados, representando ${Math.round((count / Math.max(1, datasetLength)) * 100)}% do dataset.`,
        evidenceCount: count,
        variables: ['driver'],
        confidence: Math.min(100, Math.round((count / Math.max(1, datasetLength)) * 100)),
        source: 'Campo driver nos registros de energy_observations.',
      })),
    });
  }

  const trackFactorValues = dataset
    .map((row: any) => row.track_factor)
    .filter((v: number | null): v is number => v !== null && Number.isFinite(v));
  const tfCounts = new Map<number, number>();
  for (const v of trackFactorValues) {
    tfCounts.set(v, (tfCounts.get(v) ?? 0) + 1);
  }
  const topTfs = [...tfCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topTfs.length > 0) {
    sections.push({
      title: 'Track Factors mais frequentes',
      insights: topTfs.map(([tf, count]) => ({
        title: `Track Factor ${tf} — ${count} ocorrências`,
        description: `Track factor ${tf} presente em ${count} observações (${Math.round((count / Math.max(1, trackFactorValues.length)) * 100)}% dos registros com track factor).`,
        evidenceCount: count,
        variables: ['track_factor'],
        confidence: Math.min(100, Math.round((count / Math.max(1, trackFactorValues.length)) * 100)),
        source: 'Campo track_factor nos snapshots de energia.',
      })),
    });
  }

  const scored = [...variables].sort((a, b) => b.researchScore - a.researchScore);
  const topScored = scored.slice(0, 5);
  if (topScored.length > 0) {
    sections.push({
      title: 'Variáveis com maior Engineering Relevance',
      insights: topScored.map(v => ({
        title: `${v.path} — Research Score ${v.researchScore}`,
        description: `Nível: ${v.researchLevel}. Cobertura: ${v.coverage}%. ${v.numericStats ? `Faixa: ${v.numericStats.min} a ${v.numericStats.max}` : v.categoricalStats ? `Top: ${v.categoricalStats.topValues.slice(0, 3).map(t => `${t.value} (${t.count})`).join(', ')}` : ''}`,
        evidenceCount: v.occurrences,
        variables: [v.path],
        confidence: v.researchScore,
        source: `Observado em ${v.endpoints.length} fonte(s). Maturidade: ${v.maturity}.`,
      })),
    });
  }

  return sections;
}

function buildHighlights(sections: InsightSection[]): Insight[] {
  const all = sections.flatMap(s => s.insights);
  return all
    .sort((a, b) => b.confidence - a.confidence || b.evidenceCount - a.evidenceCount)
    .slice(0, 5);
}

export function ResearchInsightsTab({
  variables,
  datasetLength,
  dataset,
  lab,
}: {
  variables: ResearchVariableRow[];
  datasetLength: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataset: any[];
  lab: 'fuel' | 'tyre' | 'driver-energy';
}) {
  const sections = useMemo(() => {
    switch (lab) {
      case 'fuel': return buildFuelInsights(variables, datasetLength);
      case 'tyre': return buildTyreInsights(variables, datasetLength, dataset);
      case 'driver-energy': return buildDriverEnergyInsights(variables, datasetLength, dataset);
    }
  }, [variables, datasetLength, dataset, lab]);

  const highlights = useMemo(() => buildHighlights(sections), [sections]);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Research Highlights</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">5 principais insights do Lab</h2>
        <p className="mt-1 text-sm text-slate-600">Insights observacionais baseados exclusivamente em dados reais coletados.</p>

        {highlights.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500">Dados insuficientes para gerar destaques observacionais.</p>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {highlights.map((insight, index) => (
              <div key={index} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-950">{insight.title}</p>
                    <p className="mt-1 text-xs text-slate-600">{insight.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
                        <span>{insight.evidenceCount} ocorrências</span>
                      <span>Suporte: {insight.confidence}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {sections.map(section => (
        <section key={section.title} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">{section.title}</p>
          <h2 className="mt-2 text-lg font-black text-slate-950">{section.title}</h2>
          <p className="mt-1 text-sm text-slate-600">Insights baseados exclusivamente em dados observados.</p>

          {section.insights.length === 0 ? (
            <p className="mt-5 text-sm text-slate-500">Dados insuficientes para gerar sinais nesta categoria.</p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {section.insights.map((insight, index) => (
                <InsightCard key={index} insight={insight} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
