'use client';

import { useMemo } from 'react';
import type { FuelLabResponse } from './fuel-types';
import { buildFuelEvidences } from './evidence-builder';
import type { Evidence } from './EvidenceTypes';
import { ResearchDisclaimer } from './ResearchDisclaimer';

const STATUS_CFG: Record<string, { label: string; tone: string }> = {
  'Bom suporte': { label: 'Bom suporte observacional', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Suporte moderado': { label: 'Suporte observacional moderado', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  'Em análise': { label: 'Em análise', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  'Sem dados': { label: 'Sem dados', tone: 'bg-slate-50 text-slate-600 border-slate-200' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG['Sem dados'];
  return <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${cfg.tone}`}>{cfg.label}</span>;
}

function EvidenceRef({ evidence }: { evidence: Evidence }) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-indigo-700">{evidence.id}</span>
        <span className="text-xs font-medium text-slate-700">{evidence.title}</span>
      </div>
    </div>
  );
}

function HypothesisCard({
  title,
  description,
  observations,
  status,
  confidence,
  supportedBy,
}: {
  title: string;
  description: string;
  observations: number;
  status: string;
  confidence: number;
  supportedBy: Evidence[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{title}</p>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-white p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Observações</p>
          <p className="mt-1 text-sm font-black text-slate-900">{observations}</p>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Suporte</p>
          <p className="mt-1 text-sm font-black text-slate-900">{confidence}%</p>
        </div>
      </div>

      {supportedBy.length > 0 && (
        <div className="mt-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Baseada em</p>
          <div className="mt-2 space-y-1.5">
            {supportedBy.map(e => (
              <EvidenceRef key={e.id} evidence={e} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FuelHypothesesTab({ data }: { data: FuelLabResponse }) {
  const signals = data.overview.fuelSignals;
  const temperatureSignals = data.dataset.filter(row => row.temperature !== null).length;
  const trackSignals = new Set(data.dataset.map(row => row.track).filter(Boolean) as string[]).size;
  const endpointSignals = new Set(data.dataset.map(row => row.endpoint)).size;

  const evidences = useMemo(
    () => buildFuelEvidences(
      data.knowledgePanel.variableCatalog,
      data.dataset.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.dataset as any[],
    ),
    [data],
  );

  const byId = (id: string) => evidences.find(e => e.id === id);
  const topCoverageEvidence = byId('E1');
  const multiEndpointEvidence = byId('E4');

  const hypotheses = [
    {
      title: 'O endpoint Testing pode conter informações suficientes para estimar consumo.',
      description: 'Hipótese inicial aguardando mais evidências reais antes de qualquer conclusão.',
      observations: signals,
      status: signals > 0 ? 'Em análise' : 'Sem dados',
      confidence: signals > 0 ? Math.min(35 + signals, 60) : 0,
      supportedBy: multiEndpointEvidence ? [multiEndpointEvidence] : [],
    },
    {
      title: 'O comportamento do combustível pode variar entre endpoints.',
      description: 'A base atual já mostra endpoints diferentes com sinais distintos.',
      observations: endpointSignals,
      status: endpointSignals > 2 ? 'Suporte moderado' : 'Em análise',
      confidence: endpointSignals > 0 ? Math.min(25 + endpointSignals * 8, 65) : 0,
      supportedBy: multiEndpointEvidence ? [multiEndpointEvidence] : [],
    },
    {
      title: 'Temperatura pode influenciar o consumo observado.',
      description: 'Por enquanto é apenas uma hipótese de pesquisa, não uma descoberta.',
      observations: temperatureSignals,
      status: temperatureSignals > 10 ? 'Suporte moderado' : 'Sem dados',
      confidence: temperatureSignals > 0 ? Math.min(20 + Math.round((temperatureSignals / Math.max(1, data.dataset.length)) * 100), 70) : 0,
      supportedBy: topCoverageEvidence ? [topCoverageEvidence] : [],
    },
    {
      title: 'Há base para iniciar correlação entre pista e sinal de combustível.',
      description: 'A análise ainda é exploratória e não trata nenhum padrão como fato.',
      observations: trackSignals,
      status: trackSignals > 2 ? 'Suporte moderado' : 'Sem dados',
      confidence: trackSignals > 0 ? Math.min(20 + trackSignals * 8, 60) : 0,
      supportedBy: topCoverageEvidence ? [topCoverageEvidence] : [],
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Hypotheses</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">Hipóteses organizadas</h2>
        <p className="mt-2 text-sm text-slate-600">Cada hipótese referencia explicitamente os sinais observacionais que a sustentam. Hipóteses não são conclusões.</p>
      </section>

      <ResearchDisclaimer />

      <section className="grid gap-4 xl:grid-cols-2">
        {hypotheses.map(hypothesis => (
          <HypothesisCard key={hypothesis.title} {...hypothesis} />
        ))}
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Legenda</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge status="Sem dados" />
          <StatusBadge status="Em análise" />
          <StatusBadge status="Suporte moderado" />
          <StatusBadge status="Bom suporte" />
        </div>
      </section>
    </div>
  );
}
