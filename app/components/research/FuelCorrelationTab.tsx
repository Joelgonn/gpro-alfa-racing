'use client';

import type { FuelLabResponse } from './fuel-types';

type GroupStats = {
  label: string;
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  endpoints: number;
  tracks: number;
  weather: Record<string, number>;
};

function avg(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildTemperatureStats(rows: FuelLabResponse['dataset']): GroupStats {
  const values = rows.map(row => row.temperature).filter((value): value is number => typeof value === 'number');
  return {
    label: 'Temperatura',
    count: values.length,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    avg: avg(values),
    endpoints: new Set(rows.map(row => row.endpoint)).size,
    tracks: new Set(rows.map(row => row.track).filter(Boolean) as string[]).size,
    weather: rows.reduce((acc, row) => {
      const key = row.weather || 'Sem dados';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}

function buildTrackStats(rows: FuelLabResponse['dataset']): GroupStats[] {
  const map = new Map<string, FuelLabResponse['dataset']>();
  for (const row of rows) {
    if (!row.track) continue;
    const list = map.get(row.track) ?? [];
    list.push(row);
    map.set(row.track, list);
  }

  return Array.from(map.entries())
    .map(([track, list]) => {
      const temperatures = list.map(row => row.temperature).filter((value): value is number => typeof value === 'number');
      return {
        label: track,
        count: list.length,
        min: temperatures.length ? Math.min(...temperatures) : null,
        max: temperatures.length ? Math.max(...temperatures) : null,
        avg: avg(temperatures),
        endpoints: new Set(list.map(row => row.endpoint)).size,
        tracks: 1,
        weather: list.reduce((acc, row) => {
          const key = row.weather || 'Sem dados';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildEndpointStats(rows: FuelLabResponse['dataset']): GroupStats[] {
  const map = new Map<string, FuelLabResponse['dataset']>();
  for (const row of rows) {
    const list = map.get(row.endpoint) ?? [];
    list.push(row);
    map.set(row.endpoint, list);
  }

  return Array.from(map.entries()).map(([endpoint, list]) => {
    const temperatures = list.map(row => row.temperature).filter((value): value is number => typeof value === 'number');
    return {
      label: endpoint,
      count: list.length,
      min: temperatures.length ? Math.min(...temperatures) : null,
      max: temperatures.length ? Math.max(...temperatures) : null,
      avg: avg(temperatures),
      endpoints: 1,
      tracks: new Set(list.map(row => row.track).filter(Boolean) as string[]).size,
      weather: list.reduce((acc, row) => {
        const key = row.weather || 'Sem dados';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildWeatherStats(rows: FuelLabResponse['dataset']) {
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

export function FuelCorrelationTab({ data }: { data: FuelLabResponse }) {
  const rows = data.dataset;
  const temperatureStats = buildTemperatureStats(rows);
  const trackStats = buildTrackStats(rows);
  const endpointStats = buildEndpointStats(rows);
  const weatherStats = buildWeatherStats(rows);
  const fuelSignalRows = data.overview.fuelSignals;

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Correlations</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">Agregações automáticas do dataset</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Observações com temperatura" value={temperatureStats.count} note={temperatureStats.avg !== null ? `Média ${temperatureStats.avg.toFixed(1)}°C` : 'Dados insuficientes'} />
          <MetricCard label="Pistas distintas" value={trackStats.length} note={trackStats.length ? 'Agrupamento por pista ativo' : 'Dados insuficientes'} />
          <MetricCard label="Endpoints distintos" value={endpointStats.length} note={endpointStats.length ? 'Agrupamento por endpoint ativo' : 'Dados insuficientes'} />
          <MetricCard label="Sinais de combustível" value={fuelSignalRows} note={fuelSignalRows ? 'Campos reais confirmados' : 'Dados insuficientes'} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Temperatura x registros</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <MetricCard label="Mínimo" value={temperatureStats.min !== null ? `${temperatureStats.min.toFixed(1)}°C` : 'Dados insuficientes'} />
            <MetricCard label="Máximo" value={temperatureStats.max !== null ? `${temperatureStats.max.toFixed(1)}°C` : 'Dados insuficientes'} />
            <MetricCard label="Média" value={temperatureStats.avg !== null ? `${temperatureStats.avg.toFixed(1)}°C` : 'Dados insuficientes'} />
            <MetricCard label="Cobertura" value={rows.length ? `${Math.round((temperatureStats.count / rows.length) * 100)}%` : 'Dados insuficientes'} />
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
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Pista x registros</p>
          <div className="mt-4 space-y-3">
            {trackStats.length > 0 ? trackStats.slice(0, 8).map(track => (
              <div key={track.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black text-slate-950">{track.label}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{track.count} obs.</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <MetricCard label="Temp. média" value={track.avg !== null ? `${track.avg.toFixed(1)}°C` : 'Dados insuficientes'} />
                  <MetricCard label="Endpoints" value={track.endpoints} />
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">Dados insuficientes</p>}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Endpoint x registros</p>
          <div className="mt-4 space-y-3">
            {endpointStats.length > 0 ? endpointStats.slice(0, 8).map(endpoint => (
              <div key={endpoint.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black text-slate-950">{endpoint.label}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{endpoint.count} obs.</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <MetricCard label="Temp. média" value={endpoint.avg !== null ? `${endpoint.avg.toFixed(1)}°C` : 'Dados insuficientes'} />
                  <MetricCard label="Pistas" value={endpoint.tracks} />
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">Dados insuficientes</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
