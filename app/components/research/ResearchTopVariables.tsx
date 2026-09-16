'use client';

import Link from 'next/link';
import type { ResearchVariableSummary } from './research-observatory-types';

function ScoreBadge({ score }: { score: number }) {
  const stars = Math.max(1, Math.round(score / 20));
  return (
    <div className="flex items-center gap-1 text-amber-500">
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={index < stars ? 'opacity-100' : 'opacity-30'}>★</span>
      ))}
    </div>
  );
}

export function ResearchTopVariables({ variables }: { variables: ResearchVariableSummary[] }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Top Variables</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">Top 20 variáveis da plataforma</h2>
        </div>
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">{variables.length} itens</p>
      </div>

      <div className="mt-5 overflow-x-auto rounded-[1.25rem] border border-slate-200 bg-white">
        <table className="min-w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Lab</th>
              <th className="px-4 py-3">Research Score</th>
              <th className="px-4 py-3">Nível</th>
              <th className="px-4 py-3">Cobertura</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Endpoints</th>
              <th className="px-4 py-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {variables.map(variable => (
              <tr key={`${variable.labId}-${variable.path}`} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{variable.path}</td>
                <td className="px-4 py-3 text-slate-700">{variable.labName}</td>
                <td className="px-4 py-3 text-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-slate-950">{variable.score}</span>
                    <ScoreBadge score={variable.score} />
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{variable.level}</td>
                <td className="px-4 py-3 text-slate-700">{variable.coverage}%</td>
                <td className="px-4 py-3 text-slate-700">{variable.type}</td>
                <td className="px-4 py-3 text-slate-700">{variable.endpoints.length}</td>
                <td className="px-4 py-3">
                  <Link href={variable.route} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                    Abrir Lab
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
