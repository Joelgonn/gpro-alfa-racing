'use client';

import Link from 'next/link';
import type { ResearchLabSummary } from './research-observatory-types';

function StatusBadge({ status }: { status: ResearchLabSummary['status'] }) {
  const tone =
    status === 'Ativo'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'Em evolução'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-50 text-slate-600 border-slate-200';

  return <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${tone}`}>{status}</span>;
}

export function ResearchLabCard({ lab }: { lab: ResearchLabSummary }) {
  return (
    <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">{lab.name}</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">{lab.variableCount}</h3>
          <p className="mt-1 text-sm text-slate-600">Variáveis catalogadas</p>
        </div>
        <StatusBadge status={lab.status} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Excelente</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{lab.excellentVariables}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Maior score</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{lab.maxResearchScore}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Status</p>
        <Link href={lab.route} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
          Abrir Lab
        </Link>
      </div>
    </div>
  );
}
