'use client';

import { useMemo } from 'react';
import { Filter, RotateCcw, Save, Download } from 'lucide-react';

export type ResearchQuery = {
  track: string;
  compound: string;
  weather: string;
  season: string;
  race: string;
  endpoint: string;
  source: string;
  tempMin: string;
  tempMax: string;
  wearMin: string;
  wearMax: string;
  onlyWear: boolean;
  onlyCompound: boolean;
  onlyTemperature: boolean;
};

export type ResearchQueryBuilderProps = {
  query: ResearchQuery;
  setQuery: (next: ResearchQuery) => void;
  onClear: () => void;
  onSave: () => void;
  onExport: (format: 'csv' | 'json' | 'markdown') => void;
  trackOptions: string[];
  compoundOptions: string[];
  weatherOptions: string[];
  endpointOptions: string[];
  sourceOptions: string[];
};

const baseButton = 'rounded-full border px-4 py-2 text-xs font-black uppercase tracking-widest transition';

export function ResearchQueryBuilder({
  query,
  setQuery,
  onClear,
  onSave,
  onExport,
  trackOptions,
  compoundOptions,
  weatherOptions,
  endpointOptions,
  sourceOptions,
}: ResearchQueryBuilderProps) {
  const update = (key: keyof ResearchQuery, value: string | boolean) => {
    setQuery({ ...query, [key]: value } as ResearchQuery);
  };

  const activeCount = useMemo(() => {
    return Object.entries(query).filter(([, value]) => {
      if (typeof value === 'boolean') return value;
      return String(value).trim().length > 0;
    }).length;
  }, [query]);

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Research Query Builder</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">Filtrar o dataset sem escrever código</h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
          {activeCount} filtros ativos
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select value={query.track} onChange={(e) => update('track', e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500">
          <option value="">Track</option>
          {trackOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={query.compound} onChange={(e) => update('compound', e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500">
          <option value="">Compound</option>
          {compoundOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={query.weather} onChange={(e) => update('weather', e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500">
          <option value="">Weather</option>
          {weatherOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={query.endpoint} onChange={(e) => update('endpoint', e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500">
          <option value="">Endpoint</option>
          {endpointOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={query.source} onChange={(e) => update('source', e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 md:col-span-2 xl:col-span-1">
          <option value="">Source</option>
          {sourceOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <input value={query.season} onChange={(e) => update('season', e.target.value)} placeholder="Season" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500" />
        <input value={query.race} onChange={(e) => update('race', e.target.value)} placeholder="Race" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500" />
        <input value={query.tempMin} onChange={(e) => update('tempMin', e.target.value)} placeholder="Temperatura mín." className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500" />
        <input value={query.tempMax} onChange={(e) => update('tempMax', e.target.value)} placeholder="Temperatura máx." className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500" />
        <input value={query.wearMin} onChange={(e) => update('wearMin', e.target.value)} placeholder="Wear mín." className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500" />
        <input value={query.wearMax} onChange={(e) => update('wearMax', e.target.value)} placeholder="Wear máx." className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500" />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600">
          <input type="checkbox" checked={query.onlyWear} onChange={(e) => update('onlyWear', e.target.checked)} /> Somente wear
        </label>
        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600">
          <input type="checkbox" checked={query.onlyCompound} onChange={(e) => update('onlyCompound', e.target.checked)} /> Somente compound
        </label>
        <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600">
          <input type="checkbox" checked={query.onlyTemperature} onChange={(e) => update('onlyTemperature', e.target.checked)} /> Somente temperatura
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={onClear} className={`${baseButton} border-slate-200 bg-white text-slate-700 hover:border-slate-300`}><RotateCcw size={14} className="inline-block mr-2" /> Limpar filtros</button>
        <button onClick={onSave} className={`${baseButton} border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-500`}><Save size={14} className="inline-block mr-2" /> Salvar consulta</button>
        <button onClick={() => onExport('csv')} className={`${baseButton} border-slate-200 bg-white text-slate-700 hover:border-slate-300`}><Download size={14} className="inline-block mr-2" /> CSV</button>
        <button onClick={() => onExport('json')} className={`${baseButton} border-slate-200 bg-white text-slate-700 hover:border-slate-300`}><Download size={14} className="inline-block mr-2" /> JSON</button>
        <button onClick={() => onExport('markdown')} className={`${baseButton} border-slate-200 bg-white text-slate-700 hover:border-slate-300`}><Download size={14} className="inline-block mr-2" /> Markdown</button>
      </div>
    </section>
  );
}
