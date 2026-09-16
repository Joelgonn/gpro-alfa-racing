'use client';

import type { ResearchObservatoryData } from './research-observatory-types';

function OverviewCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}

export function ResearchOverview({ data }: { data: ResearchObservatoryData }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Research Observatory</p>
      <h2 className="mt-2 text-xl font-black text-slate-950">Central de engenharia reversa da plataforma</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <OverviewCard label="Labs ativos" value={data.overview.activeLabs} />
        <OverviewCard label="Variáveis catalogadas" value={data.overview.catalogedVariables} />
        <OverviewCard label="Variáveis excelentes" value={data.overview.excellentVariables} />
        <OverviewCard label="Maior Research Score" value={data.overview.maxResearchScore} />
      </div>
    </section>
  );
}
