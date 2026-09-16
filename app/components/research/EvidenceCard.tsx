'use client';

import type { Evidence } from './EvidenceTypes';

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  Forte: { label: 'Bom suporte observacional', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Moderada: { label: 'Suporte observacional moderado', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  Fraca: { label: 'Suporte observacional inicial', tone: 'bg-slate-50 text-slate-600 border-slate-200' },
};

function StatusBadge({ status }: { status: Evidence['status'] }) {
  const cfg = STATUS_LABELS[status] ?? STATUS_LABELS.Fraca;
  return <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${cfg.tone}`}>{cfg.label}</span>;
}

export function EvidenceCard({ evidence }: { evidence: Evidence }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-indigo-700">
              {evidence.id}
            </span>
            <StatusBadge status={evidence.status} />
          </div>
          <p className="mt-2 text-sm font-black text-slate-950">{evidence.title}</p>
          <p className="mt-1 text-sm text-slate-600">{evidence.description}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <div className="rounded-xl bg-white p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Observações</p>
          <p className="mt-1 font-black text-slate-900">{evidence.observations}</p>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cobertura</p>
          <p className="mt-1 font-black text-slate-900">{evidence.coverage}%</p>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pistas</p>
          <p className="mt-1 font-black text-slate-900">{evidence.tracks}</p>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Temporadas</p>
          <p className="mt-1 font-black text-slate-900">{evidence.seasons}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="font-black uppercase tracking-widest text-slate-400">Suporte observacional</span>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${Math.min(100, evidence.confidence)}%` }}
              />
            </div>
            <span className="font-black text-slate-900">{evidence.confidence}%</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="font-black uppercase tracking-widest text-slate-400">Endpoints</span>
          <span className="font-black text-slate-900">{evidence.endpoints}</span>
        </div>
      </div>

      {evidence.variables.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {evidence.variables.slice(0, 6).map(variable => (
            <span key={variable} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
              {variable}
            </span>
          ))}
          {evidence.variables.length > 6 && (
            <span className="text-[10px] text-slate-400">+{evidence.variables.length - 6}</span>
          )}
        </div>
      )}

      <p className="mt-3 text-[10px] text-slate-400">Fonte observacional: {evidence.source}</p>
    </div>
  );
}
