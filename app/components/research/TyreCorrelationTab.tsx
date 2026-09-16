'use client';

import type { TyreLabResponse } from './tyre-types';

type GroupStats = {
  label: string;
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  compounds: number;
  tracks: number;
  weather: Record<string, number>;
};

function avg(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildTemperatureStats(rows: TyreLabResponse['dataset']): GroupStats {
  const values = rows.map(row => row.temperature).filter((v): v is number => typeof v === 'number');
  return {
    label: 'Temperatura',
    count: values.length,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    avg: avg(values),
    compounds: new Set(rows.map(row => row.compound).filter(Boolean) as string[]).size,
    tracks: new Set(rows.map(row => row.track).filter(Boolean) as string[]).size,
    weather: rows.reduce((acc, row) => {
      const key = row.weather || 'Sem dados';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}

function buildTrackStats(rows: TyreLabResponse['dataset']): GroupStats[] {
  const map = new Map<string, TyreLabResponse['dataset']>();
  for (const row of rows) {
    if (!row.track) continue;
    const list = map.get(row.track) ?? [];
    list.push(row);
    map.set(row.track, list);
  }

  return Array.from(map.entries()).map(([track, list]) => {
    const temperatures = list.map(row => row.temperature).filter((v): v is number => typeof v === 'number');
    return {
      label: track,
      count: list.length,
      min: temperatures.length ? Math.min(...temperatures) : null,
      max: temperatures.length ? Math.max(...temperatures) : null,
      avg: avg(temperatures),
      compounds: new Set(list.map(row => row.compound).filter(Boolean) as string[]).size,
      tracks: 1,
      weather: list.reduce((acc, row) => {
        const key = row.weather || 'Sem dados';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildCompoundStats(rows: TyreLabResponse['dataset']): GroupStats[] {
  const map = new Map<string, TyreLabResponse['dataset']>();
  for (const row of rows) {
    if (!row.compound) continue;
    const list = map.get(row.compound) ?? [];
    list.push(row);
    map.set(row.compound, list);
  }

  return Array.from(map.entries()).map(([compound, list]) => {
    const wearValues = list.map(row => row.wear).filter((v): v is number => typeof v === 'number');
    return {
      label: compound,
      count: list.length,
      min: wearValues.length ? Math.min(...wearValues) : null,
      max: wearValues.length ? Math.max(...wearValues) : null,
      avg: avg(wearValues),
      compounds: 1,
      tracks: new Set(list.map(row => row.track).filter(Boolean) as string[]).size,
      weather: list.reduce((acc, row) => {
        const key = row.weather || 'Sem dados';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildWeatherStats(rows: TyreLabResponse['dataset']) {
  return rows.reduce((acc, row) => {
    const key = row.weather || 'Sem dados';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function MetricCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}

export function TyreCorrelationTab({ data }: { data: TyreLabResponse }) {
  const rows = data.dataset;
  const temperatureStats = buildTemperatureStats(rows);
  const trackStats = buildTrackStats(rows);
  const compoundStats = buildCompoundStats(rows);
  const weatherStats = buildWeatherStats(rows);
  const wearRows = rows.filter(row => row.wear !== null);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Correlations</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">Agregações automáticas do dataset</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Observações com desgaste" value={wearRows.length} note={wearRows.length ? 'Há sinal suficiente para agrupar' : 'Dados insuficientes'} />
          <MetricCard label="Temperaturas distintas" value={new Set(rows.map(row => row.temperature).filter((v): v is number => typeof v === 'number')).size} note={temperatureStats.avg !== null ? `Média ${temperatureStats.avg.toFixed(1)}°C` : 'Dados insuficientes'} />
          <MetricCard label="Pistas distintas" value={trackStats.length} note={trackStats.length ? 'Agrupamento por pista ativo' : 'Dados insuficientes'} />
          <MetricCard label="Compostos distintos" value={compoundStats.length} note={compoundStats.length ? 'Comparações disponíveis' : 'Dados insuficientes'} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Temperatura x Wear</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <MetricCard label="Mínimo" value={temperatureStats.min !== null ? `${temperatureStats.min.toFixed(1)}°C` : 'Dados insuficientes'} />
            <MetricCard label="Máximo" value={temperatureStats.max !== null ? `${temperatureStats.max.toFixed(1)}°C` : 'Dados insuficientes'} />
            <MetricCard label="Média" value={temperatureStats.avg !== null ? `${temperatureStats.avg.toFixed(1)}°C` : 'Dados insuficientes'} />
            <MetricCard label="Quantidade" value={temperatureStats.count} />
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Weather</p>
          <div className="mt-4 space-y-3">
            {Object.keys(weatherStats).length > 0 ? Object.entries(weatherStats).map(([weather, count]) => (
              <div key={weather} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">{weather}</span>
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">{count}</span>
              </div>
            )) : (
              <p className="text-sm text-slate-500">Dados insuficientes</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Pista x Wear</p>
          <div className="mt-4 space-y-3">
            {trackStats.length > 0 ? trackStats.slice(0, 8).map(track => (
              <div key={track.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black text-slate-950">{track.label}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{track.count} obs.</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <MetricCard label="Temperatura média" value={track.avg !== null ? `${track.avg.toFixed(1)}°C` : 'Dados insuficientes'} />
                  <MetricCard label="Compósitos" value={track.compounds} />
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">Dados insuficientes</p>}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Composto x Wear</p>
          <div className="mt-4 space-y-3">
            {compoundStats.length > 0 ? compoundStats.slice(0, 8).map(compound => (
              <div key={compound.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black text-slate-950">{compound.label}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{compound.count} obs.</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <MetricCard label="Wear mínimo" value={compound.min !== null ? `${compound.min.toFixed(1)}%` : 'Dados insuficientes'} />
                  <MetricCard label="Wear máximo" value={compound.max !== null ? `${compound.max.toFixed(1)}%` : 'Dados insuficientes'} />
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">Dados insuficientes</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
