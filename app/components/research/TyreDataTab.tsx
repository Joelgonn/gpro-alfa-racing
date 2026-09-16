'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, Database, LayoutGrid, Layers3, PanelBottomOpen, PanelRightOpen, Radar, ScrollText } from 'lucide-react';
import { ResearchQueryBuilder, type ResearchQuery } from './ResearchQueryBuilder';
import type { TyreLabResponse, TyreObservationRow, TyreTrackRow } from './tyre-types';

function formatRace(season: number | null, race: number | null) {
  if (season === null || race === null) return 'Disponível em próxima fase';
  return `S${season} · R${race}`;
}

function formatTemperature(value: number | null) {
  if (value === null) return '—';
  return `${value.toFixed(1)}°C`;
}

function matchesRange(value: number | null, min: string, max: string) {
  if (value === null) return false;
  const minValue = min.trim() ? Number(min) : null;
  const maxValue = max.trim() ? Number(max) : null;
  if (minValue !== null && Number.isFinite(minValue) && value < minValue) return false;
  if (maxValue !== null && Number.isFinite(maxValue) && value > maxValue) return false;
  return true;
}

function DrawerTabs({ row, data }: { row: TyreObservationRow | null; data: TyreLabResponse }) {
  const [activePanel, setActivePanel] = useState<'payload' | 'schema' | 'evidence' | 'discovery'>('payload');

  const schemaPreview = data.knowledgePanel.schemaPreview;
  const evidencePreview = data.knowledgePanel.evidencePreview;
  const discovery = data.knowledgePanel.discovery;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'payload', label: 'Payload', icon: ScrollText },
          { id: 'schema', label: 'Schema', icon: LayoutGrid },
          { id: 'evidence', label: 'Evidence', icon: Database },
          { id: 'discovery', label: 'Discovery', icon: Layers3 },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activePanel === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id as typeof activePanel)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-widest transition ${active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {activePanel === 'payload' && (
          <pre className="max-h-[320px] overflow-auto text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap">{row ? JSON.stringify(row, null, 2) : 'Selecione uma observação para ver o payload.'}</pre>
        )}
        {activePanel === 'schema' && (
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Schema preview</p>
            {schemaPreview ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3 text-sm"><strong className="block text-[10px] uppercase tracking-widest text-slate-400">Field count</strong>{schemaPreview.fieldCount}</div>
                <div className="rounded-xl bg-slate-50 p-3 text-sm"><strong className="block text-[10px] uppercase tracking-widest text-slate-400">Payload type</strong>{schemaPreview.payloadType}</div>
                <div className="rounded-xl bg-slate-50 p-3 text-sm"><strong className="block text-[10px] uppercase tracking-widest text-slate-400">Recursive fields</strong>{schemaPreview.recursiveFieldCount}</div>
                <div className="rounded-xl bg-slate-50 p-3 text-sm"><strong className="block text-[10px] uppercase tracking-widest text-slate-400">Top-level keys</strong>{schemaPreview.topLevelKeys.length}</div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Disponível em próxima fase</p>
            )}
          </div>
        )}
        {activePanel === 'evidence' && (
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Evidence</p>
            <pre className="max-h-[320px] overflow-auto text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap">{evidencePreview ? JSON.stringify(evidencePreview, null, 2) : 'Disponível em próxima fase'}</pre>
          </div>
        )}
        {activePanel === 'discovery' && (
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Discovery</p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3 text-sm"><strong className="block text-[10px] uppercase tracking-widest text-slate-400">Eventos</strong>{discovery.summary.totalEvents}</div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm"><strong className="block text-[10px] uppercase tracking-widest text-slate-400">Notices</strong>{discovery.summary.noticeCount}</div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm"><strong className="block text-[10px] uppercase tracking-widest text-slate-400">Warnings</strong>{discovery.summary.warningCount}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrackSidebar({ trackExplorer }: { trackExplorer: TyreTrackRow[] }) {
  return (
    <aside className="w-[340px] shrink-0 rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Track Explorer</p>
          <h3 className="mt-2 text-lg font-black text-slate-950">Pistas observadas</h3>
        </div>
        <Radar size={16} className="text-emerald-600" />
      </div>
      <div className="mt-4 max-h-[calc(100vh-360px)] overflow-y-auto space-y-3 pr-1">
        {trackExplorer.length > 0 ? trackExplorer.map(track => (
          <div key={track.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">{track.name}</p>
            <p className="mt-1 text-xs text-slate-500">{track.observationCount} observações</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Temp. mín.</p><p className="mt-1 font-black text-slate-900">{formatTemperature(track.minTemperature)}</p></div>
              <div className="rounded-xl bg-white p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Temp. máx.</p><p className="mt-1 font-black text-slate-900">{formatTemperature(track.maxTemperature)}</p></div>
              <div className="rounded-xl bg-white p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Comp.</p><p className="mt-1 font-black text-slate-900">{track.compoundCount}</p></div>
              <div className="rounded-xl bg-white p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Corridas</p><p className="mt-1 font-black text-slate-900">{track.raceCount}</p></div>
            </div>
          </div>
        )) : <p className="text-sm text-slate-500">Dados insuficientes</p>}
      </div>
    </aside>
  );
}

export function TyreDataTab({
  overview,
  header,
  filteredDataset,
  trackExplorer,
  uniqueTracks,
  uniqueSources,
  query,
  setQuery,
  trackFilter,
  setTrackFilter,
  sourceFilter,
  setSourceFilter,
  selectedRow,
  setSelectedRow,
  data,
  queryState,
  setQueryState,
  onClearQuery,
  onSaveQuery,
  onExportQuery,
}: {
  overview: { coverage: number };
  header: { observationCount: number; raceCount: number; trackCount: number; latestUpdate: string | null };
  filteredDataset: TyreObservationRow[];
  trackExplorer: TyreTrackRow[];
  uniqueTracks: string[];
  uniqueSources: string[];
  query: string;
  setQuery: (value: string) => void;
  trackFilter: string;
  setTrackFilter: (value: string) => void;
  sourceFilter: string;
  setSourceFilter: (value: string) => void;
  selectedRow: TyreObservationRow | null;
  setSelectedRow: (row: TyreObservationRow | null) => void;
  data: TyreLabResponse;
  queryState: ResearchQuery;
  setQueryState: (next: ResearchQuery) => void;
  onClearQuery: () => void;
  onSaveQuery: () => void;
  onExportQuery: (format: 'csv' | 'json' | 'markdown') => void;
}) {
  const [selectedRowForDetails, setSelectedRowForDetails] = useState<TyreObservationRow | null>(selectedRow);

  const visibleRows = useMemo(() => filteredDataset, [filteredDataset]);
  const temperatureValues = visibleRows.map(row => row.temperature).filter((v): v is number => typeof v === 'number');
  const wearValues = visibleRows.map(row => row.wear).filter((v): v is number => typeof v === 'number');
  const observationCount = visibleRows.length;
  const coverage = overview.coverage;
  const trackCount = new Set(visibleRows.map(row => row.track).filter(Boolean) as string[]).size;
  const compoundCount = new Set(visibleRows.map(row => row.compound).filter(Boolean) as string[]).size;
  const averageTemperature = temperatureValues.length ? temperatureValues.reduce((sum, value) => sum + value, 0) / temperatureValues.length : null;
  const averageWear = wearValues.length ? wearValues.reduce((sum, value) => sum + value, 0) / wearValues.length : null;

  const detailRow = selectedRowForDetails ?? selectedRow;

  return (
    <div className="space-y-6">
      <ResearchQueryBuilder
        query={queryState}
        setQuery={setQueryState}
        onClear={onClearQuery}
        onSave={onSaveQuery}
        onExport={onExportQuery}
        trackOptions={uniqueTracks}
        compoundOptions={Array.from(new Set(data.dataset.map(row => row.compound).filter(Boolean) as string[])).sort()}
        weatherOptions={Array.from(new Set(data.dataset.map(row => row.weather).filter(Boolean) as string[])).sort()}
        endpointOptions={Array.from(new Set(data.dataset.map(row => row.endpoint))).sort()}
        sourceOptions={uniqueSources}
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 min-w-[180px]"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Observações encontradas</p><p className="mt-2 text-2xl font-black text-slate-900">{observationCount}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 min-w-[180px]"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cobertura</p><p className="mt-2 text-2xl font-black text-slate-900">{coverage}%</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 min-w-[180px]"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantidade de pistas</p><p className="mt-2 text-2xl font-black text-slate-900">{trackCount}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 min-w-[180px]"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantidade de compostos</p><p className="mt-2 text-2xl font-black text-slate-900">{compoundCount}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 min-w-[180px]"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Temperatura média</p><p className="mt-2 text-2xl font-black text-slate-900">{averageTemperature !== null ? `${averageTemperature.toFixed(1)}°C` : 'Dados insuficientes'}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 min-w-[180px]"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Wear médio</p><p className="mt-2 text-2xl font-black text-slate-900">{averageWear !== null ? `${averageWear.toFixed(1)}%` : 'Dados insuficientes'}</p></div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-[1.25rem] border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Temporada</th>
                  <th className="px-4 py-3">Corrida</th>
                  <th className="px-4 py-3">Pista</th>
                  <th className="px-4 py-3">Temperatura</th>
                  <th className="px-4 py-3">Clima</th>
                  <th className="px-4 py-3">Composto</th>
                  <th className="px-4 py-3">Stint</th>
                  <th className="px-4 py-3">Desgaste</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">Endpoint</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length > 0 ? visibleRows.map(row => (
                  <tr key={row.id} onClick={() => setSelectedRowForDetails(row)} className="cursor-pointer border-t border-slate-100 transition hover:bg-emerald-50/60">
                    <td className="px-4 py-3 font-medium text-slate-700">{row.season ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{formatRace(row.season, row.race)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.track ?? 'Disponível em próxima fase'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatTemperature(row.temperature)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.weather ?? 'Disponível em próxima fase'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.compound ?? 'Disponível em próxima fase'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.stint ?? 'Disponível em próxima fase'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.wear !== null ? `${row.wear}%` : 'Disponível em próxima fase'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.source}</td>
                    <td className="px-4 py-3 text-slate-700">{row.endpoint}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={10}>Nenhuma observação encontrada para os filtros atuais.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <TrackSidebar trackExplorer={trackExplorer} />
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">Detalhes da linha selecionada</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Payload, schema, evidence e discovery</h2>
          </div>
          <button onClick={() => setSelectedRowForDetails(null)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:border-slate-300">Limpar seleção</button>
        </div>
        <div className="mt-5">
          <DrawerTabs row={detailRow} data={data} />
        </div>
      </section>
    </div>
  );
}
