'use client';

import { useMemo } from 'react';
import type { Evidence } from './EvidenceTypes';
import type { ResearchVariableRow } from '@/app/lib/research/research-variable-catalog';
import { EvidenceCard } from './EvidenceCard';
import { buildFuelEvidences, buildTyreEvidences, buildDriverEnergyEvidences } from './evidence-builder';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEvidences(variables: ResearchVariableRow[], datasetLength: number, dataset: any[], lab: string): Evidence[] {
  switch (lab) {
    case 'fuel':
      return buildFuelEvidences(variables, datasetLength, dataset);
    case 'tyre':
      return buildTyreEvidences(variables, datasetLength, dataset);
    case 'driver-energy':
      return buildDriverEnergyEvidences(variables, datasetLength, dataset);
    default:
      return [];
  }
}

export function ResearchEvidenceTab({
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
  const evidences = useMemo(
    () => buildEvidences(variables, datasetLength, dataset, lab),
    [variables, datasetLength, dataset, lab],
  );

  const strong = evidences.filter(e => e.status === 'Forte').length;
  const moderate = evidences.filter(e => e.status === 'Moderada').length;
  const weak = evidences.filter(e => e.status === 'Fraca').length;

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-indigo-200/60 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-indigo-700">Observational Signals</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Sinais observacionais</h2>
            <p className="mt-1 text-sm text-slate-600">
              Sinais extraídos exclusivamente de dados reais. Cada sinal representa um padrão observado que merece investigação, não uma conclusão.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Bom suporte</p>
            <p className="mt-2 text-3xl font-black text-emerald-700">{strong}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Suporte moderado</p>
            <p className="mt-2 text-3xl font-black text-amber-700">{moderate}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Suporte inicial</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{weak}</p>
          </div>
        </div>
      </section>

      {evidences.length === 0 ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-sm text-slate-500">Dados insuficientes para gerar sinais observacionais.</p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {evidences.map(evidence => (
            <EvidenceCard key={evidence.id} evidence={evidence} />
          ))}
        </section>
      )}
    </div>
  );
}
