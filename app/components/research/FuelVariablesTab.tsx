'use client';

import { useMemo, useState } from 'react';
import { Hash, Layers3, ListFilter, Star } from 'lucide-react';
import type { FuelLabResponse, FuelVariableRow } from './fuel-types';

function StatusBadge({ maturity }: { maturity: FuelVariableRow['maturity'] }) {
  const tone =
    maturity === 'Consolidada'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : maturity === 'Relevante'
        ? 'bg-sky-50 text-sky-700 border-sky-200'
        : maturity === 'Observada'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${tone}`}>{maturity}</span>;
}

function ScoreBadge({ score, level }: { score: number; level: FuelVariableRow['researchLevel'] }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 text-amber-500">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star key={index} size={12} fill={index < Math.max(1, Math.round(score / 20)) ? 'currentColor' : 'none'} />
        ))}
      </div>
      <div className="text-right">
        <p className="text-sm font-black text-slate-950">{score}</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{level}</p>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function Drawer({ variable, onClose }: { variable: FuelVariableRow | null; onClose: () => void }) {
  if (!variable) return null;

  return (
    <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Detalhe da vari?vel</p>
          <h3 className="mt-2 text-xl font-black text-slate-950">{variable.path}</h3>
        </div>
        <button onClick={onClose} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700">
          Fechar
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MetricCard label="Tipo" value={variable.sampleType} />
        <MetricCard label="Cobertura" value={`${variable.coverage}%`} />
        <MetricCard label="Ocorr?ncias" value={variable.occurrences} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <MetricCard label="Endpoints" value={variable.endpoints.length} />
        <MetricCard label="Valores distintos" value={variable.distinctValuesCount} />
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Primeira ocorr?ncia</p>
        <p className="mt-2 text-sm font-medium text-slate-700">{variable.firstSeen || 'Dispon?vel em pr?xima fase'}</p>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">?ltima ocorr?ncia</p>
        <p className="mt-2 text-sm font-medium text-slate-700">{variable.lastSeen || 'Dispon?vel em pr?xima fase'}</p>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Amostras</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {variable.sampleValues.length > 0 ? variable.sampleValues.map(value => (
            <span key={value} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
              {value}
            </span>
          )) : <span className="text-sm text-slate-500">Dados insuficientes</span>}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Endpoints</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {variable.endpoints.length > 0 ? variable.endpoints.map(endpoint => (
            <span key={endpoint} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-700">
              {endpoint}
            </span>
          )) : <span className="text-sm text-slate-500">Dados insuficientes</span>}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Hist?rico</p>
          <p className="mt-2 text-sm text-slate-600">
            {variable.firstSeen && variable.lastSeen ? `${variable.firstSeen} ? ${variable.lastSeen}` : 'Dispon?vel em pr?xima fase'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Maturidade</p>
          <div className="mt-2">
            <StatusBadge maturity={variable.maturity} />
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Research Assessment</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Score</p>
            <p className="mt-1 text-3xl font-black text-slate-950">{variable.researchScore}</p>
          </div>
          <ScoreBadge score={variable.researchScore} level={variable.researchLevel} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge
            maturity={
              variable.researchLevel === 'Muito Baixo'
                ? 'Experimental'
                : variable.researchLevel === 'Baixo'
                  ? 'Observada'
                  : variable.researchLevel === 'Médio'
                    ? 'Relevante'
                    : 'Consolidada'
            }
          />
        </div>
        <div className="mt-4 space-y-2">
          {variable.researchReasons.map(reason => (
            <p key={reason} className="text-sm text-slate-600">? {reason}</p>
          ))}
        </div>
      </div>

      {variable.numericStats ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estat?sticas num?ricas</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="M?nimo" value={variable.numericStats.min !== null ? variable.numericStats.min.toFixed(2) : '?'} />
            <MetricCard label="M?ximo" value={variable.numericStats.max !== null ? variable.numericStats.max.toFixed(2) : '?'} />
            <MetricCard label="M?dia" value={variable.numericStats.avg !== null ? variable.numericStats.avg.toFixed(2) : '?'} />
            <MetricCard label="Valores distintos" value={variable.numericStats.distinctValuesCount} />
          </div>
        </div>
      ) : null}

      {variable.categoricalStats ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estat?sticas categ?ricas</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <MetricCard label="Valores distintos" value={variable.categoricalStats.distinctValuesCount} />
            <MetricCard label="Top valores" value={variable.categoricalStats.topValues.length} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {variable.categoricalStats.topValues.map(item => (
              <span key={item.value} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                {item.value} ? {item.count}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FuelVariablesTab({ data }: { data: FuelLabResponse }) {
  const variables = data.knowledgePanel.variableCatalog;
  const [search, setSearch] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | FuelVariableRow['maturity']>('all');

  const filteredVariables = useMemo(() => {
    return variables.filter(variable => {
      const matchesSearch = !search || variable.path.toLowerCase().includes(search.trim().toLowerCase());
      const matchesStatus = statusFilter === 'all' || variable.maturity === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [variables, search, statusFilter]);

  const sortedVariables = useMemo(() => {
    return [...filteredVariables].sort((a, b) => b.researchScore - a.researchScore || b.coverage - a.coverage || b.occurrences - a.occurrences || a.path.localeCompare(b.path));
  }, [filteredVariables]);

  const selectedVariable = sortedVariables.find(variable => variable.path === selectedPath) ?? sortedVariables[0] ?? null;
  const consolidatedCount = variables.filter(variable => variable.maturity === 'Consolidada').length;
  const numericCount = variables.filter(variable => variable.sampleType === 'number').length;
  const categoricalCount = variables.filter(variable => variable.sampleType === 'string').length;
  const maxResearchScore = variables.reduce((max, variable) => Math.max(max, variable.researchScore), 0);
  const excellentCount = variables.filter(variable => variable.researchLevel === 'Excelente').length;
  const highCount = variables.filter(variable => variable.researchLevel === 'Alto').length;
  const modelReadyCount = variables.filter(variable => variable.researchScore >= 81).length;
  const topVariables = [...variables].sort((a, b) => b.researchScore - a.researchScore || a.path.localeCompare(b.path)).slice(0, 10);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Variables</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Cat?logo cient?fico de vari?veis observadas</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Esta aba organiza as vari?veis encontradas nos snapshots em vez de mostrar apenas linhas.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
            {variables.length} vari?veis
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Vari?veis encontradas" value={variables.length} />
          <MetricCard label="Vari?veis consolidadas" value={consolidatedCount} />
          <MetricCard label="Vari?veis num?ricas" value={numericCount} />
          <MetricCard label="Vari?veis categ?ricas" value={categoricalCount} />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <MetricCard label="Maior Research Score" value={maxResearchScore} />
          <MetricCard label="Vari?veis Excelente" value={excellentCount} />
          <MetricCard label="Vari?veis Alto" value={highCount} />
          <MetricCard label="Vari?veis prontas para modelagem" value={modelReadyCount} />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Top 10 vari?veis mais promissoras</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {topVariables.map((variable, index) => (
            <div key={variable.path} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{index + 1}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{variable.path}</p>
                </div>
                <ScoreBadge score={variable.researchScore} level={variable.researchLevel} />
              </div>
              <p className="mt-3 text-sm text-slate-600">{variable.researchLevel}</p>
              <p className="mt-1 text-sm font-medium text-slate-700">{variable.researchScore >= 81 ? 'Pronta para modelagem' : 'Ainda em avalia??o'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <ListFilter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar vari?vel por nome completo..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'Experimental', 'Observada', 'Relevante', 'Consolidada'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
                  statusFilter === status ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {status === 'all' ? 'Todas' : status}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="overflow-x-auto rounded-[1.25rem] border border-slate-200 bg-white">
            <table className="min-w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Cobertura</th>
                  <th className="px-4 py-3">Ocorr?ncias</th>
                  <th className="px-4 py-3">Endpoints</th>
                  <th className="px-4 py-3">Valores distintos</th>
                  <th className="px-4 py-3">Research Score</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedVariables.length > 0 ? sortedVariables.map(variable => (
                  <tr
                    key={variable.path}
                    onClick={() => setSelectedPath(variable.path)}
                    className={`cursor-pointer border-t border-slate-100 transition hover:bg-emerald-50/60 ${selectedVariable?.path === variable.path ? 'bg-emerald-50/80' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{variable.path}</td>
                    <td className="px-4 py-3 text-slate-700">{variable.sampleType}</td>
                    <td className="px-4 py-3 text-slate-700">{variable.coverage}%</td>
                    <td className="px-4 py-3 text-slate-700">{variable.occurrences}</td>
                    <td className="px-4 py-3 text-slate-700">{variable.endpoints.length}</td>
                    <td className="px-4 py-3 text-slate-700">{variable.distinctValuesCount}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <ScoreBadge score={variable.researchScore} level={variable.researchLevel} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge maturity={variable.maturity} />
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={8}>
                      Nenhuma vari?vel encontrada para os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="flex items-center gap-3">
              <Hash className="text-emerald-600" size={18} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Painel de detalhe</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">Vari?vel selecionada</h3>
              </div>
            </div>
          </div>

          <Drawer variable={selectedVariable} onClose={() => setSelectedPath(null)} />

          <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Legenda</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge maturity="Experimental" />
              <StatusBadge maturity="Observada" />
              <StatusBadge maturity="Relevante" />
              <StatusBadge maturity="Consolidada" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
